import { Module } from '@nestjs/common';
import { OcrWorkerPool } from '../../ocr/ocr-worker.pool';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { HealthCheckService } from './health-check.service';

@Module({
  controllers: [HealthController],
  providers: [HealthService, HealthCheckService, OcrWorkerPool],
  exports: [HealthService, HealthCheckService],
})
export class HealthModule {}
