import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { WsJwtAuthService } from "./ws-auth.service";

/**
 * Provides the shared WsJwtAuthService for WebSocket gateways.
 *
 * Any module with a gateway that needs WebSocket JWT authentication should
 * import WsAuthModule rather than registering its own WsJwtAuthService, so a
 * single instance is shared and the verification logic cannot drift.
 */
@Module({
  imports: [ConfigModule],
  providers: [WsJwtAuthService],
  exports: [WsJwtAuthService],
})
export class WsAuthModule {}
