import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  JoinRoomPayload,
  JoinUserRoomPayload,
  JoinedRoomEvent,
  JoinedUserRoomEvent,
  PaymentStatusUpdatePayload,
  SplitCompletionPayload,
  PaymentNotificationPayload,
  ActivityNewPayload,
  ActivityReadPayload,
  WsHandlerResponse,
  WsJwtPayload,
} from './payment-events.types';
import { AuthorizationService } from '../auth/services/authorization.service';
import { WsJwtAuthService } from '../ws-auth/ws-auth.service';

// Re-exported for backwards compatibility with existing import sites.
export { WsJwtAuthService };

@Injectable()
export class WsPaymentAuthGuard implements CanActivate {
  constructor(
    private readonly wsJwtAuthService: WsJwtAuthService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>();
    const payload = this.wsJwtAuthService.authenticateClient(client);
    client.data.user = payload;
    return true;
  }
}

export function buildCorsConfig(configService: ConfigService): {
  origin: string | string[];
  methods: string[];
  credentials: boolean;
} {
  const env = configService.get<string>('NODE_ENV', 'development');
  const allowedOrigins = configService.get<string>('CORS_ALLOWED_ORIGINS');

  let origin: string | string[];
  if (allowedOrigins) {
    origin = allowedOrigins.split(',').map((o) => o.trim());
  } else if (env === 'production') {
    origin = configService.get<string>('APP_URL', 'https://stellarsplit.com');
  } else {
    origin = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
    ];
  }

  return {
    origin,
    methods: ['GET', 'POST'],
    credentials: true,
  };
}

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
})
export class PaymentGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: Server;
  private logger: Logger = new Logger('PaymentGateway');

  constructor(
    private readonly wsJwtAuthService: WsJwtAuthService,
    private readonly authorizationService: AuthorizationService,
  ) {}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
  afterInit(_server: Server) {
    this.logger.log('PaymentGateway initialized');
  }

  handleConnection(client: Socket): void {
    try {
      const payload = this.wsJwtAuthService.authenticateClient(client);
      client.data.user = payload;
      this.logger.log(`Client connected: ${client.id}`);
    } catch {
      this.logger.warn(`Unauthorized socket connection rejected: ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @UseGuards(WsPaymentAuthGuard)
  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomPayload,
  ): Promise<WsHandlerResponse<JoinedRoomEvent>> {
    if (!payload?.roomId) {
      throw new BadRequestException('roomId is required');
    }

    const userId = (client.data.user as WsJwtPayload)?.sub;
    if (!userId) {
      throw new UnauthorizedException('Authenticated user required');
    }

    const canAccess = await this.authorizationService.canAccessSplit(
      userId,
      payload.roomId,
    );

    if (!canAccess) {
      throw new UnauthorizedException('Not allowed to join this room');
    }

    client.join(payload.roomId);
    return { event: 'joined-room', data: { roomId: payload.roomId } };
  }

  emitPaymentStatusUpdate(roomId: string, data: PaymentStatusUpdatePayload): void {
    this.server.to(roomId).emit('payment-status-update', data);
  }

  emitSplitCompletion(roomId: string, data: SplitCompletionPayload): void {
    this.server.to(roomId).emit('split-completion', data);
  }

  emitPaymentNotification(roomId: string, data: PaymentNotificationPayload): void {
    this.server.to(roomId).emit('payment-notification', data);
  }

  sendActivityUpdate(userId: string, activity: ActivityNewPayload): void {
    this.server.to(`user-${userId}`).emit('activity-new', activity);
  }

  sendActivityReadUpdate(userId: string, activityIds: string[]): void {
    this.server.to(`user-${userId}`).emit('activity-read', { activityIds } as ActivityReadPayload);
  }

  sendActivityReadAllUpdate(userId: string): void {
    this.server.to(`user-${userId}`).emit('activity-read-all', {});
  }

  @UseGuards(WsPaymentAuthGuard)
  @SubscribeMessage('join-user-room')
  async handleJoinUserRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinUserRoomPayload,
  ): Promise<WsHandlerResponse<JoinedUserRoomEvent>> {
    if (!payload?.userId) {
      throw new BadRequestException('userId is required');
    }

    const userId = (client.data.user as WsJwtPayload)?.sub;
    if (!userId) {
      throw new UnauthorizedException('Authenticated user required');
    }

    if (payload.userId !== userId) {
      throw new UnauthorizedException('Cannot join another user room');
    }

    client.join(`user-${payload.userId}`);
    return { event: 'joined-user-room', data: { userId: payload.userId } };
  }
}

export { PaymentGateway as WebSocketGateway };