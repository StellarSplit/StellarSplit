import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookRateLimitStore } from './webhook-rate-limit.store';
import { TestWebhookDispatcher } from './test-webhook-dispatcher';
import { WebhookProcessor } from './webhook.processor';
import { WebhookPolicyService } from './webhook-policy.service';
import { Webhook } from './webhook.entity';
import { WebhookDelivery } from './webhook-delivery.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Webhook, WebhookDelivery]),
    BullModule.registerQueue({
      name: 'webhook_queue',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookDeliveryService, WebhookProcessor, TestWebhookDispatcher, WebhookRateLimitStore, WebhookPolicyService],
  exports: [WebhooksService, WebhookDeliveryService, TestWebhookDispatcher, WebhookRateLimitStore, WebhookPolicyService],
})
export class WebhooksModule {}
