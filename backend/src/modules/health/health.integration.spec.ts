import { Global, INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { HealthModule } from './health.module';

const mockPing = jest.fn().mockResolvedValue('PONG');

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    ping: mockPing,
  }));
});

// In the running application ConfigModule is registered with `isGlobal: true`
// and TypeOrmModule.forRootAsync provides a global DataSource, so HealthModule
// resolves ConfigService and DataSource without importing them directly. This
// global mock module reproduces that ambient availability in isolation, letting
// the health endpoints be exercised without a live Postgres/Redis.
@Global()
@Module({
  providers: [
    {
      provide: ConfigService,
      useValue: {
        get: (key: string) => {
          switch (key) {
            case 'APP_VERSION':
              return '1.2.3';
            case 'REDIS_URL':
              return process.env.REDIS_URL;
            default:
              return undefined;
          }
        },
      },
    },
    {
      provide: DataSource,
      useValue: {
        query: jest.fn().mockResolvedValue([{ '1': 1 }]),
      },
    },
  ],
  exports: [ConfigService, DataSource],
})
class HealthTestDepsModule {}

describe('Health endpoint integration', () => {
  let app: INestApplication;
  let swaggerDocument: Record<string, any>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_HOST = 'localhost';
    process.env.DATABASE_PORT = '5432';
    process.env.DATABASE_USERNAME = 'test';
    process.env.DATABASE_PASSWORD = 'test';
    process.env.DATABASE_NAME = 'testdb';
    process.env.JWT_SECRET = 'testsecretkey-with-length-32-characters!';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HealthTestDepsModule, HealthModule],
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
});
