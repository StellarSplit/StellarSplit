import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "crypto";
import { Socket } from "socket.io";

export interface WsJwtPayload {
  sub?: string;
  userId?: string;
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

/**
 * Shared WebSocket JWT authentication service.
 *
 * Extracts a bearer token from a Socket.IO handshake (auth payload, the
 * Authorization header, or the query string), verifies its HS256 signature
 * against JWT_SECRET, and checks expiry. Used by both the events and payment
 * gateways via DI so the verification logic lives in exactly one place.
 */
@Injectable()
export class WsJwtAuthService {
  constructor(private readonly configService: ConfigService) {}

  authenticateClient(client: Socket): WsJwtPayload {
    const rawToken = this.extractToken(client);
    if (!rawToken) {
      throw new UnauthorizedException("Missing JWT token");
    }

    const token = rawToken.replace(/^Bearer\s+/i, "").trim();
    return this.verifyToken(token);
  }

  private extractToken(client: Socket): string | undefined {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === "string" && authToken.length > 0) {
      return authToken;
    }

    const headerToken = client.handshake.headers.authorization;
    if (typeof headerToken === "string" && headerToken.length > 0) {
      return headerToken;
    }

    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === "string" && queryToken.length > 0) {
      return queryToken;
    }

    return undefined;
  }

  private verifyToken(token: string): WsJwtPayload {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new UnauthorizedException("Invalid JWT format");
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    const header = this.decodeJson(encodedHeader);
    const payload = this.decodeJson(encodedPayload) as WsJwtPayload;

    if (header.alg !== "HS256") {
      throw new UnauthorizedException("Unsupported JWT algorithm");
    }

    const secret = this.configService.get<string>("JWT_SECRET");
    if (!secret) {
      throw new UnauthorizedException("JWT secret not configured");
    }

    const expectedSignature = createHmac("sha256", secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest("base64url");

    const validSignature = this.isEqualSignature(signature, expectedSignature);
    if (!validSignature) {
      throw new UnauthorizedException("Invalid JWT signature");
    }

    if (
      typeof payload.exp === "number" &&
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      throw new UnauthorizedException("JWT token expired");
    }

    return payload;
  }

  private decodeJson(value: string): Record<string, unknown> {
    try {
      const parsed = Buffer.from(value, "base64url").toString("utf8");
      return JSON.parse(parsed) as Record<string, unknown>;
    } catch {
      throw new UnauthorizedException("Invalid JWT payload");
    }
  }

  private isEqualSignature(received: string, expected: string): boolean {
    const receivedBuffer = Buffer.from(received);
    const expectedBuffer = Buffer.from(expected);

    if (receivedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(receivedBuffer, expectedBuffer);
  }
}
