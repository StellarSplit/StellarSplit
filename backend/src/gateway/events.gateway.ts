import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { AuthorizationService } from "../auth/services/authorization.service";
import { WsJwtAuthService, WsJwtPayload } from "../ws-auth/ws-auth.service";
import {
  JoinSplitPayload,
  LeaveSplitPayload,
  SplitActivityPayload,
  SplitPresencePayload,
  JoinedSplitEvent,
  LeftSplitEvent,
  ParticipantJoinedEvent,
  PaymentReceivedEvent,
  SplitActivityBroadcastEvent,
  SplitPresenceEvent,
  SplitUpdatedEvent,
  WsHandlerResponse,
} from "./ws-events.types";

// Re-exported for backwards compatibility with existing import sites.
export { WsJwtAuthService };
export type { WsJwtPayload };

@Injectable()
export class WsJwtAuthGuard implements CanActivate {
  constructor(
    private readonly wsJwtAuthService: WsJwtAuthService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>();
    const payload = this.wsJwtAuthService.authenticateClient(client);
    client.data.user = payload;
    return true;
  }
}

@WebSocketGateway({
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly wsJwtAuthService: WsJwtAuthService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  afterInit(): void {
    this.logger.log("Events gateway initialized");
  }

  handleConnection(client: Socket): void {
    try {
      const payload = this.wsJwtAuthService.authenticateClient(client);
      client.data.user = payload;
      this.logger.log(`Client connected: ${client.id}`);
    } catch (error) {
      this.logger.warn(`Unauthorized socket connection rejected: ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage("join_split")
  async handleJoinSplit(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinSplitPayload,
  ): Promise<WsHandlerResponse<JoinedSplitEvent>> {
    if (!payload?.splitId) {
      throw new BadRequestException("splitId is required");
    }

    const userId = (client.data.user as WsJwtPayload)?.sub;
    if (!userId) {
      throw new UnauthorizedException("Authenticated user required");
    }

    const canAccess = await this.authorizationService.canAccessSplit(
      userId,
      payload.splitId,
    );

    if (!canAccess) {
      throw new UnauthorizedException("Not allowed to join this split");
    }

    const room = this.getSplitRoom(payload.splitId);
    client.join(room);
    return {
      event: "joined_split",
      data: {
        splitId: payload.splitId,
        room,
      },
    };
  }

  emitPaymentReceived(splitId: string, data: PaymentReceivedEvent): void {
    this.server.to(this.getSplitRoom(splitId)).emit("payment_received", data);
  }

  emitSplitUpdated(splitId: string, data: SplitUpdatedEvent): void {
    this.server.to(this.getSplitRoom(splitId)).emit("split_updated", data);
  }

  emitParticipantJoined(splitId: string, data: ParticipantJoinedEvent): void {
    this.server.to(this.getSplitRoom(splitId)).emit("participant_joined", data);
  }

  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage("leave_split")
  async handleLeaveSplit(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LeaveSplitPayload,
  ): Promise<WsHandlerResponse<LeftSplitEvent>> {
    if (!payload?.splitId) {
      throw new BadRequestException("splitId is required");
    }

    const room = this.getSplitRoom(payload.splitId);
    client.leave(room);

    return {
      event: "left_split",
      data: { splitId: payload.splitId, room },
    };
  }

  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage("split_presence")
  async handleSplitPresence(
    @MessageBody() payload: SplitPresencePayload,
  ): Promise<WsHandlerResponse<SplitPresenceEvent>> {
    if (!payload?.splitId) {
      throw new BadRequestException("splitId is required");
    }

    const room = this.getSplitRoom(payload.splitId);
    const roomData = this.server.sockets.adapter.rooms.get(room);
    const participants = roomData ? Array.from(roomData) : [];

    return {
      event: "split_presence",
      data: { splitId: payload.splitId, participants },
    };
  }

  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage("split_activity")
  async handleSplitActivity(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: SplitActivityPayload,
  ): Promise<WsHandlerResponse<SplitActivityBroadcastEvent>> {
    if (!payload?.splitId || !payload?.activity) {
      throw new BadRequestException("splitId and activity are required");
    }

    const room = this.getSplitRoom(payload.splitId);
    this.server.to(room).emit("split_activity", {
      splitId: payload.splitId,
      activity: payload.activity,
    });

    return {
      event: "split_activity_broadcast",
      data: { splitId: payload.splitId, activity: payload.activity },
    };
  }

  private getSplitRoom(splitId: string): string {
    return `split:${splitId}`;
  }
}
