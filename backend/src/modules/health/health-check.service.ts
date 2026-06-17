import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { validateEnvironment, getEnvironmentInfo, Environment } from '../../config/env.validation';
import { OcrWorkerPool } from '../../ocr/ocr-worker.pool';

export type HealthStatus = {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  uptime: number;
};

export type ComponentHealth = {
  status: 'up' | 'down' | 'degraded';
  latencyMs?: number;
  error?: string;
  workers?: number;
};

export interface ReadinessResponse extends HealthStatus {
  checks: {
    database: ComponentHealth;
    redis: ComponentHealth;
    environment: ComponentHealth;
    ocr: ComponentHealth;
  };
}

export interface LivenessResponse extends HealthStatus {
  environment: ReturnType<typeof getEnvironmentInfo>;
}

@Injectable()
export class HealthCheckService {
  private readonly logger = new Logger(HealthCheckService.name);
  private readonly startTime = Date.now();
  private redis: Redis | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    @Optional() private readonly ocrWorkerPool?: OcrWorkerPool,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
      });
    }
  }

  getBasicHealth(): HealthStatus {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: this.configService.get<string>('APP_VERSION') || '1.0.0',
      uptime: this.getUptimeSeconds(),
    };
  }

  getLiveness(): LivenessResponse {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: this.configService.get<string>('APP_VERSION') || '1.0.0',
      uptime: this.getUptimeSeconds(),
      environment: getEnvironmentInfo(),
    };
  }

  async getReadiness(): Promise<ReadinessResponse> {
    const checks = {
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
      environment: this.checkEnvironment(),
      ocr: this.checkOcr(),
    };

    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (checks.database.status === 'down' || checks.environment.status === 'down') {
      status = 'unhealthy';
    } else if (checks.database.status === 'degraded' || checks.redis.status === 'degraded') {
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      version: this.configService.get<string>('APP_VERSION') || '1.0.0',
      uptime: this.getUptimeSeconds(),
      checks,
    };
  }

  private checkOcr(): ComponentHealth {
    if (!this.ocrWorkerPool) {
      return { status: 'degraded', error: 'OCR pool not configured' };
    }
    const { available } = this.ocrWorkerPool.getHealthStatus();
    return {
      status: available > 0 ? 'up' : 'down',
      workers: available,
    };
  }

  private getUptimeSeconds(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  private async checkDatabase(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'up',
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkRedis(): Promise<ComponentHealth> {
    if (!this.redis) {
      return {
        status: 'degraded',
        error: 'Redis client not configured',
      };
    }

    const start = Date.now();
    try {
      await this.redis.ping();
      return {
        status: 'up',
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      this.logger.error('Redis health check failed', error);
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private checkEnvironment(): ComponentHealth {
    const envConfig = {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_HOST: process.env.DATABASE_HOST,
      DATABASE_PORT: process.env.DATABASE_PORT,
      DATABASE_USERNAME: process.env.DATABASE_USERNAME,
      DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
      DATABASE_NAME: process.env.DATABASE_NAME,
      JWT_SECRET: process.env.JWT_SECRET,
      REDIS_URL: process.env.REDIS_URL,
      DEBUG: process.env.DEBUG,
      CORS_ORIGIN: process.env.CORS_ORIGIN,
      DATABASE_SSL: process.env.DATABASE_SSL,
    };

    const validation = validateEnvironment(envConfig);
    const isProduction = process.env.NODE_ENV === Environment.PRODUCTION;

    if (!validation.isValid) {
      return {
        status: 'down',
        error: validation.errors.join('; '),
      };
    }

    if (validation.warnings.length > 0 && isProduction) {
      return {
        status: 'degraded',
        error: validation.warnings.join('; '),
      };
    }

    return {
      status: 'up',
    };
  }
}
