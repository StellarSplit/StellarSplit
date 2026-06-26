import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { INestApplication, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { io } from 'socket.io-client';
import { AddressInfo } from 'net';
import { PaymentGateway, WsJwtAuthService, WsPaymentAuthGuard, buildCorsConfig } from './payment.gateway';
import { SocketIoAdapter } from './socket-io.adapter';
import { AuthorizationService } from '../auth/services/authorization.service';

describe('PaymentGateway', () => {
  let gateway: PaymentGateway;
  let wsJwtAuthService: WsJwtAuthService;
  let authorizationService: jest.Mocked<AuthorizationService>;
  let mockServer: Partial<Server>;
  let mockClient: Partial<Socket>;

  beforeEach(async () => {
    authorizationService = {
      canAccessSplit: jest.fn(),
    } as unknown as jest.Mocked<AuthorizationService>;

    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    mockClient = {
      id: 'test-client-id',
      join: jest.fn(),
      leave: jest.fn(),
      disconnect: jest.fn(),
      data: {},
      handshake: {
        auth: {},
        headers: {},
        query: {},
      },
    } as unknown as Socket;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentGateway,
        WsJwtAuthService,
        WsPaymentAuthGuard,
        {
          provide: AuthorizationService,
          useValue: authorizationService,
        },
        {
          provide: ConfigService,
          useValue: new ConfigService({
            NODE_ENV: 'development',
            JWT_SECRET: 'test-secret',
          }),
        },
      ],
    }).compile();

    gateway = module.get<PaymentGateway>(PaymentGateway);
    wsJwtAuthService = module.get<WsJwtAuthService>(WsJwtAuthService);

    (gateway as any).server = mockServer;
  });

  describe('handleConnection', () => {
    it('should allow authenticated client to connect', () => {
      const token = createTestToken('user-123', 'test-secret');
      (mockClient as any).handshake = {
        auth: { token },
        headers: {},
        query: {},
      };

      gateway.handleConnection(mockClient as Socket);

      expect(mockClient.data.user).toBeDefined();
      expect(mockClient.data.user.sub).toBe('user-123');
    });

    it('should disconnect unauthorized client', () => {
      (mockClient as any).handshake = {
        auth: { token: 'invalid-token' },
        headers: {},
        query: {},
      };

      gateway.handleConnection(mockClient as Socket);

      expect(mockClient.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('handleJoinRoom', () => {
    it('should allow authorized user to join room', async () => {
      const token = createTestToken('user-123', 'test-secret');
      mockClient.data.user = { sub: 'user-123' };
      (mockClient as any).handshake = {
        auth: { token },
        headers: {},
        query: {},
      };

      authorizationService.canAccessSplit.mockResolvedValue(true);

      const result = await gateway.handleJoinRoom(
        mockClient as Socket,
        { roomId: 'split-456' },
      );

      expect(mockClient.join).toHaveBeenCalledWith('split-456');
      expect(result).toEqual({
        event: 'joined-room',
        data: { roomId: 'split-456' },
      });
    });

    it('should reject unauthorized user from joining room', async () => {
      mockClient.data.user = { sub: 'user-123' };
      (mockClient as any).handshake = {
        auth: { token: createTestToken('user-123', 'test-secret') },
        headers: {},
        query: {},
      };

      authorizationService.canAccessSplit.mockResolvedValue(false);

      await expect(
        gateway.handleJoinRoom(mockClient as Socket, { roomId: 'split-456' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject request without roomId', async () => {
      mockClient.data.user = { sub: 'user-123' };

      await expect(
        gateway.handleJoinRoom(mockClient as Socket, { roomId: '' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('handleJoinUserRoom', () => {
    it('should allow user to join their own user room', async () => {
      const token = createTestToken('user-123', 'test-secret');
      mockClient.data.user = { sub: 'user-123' };
      (mockClient as any).handshake = {
        auth: { token },
        headers: {},
        query: {},
      };

      const result = await gateway.handleJoinUserRoom(
        mockClient as Socket,
        { userId: 'user-123' },
      );

      expect(mockClient.join).toHaveBeenCalledWith('user-user-123');
      expect(result).toEqual({
        event: 'joined-user-room',
        data: { userId: 'user-123' },
      });
    });

    it('should reject user from joining another user room', async () => {
      mockClient.data.user = { sub: 'user-123' };
      (mockClient as any).handshake = {
        auth: { token: createTestToken('user-123', 'test-secret') },
        headers: {},
        query: {},
      };

      await expect(
        gateway.handleJoinUserRoom(mockClient as Socket, { userId: 'user-456' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('emitPaymentStatusUpdate', () => {
    it('should emit payment status update to room', () => {
      const payload = {
        paymentId: 'pay-123',
        status: 'completed' as const,
        timestamp: new Date().toISOString(),
      };

      gateway.emitPaymentStatusUpdate('split-456', payload);

      expect(mockServer.to).toHaveBeenCalledWith('split-456');
      expect(mockServer.emit).toHaveBeenCalledWith('payment-status-update', payload);
    });
  });

  describe('emitSplitCompletion', () => {
    it('should emit split completion to room', () => {
      const payload = {
        splitId: 'split-456',
        totalAmount: 1000,
        currency: 'XLM',
        completedAt: new Date().toISOString(),
        participantCount: 3,
        payments: [],
      };

      gateway.emitSplitCompletion('split-456', payload);

      expect(mockServer.to).toHaveBeenCalledWith('split-456');
      expect(mockServer.emit).toHaveBeenCalledWith('split-completion', payload);
    });
  });
});

function createTestToken(userId: string, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  const signature = require('crypto')
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

describe('WsJwtAuthService', () => {
  let service: WsJwtAuthService;
  let configService: ConfigService;

  beforeEach(() => {
    configService = new ConfigService({
      JWT_SECRET: 'test-secret',
      NODE_ENV: 'development',
    });
    service = new WsJwtAuthService(configService);
  });

  it('should authenticate valid token', () => {
    const token = createTestToken('user-123', 'test-secret');
    const mockClient = {
      handshake: {
        auth: { token },
        headers: {},
        query: {},
      },
    } as unknown as Socket;

    const result = service.authenticateClient(mockClient);

    expect(result.sub).toBe('user-123');
  });

  it('should reject missing token', () => {
    const mockClient = {
      handshake: {
        auth: {},
        headers: {},
        query: {},
      },
    } as unknown as Socket;

    expect(() => service.authenticateClient(mockClient)).toThrow(UnauthorizedException);
  });

  it('should reject invalid token', () => {
    const mockClient = {
      handshake: {
        auth: { token: 'invalid-token' },
        headers: {},
        query: {},
      },
    } as unknown as Socket;

    expect(() => service.authenticateClient(mockClient)).toThrow(UnauthorizedException);
  });
});

describe('CORS Configuration', () => {
  it('should use allowed origins in production', () => {
    const configService = new ConfigService({
      NODE_ENV: 'production',
      JWT_SECRET: 'test-secret',
      CORS_ALLOWED_ORIGINS: 'https://app.example.com,https://admin.example.com',
    });

    const corsConfig = buildCorsConfig(configService);
    expect(corsConfig.origin).toEqual(['https://app.example.com', 'https://admin.example.com']);
  });

  it('should use localhost origins in development', () => {
    const configService = new ConfigService({
      NODE_ENV: 'development',
      JWT_SECRET: 'test-secret',
    });

    const corsConfig = buildCorsConfig(configService);
    expect(corsConfig.origin).toContain('http://localhost:3000');
  });
});

describe('WebSocket CORS integration', () => {
  let app: INestApplication;
  let port: number;
  const allowedOrigin = 'http://allowed.example.com';

  beforeEach(async () => {
    const authorizationService = {
      canAccessSplit: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<AuthorizationService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentGateway,
        WsJwtAuthService,
        WsPaymentAuthGuard,
        {
          provide: AuthorizationService,
          useValue: authorizationService,
        },
        {
          provide: ConfigService,
          useValue: new ConfigService({ JWT_SECRET: 'test-secret', NODE_ENV: 'production' }),
        },
      ],
    }).compile();

    app = module.createNestApplication();
    const corsOptions = {
      origin: [allowedOrigin],
      credentials: true,
      methods: ['GET', 'POST'],
    };

    app.enableCors(corsOptions);
    app.useWebSocketAdapter(new SocketIoAdapter(app, corsOptions));
    await app.listen(0);

    const server = app.getHttpServer();
    const address = server.address() as AddressInfo;
    port = address?.port ?? 0;
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should allow socket connections from an allowed origin', async () => {
    const token = createTestToken('user-123', 'test-secret');
    const client = io(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      auth: { token },
      extraHeaders: { Origin: allowedOrigin },
      forceNew: true,
    });

    await new Promise<void>((resolve, reject) => {
      client.on('connect', () => {
        client.close();
        resolve();
      });
      client.on('connect_error', reject);
      setTimeout(() => reject(new Error('Socket connection timed out')), 2000);
    });
  });

  it('should reject socket connections from a disallowed origin in production', async () => {
    const token = createTestToken('user-123', 'test-secret');
    const client = io(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      auth: { token },
      extraHeaders: { Origin: 'http://disallowed.example.com' },
      forceNew: true,
      rejectUnauthorized: false,
    });

    await expect(
      new Promise<void>((resolve, reject) => {
        client.on('connect', () => reject(new Error('Connection should not be allowed')));
        client.on('connect_error', () => {
          client.close();
          resolve();
        });
        setTimeout(() => reject(new Error('Socket connection timed out')), 2000);
      }),
    ).resolves.toBeUndefined();
  });
});