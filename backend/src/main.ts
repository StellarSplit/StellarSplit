import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import 'reflect-metadata';
import { AppModule } from './app.module';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';
import { TypeOrmExceptionFilter } from './common/filters/typeorm-exception.filter';
import { validateEnvironment, Environment } from './config/env.validation';
import { SocketIoAdapter } from './websocket/socket-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // ============================================================
  // STRICT ENVIRONMENT VALIDATION (run before any other startup)
  // ============================================================
  const nodeEnv = configService.get<string>('NODE_ENV') || 'development';
  
  // Build config object for validation
  const envConfig = {
    NODE_ENV: nodeEnv,
    DATABASE_HOST: configService.get<string>('DATABASE_HOST'),
    DATABASE_PORT: configService.get<number>('DATABASE_PORT'),
    DATABASE_USERNAME: configService.get<string>('DATABASE_USERNAME'),
    DATABASE_PASSWORD: configService.get<string>('DATABASE_PASSWORD'),
    DATABASE_NAME: configService.get<string>('DATABASE_NAME'),
    JWT_SECRET: configService.get<string>('JWT_SECRET'),
    REDIS_URL: configService.get<string>('REDIS_URL'),
    DATABASE_SSL: configService.get<string>('DATABASE_SSL'),
    DEBUG: configService.get<string>('DEBUG'),
    CORS_ORIGIN: configService.get<string>('CORS_ORIGIN'),
  };

  // Validate environment configuration
  const validation = validateEnvironment(envConfig);
  
  if (!validation.isValid) {
    const errorMsg = `Environment validation failed:\n${validation.errors.join('\n')}`;
    console.error('❌ ' + errorMsg);
    
    // In production, fail fast on missing required config
    if (nodeEnv === Environment.PRODUCTION) {
      process.exit(1);
    }
  }

  // Log warnings
  if (validation.warnings.length > 0) {
    console.warn('⚠️ Environment warnings:');
    validation.warnings.forEach(w => console.warn('  - ' + w));
  }

  // ============================================================
  // ENABLE GLOBAL VALIDATION PIPE
  // ============================================================
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filters
  app.useGlobalFilters(new GlobalHttpExceptionFilter(), new TypeOrmExceptionFilter());

  // Enable URI versioning: /api/v1/...
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Set global API prefix
  app.setGlobalPrefix('api');

  // ============================================================
  // SAFER CORS DEFAULTS FOR PRODUCTION
  // ============================================================
  const corsOptions = {
    origin: nodeEnv === Environment.PRODUCTION 
      ? configService.get<string[]>('ALLOWED_ORIGINS') || []  // Explicit whitelist in production
      : configService.get<string>('CORS_ORIGIN') || true,       // Permissive in dev
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400, // 24 hours preflight cache
  };
  
  // Security middleware and production hardening are centralized in SecurityModule.
  app.enableCors(corsOptions);
  app.useWebSocketAdapter(
    new SocketIoAdapter(app, {
      origin: corsOptions.origin,
      credentials: true,
      methods: ['GET', 'POST'],
    }),
  );

  // Configure Swagger
  const appConfig = configService.get('app');
  const config = new DocumentBuilder()
    .setTitle(appConfig.swagger.title)
    .setDescription(appConfig.swagger.description)
    .setVersion(appConfig.swagger.version)
    .addBearerAuth()
    .addTag('Health', 'Application health checks')
    .addTag('Receipts', 'OCR receipt scanning and parsing')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(appConfig.swagger.path, app, document);

  const port = appConfig.port;
  await app.listen(port);
  console.log(`✅ NestJS application running on http://localhost:${port}`);
  console.log(`📚 Swagger documentation available at http://localhost:${port}${appConfig.swagger.path}`);
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});
