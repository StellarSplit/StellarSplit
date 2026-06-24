import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Split } from '../entities/split.entity';
import { Participant } from '../entities/participant.entity';
import { IdempotencyRecord } from '../entities/idempotency-record.entity';
import { CleanupScheduler } from './cleanup.scheduler';
import { SoftDeleteService } from './soft-delete.service';
import { RestoreController } from './restore.controller';
import { IdempotencyService } from './idempotency/idempotency.service';

@Module({
  imports: [TypeOrmModule.forFeature([Split, Participant, IdempotencyRecord])],
  controllers: [RestoreController],
  providers: [CleanupScheduler, SoftDeleteService, IdempotencyService],
  exports: [SoftDeleteService, IdempotencyService],
})
export class CommonModule {}
