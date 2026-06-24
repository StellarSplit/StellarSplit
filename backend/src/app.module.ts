// app.module.ts
import { BullModule } from "@nestjs/bull";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { TypeOrmModule } from "@nestjs/typeorm";
import { APP_INTERCEPTOR } from "@nestjs/core";

import * as dotenv from "dotenv";
import * as path from "path";

import appConfig from "./config/app.config";
import databaseConfig from "./config/database.config";
import { getRedisConnectionOptions } from "./config/redis.config";

import { AnalyticsModule } from "./analytics/analytics.module";
import { ComplianceModule } from "./compliance/compliance.module";
import { CollaborationModule } from "./collaboration/collaboration.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { DisputesModule } from "./disputes/disputes.module";
import { EmailModule } from "./email/email.module";
import { ExportModule } from "./export/export.module";
import { FriendshipModule } from "./friendship/friendship.module";
import { GatewayModule } from "./gateway/gateway.module";
import { GovernanceModule } from "./governance/governance.module";
import { InvitationsModule } from "./invitations/invitations.module";
import { MentionsModule } from "./mentions/mentions.module";
import { ActivitiesModule } from "./modules/activities/activities.module";
import { ArchivingModule } from "./modules/archiving/archiving.module";
import { CurrencyModule } from "./modules/currency/currency.module";
import { HealthModule } from "./modules/health/health.module"; // canonical backend health module
import { ItemsModule } from "./modules/items/items.module";
import { SchedulerModule } from "./modules/scheduler/scheduler.module";
import { SplitsModule } from "./modules/splits/splits.module";
import { PaymentsModule } from "./payments/payments.module";
import { ProfileModule } from "./profile/profile.module";
import { PushNotificationsModule } from "./push-notifications/push-notifications.module";
import { ReceiptsModule } from "./receipts/receipts.module";
import { RecurringSplitsModule } from "./recurring-splits/recurring-splits.module";
import { SearchModule } from "./search/search.module";
import { SettlementModule } from "./settlement/settlement.module";
import { SplitCommentsModule } from "./split-comments/split-comments.module";
import { SplitHistoryModule } from "./split-history/split-history.module";
import { SplitTemplateModule } from "./split-template/split-template.module";
import { StellarModule } from "./stellar/stellar.module";
import { TemplatesModule } from "./templates/templates.module";
import { UploadModule } from "./uploads/upload.module";
import { ShortLinksModule } from "./short-links/short-links.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { ReputationModule } from "./reputation/reputation.module";
import { FraudDetectionModule } from "./fraud-detection/fraud-detection.module";
import { SecurityModule } from "./security/security.module";
import { CommonModule } from "./common/common.module";
import { IdempotencyInterceptor } from "./common/idempotency/idempotency.interceptor";
// Duplicate imports removed; already imported above.
// Load environment variables
dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

@Module({
  imports: [
    // ✅ Config
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", ".env.local"],
      load: [appConfig, databaseConfig],
    }),

    // ✅ Event system (mentions, activity feed, etc.)
    EventEmitterModule.forRoot(),

    // ✅ Database
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbConfig = configService.get("database");
        return {
          type: "postgres",
          host: dbConfig.host,
          port: dbConfig.port,
          username: dbConfig.username,
          password: dbConfig.password,
          database: dbConfig.name,
          entities: [path.join(__dirname, "**/*.entity{.ts,.js}")],
          synchronize: dbConfig.synchronize,
          logging: dbConfig.logging,
        };
      },
    }),

    // ✅ Queue / background jobs
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: getRedisConnectionOptions(configService),
      }),
    }),

    // ✅ Feature modules
    CommonModule,
    SecurityModule,
    HealthModule,
    StellarModule,
    PaymentsModule,
    CurrencyModule,
    SplitsModule,
    ItemsModule,
    EmailModule,
    RecurringSplitsModule,
    ReceiptsModule,
    SplitHistoryModule,
    ActivitiesModule,
    SearchModule,
    FriendshipModule,
    InvitationsModule,
    MentionsModule,
    SplitCommentsModule,
    // Analytics module for user spending & reports
    AnalyticsModule,
    ExportModule,
    // Webhooks module for external event notifications
    WebhooksModule,
    // Dispute resolution system for split conflicts
    DisputesModule,
    ReputationModule,
    // DAO Governance system for platform decisions
    GovernanceModule,
    // Compliance module for tax reporting and exports
    ComplianceModule,
    SettlementModule,
    SplitTemplateModule,
    TemplatesModule,
    PushNotificationsModule,
    ArchivingModule,
    GatewayModule,
    SchedulerModule,
    UploadModule,
    ProfileModule,
    CollaborationModule,
    DashboardModule,
    ShortLinksModule,
    FraudDetectionModule,
    // Duplicated modules were already included earlier.
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
})
export class AppModule {}
