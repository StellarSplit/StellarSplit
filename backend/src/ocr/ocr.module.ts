import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { OcrWorkerPool } from './ocr-worker.pool';
import { OcrService } from './ocr.service';
import { OcrQueueService } from './ocr-queue.service';
import { OcrProcessor } from './ocr.processor';
import { OcrController } from './ocr.controller';
import { ReceiptParser } from './parsers/receipt-parser';
import { OcrJob } from './entities/ocr-job.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([OcrJob]),
    BullModule.registerQueue({
      name: 'ocr',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: false,
        removeOnFail: false,
      },
    }),
  ],
  controllers: [OcrController],
  providers: [
    OcrWorkerPool,
    OcrService,
    OcrQueueService,
    OcrProcessor,
    ReceiptParser,
  ],
  exports: [OcrWorkerPool, OcrService, OcrQueueService],
})
export class OcrModule {}
