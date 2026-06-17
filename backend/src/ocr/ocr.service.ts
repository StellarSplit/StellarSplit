import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import sharp from "sharp";
import { ReceiptParser, ParsedReceipt } from "./parsers/receipt-parser";
// #479: Replace single lazy worker with a managed pool
import { OcrWorkerPool } from "./ocr-worker.pool";

/** Thrown when worker.recognize() exceeds OCR_TIMEOUT_MS (#568). */
export class OcrTimeoutError extends Error {
  constructor() {
    super('OCR recognition timed out after 30 seconds');
    this.name = 'OcrTimeoutError';
  }
}

const OCR_TIMEOUT_MS = 30_000;

@Injectable()
export class OcrService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OcrService.name);

  constructor(
    private readonly receiptParser: ReceiptParser,
    private readonly pool: OcrWorkerPool,
  ) {}

  // ── Lifecycle (#479) ──────────────────────────────────────────────────────

  async onModuleInit(): Promise<void> {
    await this.pool.initialize({ poolSize: 2, language: "eng" });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.shutdown();
  }

  /**
   * @deprecated Use `onModuleInit` lifecycle instead.
   * Kept for backwards compatibility with existing callers.
   */
  async initialize(): Promise<void> {
    if (!this.pool.poolSize) {
      await this.pool.initialize({ poolSize: 2, language: "eng" });
    }
  }

  /** Expose pool for health/availability checks (#568). */
  getPool(): OcrWorkerPool {
    return this.pool;
  }

  /**
   * Process receipt image and extract structured data.
   * Acquires a worker from the pool, executes OCR, then releases the worker.
   * Concurrent calls are safely queued by the pool.
   */
  async scanReceipt(imageBuffer: Buffer): Promise<ParsedReceipt> {
    const worker = await this.pool.acquire();

    try {
      // Preprocess image
      const processedImage = await this.preprocessImage(imageBuffer);

      // Perform OCR with a 30-second timeout (#568)
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new OcrTimeoutError()), OCR_TIMEOUT_MS),
      );
      const { data } = await Promise.race([worker.recognize(processedImage), timeout]);
      const ocrText = data.text;
      const ocrConfidence = data.confidence / 100; // Convert to 0-1 scale

      this.logger.debug(
        `OCR extracted text (confidence: ${ocrConfidence.toFixed(2)})`
      );
      this.logger.debug(`OCR text preview: ${ocrText.substring(0, 200)}...`);

      // Parse receipt text
      const parsedReceipt = this.receiptParser.parseReceiptText(
        ocrText,
        ocrConfidence
      );

      this.logger.log(
        `Receipt parsed: ${
          parsedReceipt.items.length
        } items, total: $${parsedReceipt.total.toFixed(
          2
        )}, confidence: ${parsedReceipt.confidence.toFixed(2)}`
      );

      return parsedReceipt;
    } catch (error) {
      this.logger.error("Failed to scan receipt", error);
      throw new Error(`OCR processing failed: ${error}`);
    } finally {
      // Always release the worker back to the pool (#479)
      this.pool.release(worker);
    }
  }

  /**
   * Preprocess image to improve OCR accuracy
   */
  private async preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
    try {
      let image = sharp(imageBuffer);

      // Get image metadata
      const metadata = await image.metadata();
      this.logger.debug(
        `Original image: ${metadata.width}x${metadata.height}, format: ${metadata.format}`
      );

      // Convert to grayscale (improves OCR accuracy)
      image = image.greyscale();

      // Enhance contrast
      image = image.normalise();

      // Resize if too large (OCR works better on reasonable sizes)
      if (metadata.width && metadata.width > 2000) {
        image = image.resize(2000, null, {
          withoutEnlargement: true,
          fit: "inside",
        });
      }

      // Apply sharpening
      image = image.sharpen();

      // Convert to PNG buffer for Tesseract
      const processedBuffer = await image.png().toBuffer();

      this.logger.debug(`Image preprocessing completed`);
      return processedBuffer;
    } catch (error) {
      this.logger.error("Image preprocessing failed", error);
      // Return original buffer if preprocessing fails
      return imageBuffer;
    }
  }

  /**
   * Cleanup worker resources.
   * @deprecated Prefer `onModuleDestroy` lifecycle hook (#479).
   */
  async cleanup(): Promise<void> {
    await this.pool.shutdown();
  }
}
