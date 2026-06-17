import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { HealthCheckService } from './health-check.service';
import { OcrWorkerPool } from '../../ocr/ocr-worker.pool';

const mockPing = jest.fn().mockResolvedValue('PONG');

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    ping: mockPing,
  }));
});

describe('Health endpoint integration', () => {
  let app: INestApplication;
  let swaggerDocument: Record<string, any>;
  let mockOcrPool: { getHealthStatus: jest.Mock };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_HOST = 'localhost';
    process.env.DATABASE_PORT = '5432';
    process.env.DATABASE_USERNAME = 'test';
    process.env.DATABASE_PASSWORD = 'test';
    process.env.DATABASE_NAME = 'testdb';
    process.env.JWT_SECRET = 'testsecretkey-with-length-32-characters!';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';

    mockOcrPool = { getHealthStatus: jest.fn().mockReturnValue({ total: 2, available: 2, failed: 0 }) };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        HealthCheckService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              switch (key) {
                case 'APP_VERSION': return '1.2.3';
                case 'REDIS_URL': return process.env.REDIS_URL;
                default: return undefined;
              }
            },
          },
        },
        {
          provide: DataSource,
          useValue: { query: jest.fn().mockResolvedValue([{ '1': 1 }]) },
        },
        {
          provide: OcrWorkerPool,
          useValue: mockOcrPool,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    swaggerDocument = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Health API').setVersion('1.0.0').build(),
    );
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('registers only canonical health endpoints', () => {
    const paths = Object.keys(swaggerDocument.paths || {}).filter((path) => path.startsWith('/health'));
    expect(paths).toEqual(expect.arrayContaining(['/health', '/health/live', '/health/ready']));
    expect(paths).toHaveLength(3);
  });

  it('returns basic health at /health', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    expect(response.body).toMatchObject({ status: 'healthy', version: '1.2.3' });
    expect(typeof response.body.uptime).toBe('number');
  });

  it('returns liveness details at /health/live', async () => {
    const response = await request(app.getHttpServer()).get('/health/live').expect(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body.environment).toEqual(expect.objectContaining({ nodeEnv: 'test' }));
  });

  it('returns readiness details at /health/ready', async () => {
    const response = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body.checks).toEqual(expect.objectContaining({
      database: expect.objectContaining({ status: 'up' }),
      redis: expect.objectContaining({ status: 'up' }),
      environment: expect.objectContaining({ status: 'up' }),
    }));
  });

  it('includes ocr status with workers count in /health/ready', async () => {
    const response = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(response.body.checks.ocr).toEqual({ status: 'up', workers: 2 });
  });

  it('reports ocr as down when no workers are available', async () => {
    mockOcrPool.getHealthStatus.mockReturnValueOnce({ total: 2, available: 0, failed: 2 });
    const response = await request(app.getHttpServer()).get('/health/ready');
    expect(response.body.checks.ocr).toEqual({ status: 'down', workers: 0 });
  });
});
