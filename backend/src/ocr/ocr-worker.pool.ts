/**
 * OCR worker pool (#479, #568)
 *
 * Manages a bounded pool of Tesseract workers so that concurrent scan
 * requests do not create unbounded workers or drop requests silently.
 *
 * Lifecycle:
 *   - `initialize(size)` — create `size` workers (called from `onModuleInit`)
 *   - `acquire()`        — wait for a free worker (queued if all busy)
 *   - `release(worker)` — return worker to the pool
 *   - `shutdown()`      — terminate all workers (called from `onModuleDestroy`)
 *
 * The pool resolves pending `acquire()` calls in FIFO order.
 */
import { Injectable, Logger } from '@nestjs/common';
import { createWorker, Worker } from 'tesseract.js';

export interface OcrWorkerPoolOptions {
  /** Number of Tesseract workers to maintain. Default: 2. */
  poolSize?: number;
  /** Tesseract language pack. Default: 'eng'. */
  language?: string;
}

export interface OcrHealthStatus {
  total: number;
  available: number;
  failed: number;
}

@Injectable()
export class OcrWorkerPool {
  private readonly logger = new Logger(OcrWorkerPool.name);
  private workers: Worker[] = [];
  private available: Worker[] = [];
  private queue: Array<(worker: Worker) => void> = [];
  private initialized = false;
  private failedWorkers = 0;
  private totalConfigured = 0;

  async initialize(options: OcrWorkerPoolOptions = {}): Promise<void> {
    if (this.initialized) return;

    const size     = options.poolSize ?? 2;
    const language = options.language ?? 'eng';
    this.totalConfigured = size;

    this.logger.log(`Initializing OCR worker pool (size: ${size})`);

    const results = await Promise.allSettled(
      Array.from({ length: size }, () =>
        createWorker(language, 1, {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              this.logger.debug(`OCR progress: ${Math.round(m.progress * 100)}%`);
            }
          },
        }),
      ),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        this.workers.push(result.value);
        this.available.push(result.value);
      } else {
        this.failedWorkers++;
        this.logger.error('Failed to initialize OCR worker', result.reason);
      }
    }

    this.initialized = true;

    this.logger.log(
      `OCR worker pool initialized: ${this.workers.length} ready, ${this.failedWorkers} failed`,
    );
  }

  /** Health status for monitoring / health checks (#568). */
  getHealthStatus(): OcrHealthStatus {
    return {
      total: this.totalConfigured,
      available: this.available.length,
      failed: this.failedWorkers,
    };
  }

  /**
   * Acquire a free worker. If all workers are busy, the caller is queued and
   * will receive a worker as soon as one is released.
   */
  acquire(): Promise<Worker> {
    const free = this.available.pop();
    if (free) return Promise.resolve(free);

    return new Promise<Worker>((resolve) => {
      this.queue.push(resolve);
    });
  }

  /**
   * Return a worker to the pool. Automatically dispatches to the next
   * waiting caller if the queue is non-empty.
   */
  release(worker: Worker): void {
    const next = this.queue.shift();
    if (next) {
      next(worker);
    } else {
      this.available.push(worker);
    }
  }

  /** Size of the request queue (for monitoring). */
  get queueDepth(): number {
    return this.queue.length;
  }

  /** Number of currently idle workers. */
  get idleCount(): number {
    return this.available.length;
  }

  /** Total pool size. */
  get poolSize(): number {
    return this.workers.length;
  }

  /** Terminate all workers in the pool and drain the queue. */
  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    this.logger.log('Shutting down OCR worker pool…');

    // Reject any queued callers
    while (this.queue.length > 0) {
      const resolve = this.queue.shift()!;
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      resolve(null as unknown as Worker); // caller should handle null on shutdown
    }

    await Promise.all(this.workers.map((w) => w.terminate().catch(() => {})));
    this.workers   = [];
    this.available = [];
    this.initialized = false;

    this.logger.log('OCR worker pool shut down');
  }
}
