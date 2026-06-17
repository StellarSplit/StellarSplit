import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { RecurringSplitsService } from "./recurring-splits.service";
import { PaymentGateway } from "../websocket/payment.gateway";

@Injectable()
export class RecurringSplitsScheduler {
  private readonly logger = new Logger(RecurringSplitsScheduler.name);

  constructor(
    private readonly recurringSplitsService: RecurringSplitsService,
    private readonly paymentGateway: PaymentGateway
  ) {}

  /**
   * Cron job to generate splits from recurring split templates
   * Runs every 6 hours to check for due recurring splits
   */
  @Cron("0 */6 * * *", { timeZone: process.env.TZ || "UTC" })
  async processRecurringSplits(): Promise<void> {
    if (process.env.NODE_ENV === "test") return;
    this.logger.log("Starting recurring splits processing...");

    try {
      // Get all recurring splits that are due for processing
      const dueRecurringSplits =
        await this.recurringSplitsService.getRecurringSplitsDueForProcessing();

      if (dueRecurringSplits.length === 0) {
        this.logger.log("No recurring splits due for processing");
        return;
      }

      this.logger.log(
        `Found ${dueRecurringSplits.length} recurring splits due for processing`
      );

      // Process each recurring split
      for (const recurringSplit of dueRecurringSplits) {
        try {
          const generatedSplit =
            await this.recurringSplitsService.generateSplitFromTemplate(
              recurringSplit.id
            );

          if (generatedSplit) {
            this.logger.log(
              `Successfully generated split ${generatedSplit.id} from recurring split ${recurringSplit.id}`
            );

            // Emit event to notify users via WebSocket
            this.paymentGateway.emitSplitCompletion(recurringSplit.creatorId, {
              type: "split_generated",
              recurringSplitId: recurringSplit.id,
              generatedSplitId: generatedSplit.id,
              totalAmount: generatedSplit.totalAmount,
              description: generatedSplit.description,
              timestamp: new Date().toISOString(),
            });
          }
        } catch (error) {
          this.logger.error(
            `Failed to process recurring split ${recurringSplit.id}: ${error}`,
            error
          );
        }
      }

      this.logger.log("Recurring splits processing completed");
    } catch (error) {
      this.logger.error(`Error in processRecurringSplits: ${error}`, error);
    }
  }

  /**
   * Cron job to send reminders for upcoming recurring splits
   * Runs twice daily at 9 AM and 5 PM
   */
  @Cron("0 9,17 * * *", { timeZone: process.env.TZ || "UTC" }) // 9 AM and 5 PM local time
  async sendRecurringSplitReminders(): Promise<void> {
    if (process.env.NODE_ENV === "test") return;
    this.logger.log("Starting recurring splits reminder check...");

    try {
      // Get all recurring splits due for reminders
      const dueForReminders =
        await this.recurringSplitsService.getRecurringSplitsDueForReminders();

      if (dueForReminders.length === 0) {
        this.logger.log("No reminders due");
        return;
      }

      this.logger.log(
        `Found ${dueForReminders.length} recurring splits due for reminders`
      );

      // Send reminders for each
      for (const recurringSplit of dueForReminders) {
        try {
          this.logger.log(
            `Sending reminder for recurring split ${recurringSplit.id}`
          );

          // Emit notification via WebSocket
          this.paymentGateway.emitPaymentNotification(
            recurringSplit.creatorId,
            {
              type: "recurring_split_reminder",
              recurringSplitId: recurringSplit.id,
              nextOccurrence: recurringSplit.nextOccurrence,
              daysUntilDue: recurringSplit.reminderDaysBefore,
              amount: recurringSplit.templateSplit?.totalAmount,
              description: recurringSplit.description,
              timestamp: new Date().toISOString(),
            }
          );

          // TODO: Send email reminder if email service is integrated
          // await this.emailService.sendRecurringSplitReminder(recurringSplit);
        } catch (error) {
          this.logger.error(
            `Failed to send reminder for recurring split ${recurringSplit.id}: ${error}`,
            error
          );
        }
      }

      this.logger.log("Reminder check completed");
    } catch (error) {
      this.logger.error(
        `Error in sendRecurringSplitReminders: ${error}`,
        error
      );
    }
  }

  /**
   * Cron job to cleanup and deactivate expired recurring splits
   * Runs once daily at 2 AM
   */
  @Cron("0 2 * * *", { timeZone: process.env.TZ || "UTC" }) // 2 AM local time
  async cleanupExpiredRecurringSplits(): Promise<void> {
    if (process.env.NODE_ENV === "test") return;
    this.logger.log("Starting expired recurring splits cleanup...");

    try {
      // Get all active recurring splits across all creators
      const allActive =
        await this.recurringSplitsService.getAllActiveRecurringSplits();

      const now = new Date();
      let deactivatedCount = 0;

      for (const recurringSplit of allActive) {
        // Check if end date has passed
        if (
          recurringSplit.isActive &&
          recurringSplit.endDate &&
          recurringSplit.endDate <= now
        ) {
          await this.recurringSplitsService.pauseRecurringSplit(
            recurringSplit.id
          );
          deactivatedCount++;

          this.logger.log(
            `Deactivated expired recurring split ${recurringSplit.id}`
          );

          // Notify creator
          this.paymentGateway.emitPaymentNotification(
            recurringSplit.creatorId,
            {
              type: "recurring_split_expired",
              recurringSplitId: recurringSplit.id,
              description: recurringSplit.description,
              timestamp: new Date().toISOString(),
            }
          );
        }
      }

      this.logger.log(
        `Cleanup completed. Deactivated ${deactivatedCount} recurring splits`
      );
    } catch (error) {
      this.logger.error(
        `Error in cleanupExpiredRecurringSplits: ${error}`,
        error
      );
    }
  }

  /**
   * Manual trigger to process a single recurring split (for testing/admin)
   */
  async manuallyProcessRecurringSplit(recurringSplitId: string): Promise<void> {
    this.logger.log(`Manually processing recurring split: ${recurringSplitId}`);
    try {
      const generatedSplit =
        await this.recurringSplitsService.generateSplitFromTemplate(
          recurringSplitId
        );

      if (generatedSplit) {
        this.logger.log(`Successfully generated split: ${generatedSplit.id}`);
      } else {
        this.logger.warn(
          `No split generated for recurring split: ${recurringSplitId}`
        );
      }
    } catch (error) {
      this.logger.error(
        `Error manually processing recurring split: ${error}`,
        error
      );
      throw error;
    }
  }
}
