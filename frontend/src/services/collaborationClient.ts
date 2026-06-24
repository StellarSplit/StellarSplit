import { io, Socket } from 'socket.io-client';
import { BASE_API_URL } from '../constants/api';
import type { PresenceUser, ActivityEvent, ConflictInfo, SplitUpdate } from '../types/collaboration';

/**
 * Socket event payload types for type-safe event handling.
 */
export interface ServerToClientEvents {
  connect: () => void;
  disconnect: () => void;
  participant_joined: (user: PresenceUser) => void;
  participant_left: (userId: string) => void;
  split_activity: (activity: ActivityEvent) => void;
  split_updated: (update: SplitUpdate) => void;
  cursor_updated: (payload: { userId: string; coords: { x: number; y: number } }) => void;
}

/**
 * Client-to-server event payloads - must match server JoinSplitPayload exactly.
 */
export interface ClientToServerEvents {
  join_split: (payload: { splitId: string }) => void;
  leave_split: (payload: { splitId: string }) => void;
  split_activity: (payload: { splitId: string; activity: ActivityEvent }) => void;
  cursor_move: (payload: {
    splitId: string;
    userId: string | undefined;
    coords: { x: number; y: number };
  }) => void;
}

/**
 * Creates a typed Socket.io client for collaboration features.
 *
 * The socket is created with autoConnect: false so the caller decides
 * when to call socket.connect() - only after a valid auth token exists.
 *
 * @param token - Auth token obtained post-login. Passed as socket auth so
 *                the server can authenticate the handshake.
 */
export function createCollaborationSocket(
  token: string | null,
): Socket<ServerToClientEvents, ClientToServerEvents> {
  const url = new URL(
    BASE_API_URL.startsWith('http') ? BASE_API_URL : window.location.origin,
  );
  const socketUrl = `${url.protocol}//${url.host}`;

  return io(socketUrl, {
    path: '/socket.io',
    auth: { token },
    autoConnect: false,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    reconnectionAttempts: 10,
  });
}