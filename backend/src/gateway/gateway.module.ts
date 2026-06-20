import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventsGateway, WsJwtAuthGuard } from "./events.gateway";
import { WsAuthModule } from "../ws-auth/ws-auth.module";

@Module({
  imports: [ConfigModule, WsAuthModule],
  providers: [WsJwtAuthGuard, EventsGateway],
  exports: [EventsGateway],
})
export class GatewayModule {}
