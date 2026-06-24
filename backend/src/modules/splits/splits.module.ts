import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Item } from "../../entities/item.entity";
import { Participant } from "../../entities/participant.entity";
import { Split } from "../../entities/split.entity";
import { OcrModule } from "../../ocr/ocr.module";
import { Receipt } from "../../receipts/entities/receipt.entity";
import { ParticipantsModule } from "../participants/participants.module";
import { CommonModule } from "../../common/common.module";
import { SplitCalculationService } from "./split-calculation.service";
import { SplitsController } from "./splits.controller";
import { SplitsService } from "./splits.service";

/**
 * Module for split calculation and management functionality
 * Provides services for calculating bill splits across multiple types:
 * - Equal splits
 * - Itemized splits
 * - Percentage-based splits
 * - Custom amount splits
 * Also provides CRUD operations for splits and receipt-to-split workflow
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Split, Item, Participant, Receipt]),
    OcrModule,
    ParticipantsModule,
    CommonModule,
  ],
  controllers: [SplitsController],
  providers: [SplitCalculationService, SplitsService],
  exports: [SplitCalculationService, SplitsService],
})
export class SplitsModule {}
