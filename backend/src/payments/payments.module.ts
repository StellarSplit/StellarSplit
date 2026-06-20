import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bull";
import { ConfigModule } from "@nestjs/config";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { PaymentProcessorService } from "./payment-processor.service";
import { PaymentReconciliationService } from "./payment-reconciliation.service";
import { PaymentReconciliationProcessor } from "./payment-reconciliation.processor";
import { PaymentSettlementProcessor } from "./payment-settlement.processor";
import { StellarModule } from "../stellar/stellar.module";
import { forwardRef } from "@nestjs/common";
import { PaymentGateway } from "../websocket/payment.gateway";
import { WsPaymentAuthGuard } from "../websocket/payment.gateway";
import { WsAuthModule } from "../ws-auth/ws-auth.module";
import { Payment } from "../entities/payment.entity";
import { Participant } from "../entities/participant.entity";
import { Split } from "../entities/split.entity";
import { IdempotencyRecord } from "../entities/idempotency-record.entity";
import { EmailModule } from "../email/email.module";
import { MultiCurrencyModule } from "../multi-currency/multi-currency.module";
import { AnalyticsModule } from "../analytics/analytics.module";
import { GatewayModule } from "../gateway/gateway.module";
import { IdempotencyService } from "../common/idempotency/idempotency.service";
import { IdempotencyInterceptor } from "../common/idempotency/idempotency.interceptor";
import { ReputationModule } from "../reputation/reputation.module";
import { QueueJobPolicy, JobPolicyTier } from "../common/queue-job-policy";
import { AuthorizationService } from "../auth/services/authorization.service";

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Payment, Participant, Split, IdempotencyRecord]),
    BullModule.registerQueue(
      QueueJobPolicy.forQueue('payment-reconciliation', JobPolicyTier.CRITICAL),
      QueueJobPolicy.forQueue('payment-settlement', JobPolicyTier.CRITICAL),
    ),
    forwardRef(() => StellarModule),
    EmailModule,
    MultiCurrencyModule,
    AnalyticsModule,
    GatewayModule,
    WsAuthModule,
    ReputationModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentProcessorService,
    PaymentReconciliationService,
    PaymentReconciliationProcessor,
    PaymentSettlementProcessor,
    PaymentGateway,
    WsPaymentAuthGuard,
    AuthorizationService,
    IdempotencyService,
    AnalyticsModule,
    IdempotencyInterceptor,
  ],
  exports: [
    PaymentsService,
    PaymentProcessorService,
    IdempotencyService,
    PaymentReconciliationService,
  ],
})
export class PaymentsModule {}
