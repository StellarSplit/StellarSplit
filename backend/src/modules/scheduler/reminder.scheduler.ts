import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Split } from '../../entities/split.entity';
import { Participant } from '../../entities/participant.entity';

/**
 * Callable interface of the on-chain `reminder` Soroban contract
 * (contracts/reminder). These names map 1:1 to the contract's
 * `#[contractimpl]` functions and are the entry points any on-chain
 * invocation of the reminder flow must target.
 */
export const REMINDER_CONTRACT_FNS = {
  requestReminder: 'request_reminder',
  cancelReminder: 'cancel_reminder',
  getReminderRequested: 'get_reminder_requested',
} as const;

@Injectable()
export class ReminderSchedulerService {
    private readonly logger = new Logger(ReminderSchedulerService.name);

    constructor(
        @InjectRepository(Split)
        private readonly splitRepository: Repository<Split>,
        @InjectRepository(Participant)
        private readonly participantRepository: Repository<Participant>,
        @InjectQueue('reminders')
        private readonly reminderQueue: Queue,
    ) { }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async handleReminders() {
        this.logger.log('Starting daily payment reminder evaluation');

        const now = new Date();
        const threeDaysFromNow = new Date(now);
        threeDaysFromNow.setDate(now.getDate() + 3);

        const oneDayFromNow = new Date(now);
        oneDayFromNow.setDate(now.getDate() + 1);

        // Find splits with upcoming deadlines or today's deadline
        const splits = await this.splitRepository.find({
            where: [
                { dueDate: LessThanOrEqual(threeDaysFromNow), status: In(['active', 'partial']) },
            ],
            relations: ['participants'],
        });

        for (const split of splits) {
            if (!split.dueDate) continue;

            const diffInDays = Math.ceil((split.dueDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

            if (diffInDays === 3 || diffInDays === 1 || diffInDays === 0) {
                await this.queueRemindersForSplit(split, diffInDays);
            }
        }
    }

    private async queueRemindersForSplit(split: Split, diffInDays: number) {
        const overdueParticipants = split.participants.filter(p => p.status !== 'paid');

        for (const participant of overdueParticipants) {
            await this.reminderQueue.add('send-reminder', {
                participantId: participant.id,
                splitId: split.id,
                daysToDeadline: diffInDays,
                amountOwed: participant.amountOwed,
                contractFn: REMINDER_CONTRACT_FNS.requestReminder,
            });

            this.logger.log(`Queued reminder (${REMINDER_CONTRACT_FNS.requestReminder}) for participant ${participant.id} in split ${split.id} (${diffInDays} days left)`);
        }
    }
}
