// Analytics event ingestion and processing
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, KafkaConfig, Consumer, Producer, logLevel } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import {
  AnalyticsEvent,
  AnalyticsEventType,
  ANALYTICS_EVENTS_TABLE_SCHEMA,
} from './analytics-events';
import { cacheMetrics, getCachedMetrics } from './analytics.cache';

@Injectable()
export class AnalyticsIngestService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsIngestService.name);
  private kafka: Kafka;
  private consumer: Consumer;
  private producer: Producer;
  private isConnected = false;

  // Track available features for graceful degradation
  private features = {
    kafka: false,
    clickhouse: false,
    redis: true,
  };

  constructor(private readonly configService: ConfigService) {
    this.kafka = new Kafka({
      clientId: 'analytics-ingest',
      brokers: this.parseBrokers(),
      logLevel: logLevel.ERROR,
      retry: {
        initialRetryTime: 100,
        retries: 3,
      },
    });

    this.consumer = this.kafka.consumer({
      groupId: 'analytics-ingest-group',
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: false,
      transactionTimeout: 30000,
    });
  }

  async onModuleInit() {
    await this.initializeConnections();
  }

  async onModuleDestroy() {
    await this.shutdown();
  }

  private parseBrokers(): string[] {
    const brokers = this.configService.get<string>('KAFKA_BROKERS');
    if (!brokers) {
      this.logger.warn('KAFKA_BROKERS not configured, analytics will use fallback mode');
      return [];
    }
    return brokers.split(',').map((b) => b.trim());
  }

  private async initializeConnections(): Promise<void> {
    // Try to connect to Kafka
    if (this.configService.get<string>('KAFKA_BROKERS')) {
      try {
        await this.producer.connect();
        await this.consumer.connect();
        this.features.kafka = true;
        this.logger.log('Connected to Kafka for analytics');
      } catch (error) {
        this.logger.warn('Failed to connect to Kafka, using fallback mode', error);
      }
    }

    // Verify ClickHouse connection
    await this.verifyClickHouse();

    // Verify Redis connection
    await this.verifyRedis();

    this.isConnected = true;
  }

  private async verifyClickHouse(): Promise<void> {
    try {
      const clickhouse = this.getClickHouseClient();
      await clickhouse.query('SELECT 1');
      this.features.clickhouse = true;
      this.logger.log('ClickHouse connection verified');
    } catch (error) {
      this.logger.warn('ClickHouse not available, using fallback mode', error);
    }
  }

  private async verifyRedis(): Promise<void> {
    try {
      const cached = await getCachedMetrics();
      this.features.redis = true;
      this.logger.log('Redis connection verified');
    } catch (error) {
      this.logger.warn('Redis not available', error);
      this.features.redis = false;
    }
  }

  private getClickHouseClient() {
    const ClickHouse = require('@apla/clickhouse');
    return new ClickHouse({
      host: this.configService.get('CLICKHOUSE_HOST') || 'localhost',
      port: this.configService.get('CLICKHOUSE_PORT') || 8123,
      user: this.configService.get('CLICKHOUSE_USER') || 'default',
      password: this.configService.get('CLICKHOUSE_PASSWORD') || '',
      database: this.configService.get('CLICKHOUSE_DB') || 'analytics',
    });
  }

  /**
   * Track an analytics event
   * This is the main entry point for analytics events from the application
   */
  async trackEvent(
    type: AnalyticsEventType,
    payload: Record<string, unknown>,
    options: {
      userId?: string;
      sessionId?: string;
      ipAddress?: string;
      userAgent?: string;
      source?: string;
      platform?: string;
      version?: string;
      locale?: string;
      resourceType?: 'split' | 'item' | 'payment' | 'user';
      resourceId?: string;
    } = {},
  ): Promise<string> {
    const event: AnalyticsEvent = {
      id: uuidv4(),
      type,
      timestamp: new Date().toISOString(),
      actor: {
        userId: options.userId,
        sessionId: options.sessionId,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
      },
      context: {
        source: options.source || 'api',
        platform: options.platform,
        version: options.version,
        locale: options.locale,
      },
      payload,
      resource: options.resourceId
        ? {
            type: options.resourceType || 'split',
            id: options.resourceId,
          }
        : undefined,
    };

    // Always emit to internal event bus for same-process consumers
    this.emitInternalEvent(event);

    // Send to Kafka if available
    if (this.features.kafka) {
      await this.sendToKafka(event);
    }

    // Store in ClickHouse if available
    if (this.features.clickhouse) {
      await this.storeInClickHouse(event);
    }

    return event.id;
  }

  /**
   * Emit event to in-process subscribers
   */
  private emitInternalEvent(event: AnalyticsEvent): void {
    // This could use EventEmitter2 or NestJS EventEmitter
    // For now, we log at debug level
    this.logger.debug(`Analytics event: ${event.type}`, {
      id: event.id,
      resource: event.resource?.id,
    });
  }

  /**
   * Send event to Kafka for async processing
   */
  private async sendToKafka(event: AnalyticsEvent): Promise<void> {
    try {
      await this.producer.send({
        topic: 'analytics-events',
        messages: [
          {
            key: event.id,
            value: JSON.stringify(event),
            timestamp: Date.now().toString(),
            headers: {
              eventType: event.type,
            },
          },
        ],
      });
    } catch (error) {
      this.logger.error('Failed to send event to Kafka', error);
      // Fallback to direct storage
      await this.storeInClickHouse(event);
    }
  }

  /**
   * Store event directly in ClickHouse
   */
  private async storeInClickHouse(event: AnalyticsEvent): Promise<void> {
    try {
      const clickhouse = this.getClickHouseClient();

      // Ensure table exists
      await clickhouse.query(ANALYTICS_EVENTS_TABLE_SCHEMA);

      // Insert event
      await clickhouse.insert('analytics_events', {
        id: event.id,
        type: event.type,
        timestamp: new Date(event.timestamp),
        actor_user_id: event.actor.userId,
        actor_session_id: event.actor.sessionId,
        actor_ip_address: event.actor.ipAddress,
        actor_user_agent: event.actor.userAgent,
        context_source: event.context.source,
        context_platform: event.context.platform,
        context_version: event.context.version,
        context_locale: event.context.locale,
        payload: JSON.stringify(event.payload),
        resource_type: event.resource?.type,
        resource_id: event.resource?.id,
        processed_at: new Date(),
      });
    } catch (error) {
      this.logger.error('Failed to store event in ClickHouse', error);
    }
  }

  /**
   * Query analytics data from ClickHouse
   */
  async queryAnalytics<T = unknown>(sql: string): Promise<T> {
    if (!this.features.clickhouse) {
      throw new Error('ClickHouse not available');
    }

    const clickhouse = this.getClickHouseClient();
    const result = await clickhouse.query(sql);
    return result as T;
  }

  /**
   * Get daily metrics summary
   */
  async getDailyMetrics(date: Date): Promise<unknown> {
    if (!this.features.clickhouse) {
      return this.getFallbackMetrics(date);
    }

    const dateStr = date.toISOString().split('T')[0];
    const sql = `
      SELECT
        toDate(timestamp) as date,
        type,
        count() as event_count,
        uniq(actor_user_id) as unique_users
      FROM analytics_events
      WHERE toDate(timestamp) = '${dateStr}'
      GROUP BY date, type
      ORDER BY event_count DESC
    `;

    return this.queryAnalytics(sql);
  }

  /**
   * Fallback metrics when ClickHouse is unavailable
   */
  private getFallbackMetrics(date: Date): Record<string, unknown> {
    this.logger.warn('Returning fallback metrics - ClickHouse unavailable');
    return {
      date: date.toISOString().split('T')[0],
      available: false,
      message: 'Analytics storage temporarily unavailable',
    };
  }

  /**
   * Get feature availability status
   */
  getFeatures(): Record<string, boolean> {
    return { ...this.features };
  }

  /**
   * Check if analytics is fully operational
   */
  isOperational(): boolean {
    return this.isConnected;
  }

  private async shutdown(): Promise<void> {
    try {
      if (this.features.kafka) {
        await this.consumer.disconnect();
        await this.producer.disconnect();
      }
    } catch (error) {
      this.logger.error('Error during shutdown', error);
    }
  }
}
