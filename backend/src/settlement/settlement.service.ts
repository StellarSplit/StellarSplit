import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThan } from "typeorm";
import { SettlementStep, StepStatus } from "./entities/settlement-step.entity";
import { Participant } from "@/entities/participant.entity";
import { User } from "../entities/user.entity";
import { StellarService } from "../stellar/stellar.service";

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    @InjectRepository(SettlementStep)
    private stepRepo: Repository<SettlementStep>,
    @InjectRepository(Participant)
    private participantRepo: Repository<Participant>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private stellarService: StellarService,
  ) {}

  async verifyAndCompleteStep(
    stepId: string,
    txHash: string,
    userWallet: string,
  ) {
    try {
      const step = await this.stepRepo.findOne({
        where: { id: stepId, fromAddress: userWallet },
        relations: ["suggestion"],
      });

      if (!step) {
        throw new NotFoundException("Settlement step not found");
      }

      if (step.status === StepStatus.COMPLETED) {
        return step;
      }

      const verification = await this.stellarService.verifyTransaction(txHash);
      if (!verification || !verification.valid) {
        throw new BadRequestException(
          "Transaction could not be verified on-chain",
        );
      }

      const isMatch =
        verification.sender === userWallet &&
        verification.receiver === step.toAddress &&
        verification.amount >= Number(step.amount);

      if (!isMatch) {
        throw new BadRequestException(
          "Transaction details do not match the settlement step",
        );
      }

      step.status = StepStatus.COMPLETED;

      await this.participantRepo.update(
        { splitId: step.relatedSplitIds[0], walletAddress: userWallet },
        {
          status: "paid",
          amountPaid: () => `amount_paid + ${verification.amount}`,
        },
      );

      return this.stepRepo.save(step);
    } catch (error: any) {
      this.logger.error(
        `Error completing settlement step ${stepId} for wallet ${userWallet}: ${error?.message || error}`,
        error,
      );
      throw error;
    }
  }

  async calculateNetPosition(walletAddress: string) {
    const stats = await this.participantRepo
      .createQueryBuilder("p")
      .select(
        "SUM(CASE WHEN p.walletAddress = :wallet THEN (p.amountOwed - p.amountPaid) ELSE 0 END)",
        "owes",
      )
      .addSelect(
        "SUM(CASE WHEN p.walletAddress != :wallet THEN (p.amountOwed - p.amountPaid) ELSE 0 END)",
        "owed",
      )
      .innerJoin("p.split", "s")
      .where("s.creatorWalletAddress = :wallet OR p.walletAddress = :wallet", {
        wallet: walletAddress,
      })
      .getRawOne();

    return {
      owes: parseFloat(stats.owes || 0),
      owed: parseFloat(stats.owed || 0),
      net: parseFloat(stats.owed || 0) - parseFloat(stats.owes || 0),
    };
  }

  async snoozeSuggestions(userId: string) {
    const snoozeDate = new Date();
    snoozeDate.setDate(snoozeDate.getDate() + 7);

    await this.userRepo.update(
      userId,
      { snoozedUntil: snoozeDate } as any,
    );

    return { snoozedUntil: snoozeDate };
  }

  async isSnoozed(userId: string): Promise<boolean> {
    const user = await this.userRepo.findOne({
      where: { id: userId, snoozedUntil: MoreThan(new Date()) },
    } as any);

    return !!user;
  }
}
