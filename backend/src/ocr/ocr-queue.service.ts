import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Queue, Job } from "bull";
import { Repository } from "typeorm";
import { OcrJob, OcrJobStatus } from "./entities/ocr-job.entity";
import { OcrService } from "./ocr.service";
import { CreateOcrJobDto } from "./dto/ocr-job.dto";
import { OcrJobData } from "./ocr.processor";

/**
 * OCR Queue Service
 * Handles OCR job creation, status tracking, and queue management
 */
@Injectable()
export class OcrQueueService {
  private readonly logger = new Logger(OcrQueueService.name);

  constructor(
    @InjectQueue('ocr')
    private readonly ocrQueue: Queue<OcrJobData>,
    @InjectRepository(OcrJob)
    private readonly ocrJobRepository: Repository<OcrJob>,
    private readonly ocrService: OcrService,
  ) {}

  /**
   * Create a new OCR job and add it to the queue
   */
  async createJob(dto: CreateOcrJobDto, imageBuffer?: Buffer): Promise<OcrJob> {
    // Fail fast when no workers are available (#568)
    const { available } = this.ocrService.getPool().getHealthStatus();
    if (available === 0) {
      throw new ServiceUnavailableException('OCR service is unavailable: no workers are ready');
    }

    // Create the job record in the database
    const ocrJob = this.ocrJobRepository.create({
      itemId: dto.itemId,
      splitId: dto.splitId,
      uploadedBy: dto.uploadedBy,
      originalFilename: dto.originalFilename,
      imageUrl: dto.imageUrl,
      status: OcrJobStatus.PENDING,
      progress: 0,
      retryCount: 0,
      maxRetries: 3,
      needsManualReview: false,
    });

    const savedJob = await this.ocrJobRepository.save(ocrJob);
    this.logger.log(`Created OCR job ${savedJob.id}`);

    // Prepare job data
    const jobData: OcrJobData = {
      jobId: savedJob.id,
      imageBuffer: imageBuffer ? imageBuffer.toString('base64') : undefined,
      imageUrl: dto.imageUrl,
      itemId: dto.itemId,
      splitId: dto.splitId,
      uploadedBy: dto.uploadedBy,
      originalFilename: dto.originalFilename,
    };

    // Add job to queue with priority
    const job = await this.ocrQueue.add(jobData, {
      priority: dto.priority ?? 1,
      attempts: 3, // Bull retry attempts
      backoff: {
        type: 'exponential',
        delay: 2000, // Start with 2 seconds delay
      },
      removeOnComplete: false, // Keep completed jobs for history
      removeOnFail: false, // Keep failed jobs for debugging
    });

    // Update queue job ID (convert to string)
    savedJob.queueJobId = String(job.id);
    await this.ocrJobRepository.save(savedJob);

    this.logger.log(`Added OCR job ${savedJob.id} to queue with priority ${dto.priority ?? 1}`);

    return savedJob;
  }

  /**
   * Get OCR job status and details
   */
  async getJob(jobId: string): Promise<OcrJob> {
    const job = await this.ocrJobRepository.findOne({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`OCR job ${jobId} not found`);
    }

    return job;
  }

  /**
   * Get all OCR jobs for a specific item
   */
  async getJobsByItem(itemId: string): Promise<OcrJob[]> {
    return this.ocrJobRepository.find({
      where: { itemId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get all OCR jobs that need manual review
   */
  async getJobsNeedingReview(): Promise<OcrJob[]> {
    return this.ocrJobRepository.find({
      where: { needsManualReview: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get failed jobs that might be retried
   */
  async getFailedJobs(): Promise<OcrJob[]> {
    return this.ocrJobRepository.find({
      where: { status: OcrJobStatus.FAILED },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Retry a failed OCR job
   */
  async retryJob(jobId: string): Promise<OcrJob> {
    const job = await this.ocrJobRepository.findOne({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`OCR job ${jobId} not found`);
    }

    if (job.status !== OcrJobStatus.FAILED) {
      throw new Error(`Cannot retry job in status: ${job.status}`);
    }

    // Reset job status
    job.status = OcrJobStatus.PENDING;
    job.progress = 0;
    job.errorMessage = undefined;
    job.retryCount = 0;
    await this.ocrJobRepository.save(job);

    // Re-add to queue
    const jobData: OcrJobData = {
      jobId: job.id,
      imageUrl: job.imageUrl,
      itemId: job.itemId,
      splitId: job.splitId,
      uploadedBy: job.uploadedBy,
      originalFilename: job.originalFilename,
    };

    await this.ocrQueue.add(jobData, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });

    this.logger.log(`Retrying OCR job ${jobId}`);

    return job;
  }

  /**
   * Cancel a pending OCR job
   */
  async cancelJob(jobId: string): Promise<void> {
    const job = await this.ocrJobRepository.findOne({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`OCR job ${jobId} not found`);
    }

    if (job.status !== OcrJobStatus.PENDING && job.status !== OcrJobStatus.PROCESSING) {
      throw new Error(`Cannot cancel job in status: ${job.status}`);
    }

    // Try to remove from queue if it hasn't been processed yet
    if (job.queueJobId) {
      try {
        const queueJob = await this.ocrQueue.getJob(job.queueJobId);
        if (queueJob) {
          await queueJob.remove();
        }
      } catch (error) {
        this.logger.warn(`Failed to remove job ${jobId} from queue:`, error);
      }
    }

    // Update status
    job.status = OcrJobStatus.FAILED;
    job.errorMessage = 'Job cancelled by user';
    await this.ocrJobRepository.save(job);

    this.logger.log(`Cancelled OCR job ${jobId}`);
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    needsReview: number;
  }> {
    const [pending, processing, completed, failed, needsReview] = await Promise.all([
      this.ocrJobRepository.count({ where: { status: OcrJobStatus.PENDING } }),
      this.ocrJobRepository.count({ where: { status: OcrJobStatus.PROCESSING } }),
      this.ocrJobRepository.count({ where: { status: OcrJobStatus.COMPLETED } }),
      this.ocrJobRepository.count({ where: { status: OcrJobStatus.FAILED } }),
      this.ocrJobRepository.count({ where: { status: OcrJobStatus.NEEDS_REVIEW } }),
    ]);

    return { pending, processing, completed, failed, needsReview };
  }

  /**
   * Get OCR job progress from the queue
   */
  async getJobProgress(jobId: string): Promise<{ progress: number; status: string }> {
    const job = await this.ocrJobRepository.findOne({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`OCR job ${jobId} not found`);
    }

    // If job is still in queue, check queue status
    if (job.queueJobId && (job.status === OcrJobStatus.PENDING || job.status === OcrJobStatus.PROCESSING)) {
      try {
        const queueJob = await this.ocrQueue.getJob(job.queueJobId);
        if (queueJob) {
          const progress = queueJob.progress();
          return {
            progress: Math.round(progress * 100),
            status: job.status,
          };
        }
      } catch {
        // Ignore queue lookup errors
      }
    }

    return {
      progress: job.progress,
      status: job.status,
    };
  }

  /**
   * Manually trigger OCR processing for a job (bypass queue for testing)
   */
  async processJobManually(jobId: string): Promise<OcrJob> {
    const job = await this.ocrJobRepository.findOne({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`OCR job ${jobId} not found`);
    }

    if (job.status !== OcrJobStatus.PENDING) {
      throw new Error(`Cannot process job in status: ${job.status}`);
    }

    // For manual processing, we would need to get the image data
    // This is a simplified version that marks it as needing the queue
    job.status = OcrJobStatus.PROCESSING;
    await this.ocrJobRepository.save(job);

    // Add to queue for processing
    const jobData: OcrJobData = {
      jobId: job.id,
      imageUrl: job.imageUrl,
      itemId: job.itemId,
      splitId: job.splitId,
      uploadedBy: job.uploadedBy,
      originalFilename: job.originalFilename,
    };

    await this.ocrQueue.add(jobData);

    this.logger.log(`Manually triggered processing for OCR job ${jobId}`);

    return job;
  }
}