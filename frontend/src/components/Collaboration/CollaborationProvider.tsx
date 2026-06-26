import {
  createContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { Socket } from 'socket.io-client';
import type {
  PresenceUser,
  ActivityEvent,
  ConflictInfo,
  CollaborationState,
  SplitUpdate,
} from '../../types/collaboration';
import {
  createCollaborationSocket,
  type ServerToClientEvents,
  type ClientToServerEvents,
} from '../../services/collaborationClient';
import { getStoredAuthToken } from '../../utils/session';

export type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface CollaborationContextType extends CollaborationState {
  wsStatus: WsStatus;
  joinSplit: (splitId: string, user: Partial<PresenceUser>) => void;
  leaveSplit: () => void;
  setTyping: (isTyping: boolean) => void;
  sendUpdate: (update: Omit<SplitUpdate, 'timestamp'>) => void;
  resolveConflict: (field: string, resolution: 'local' | 'remote' | 'merge') => void;
  updateCursor: (x: number, y: number) => void;
}

export const CollaborationContext = createContext<CollaborationContextType | undefined>(
  undefined,
);

export function CollaborationProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);
  const [connected, setConnected] = useState(false);
  const [wsStatus, setWsStatus] = useState<WsStatus>('disconnected');
  const [presence, setPresence] = useState<Record<string, PresenceUser>>({});
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);

  const currentSplitId = useRef<string | null>(null);
  const currentUser = useRef<Partial<PresenceUser>>({});

  // Socket creation is deferred until a valid auth token exists.
  // This prevents connecting with an undefined token at module load time.
  useEffect(() => {
    const token = getStoredAuthToken();
    if (!token) return;

    setWsStatus('connecting');
    const newSocket = createCollaborationSocket(token);

    newSocket.on('connect', () => {
      setConnected(true);
      setWsStatus('connected');
      if (currentSplitId.current) {
        // Payload aligned with server JoinSplitPayload: only splitId expected
        newSocket.emit('join_split', { splitId: currentSplitId.current });
      }
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      setWsStatus('disconnected');
    });

    newSocket.on('connect_error', () => {
      setWsStatus('error');
    });

    newSocket.on('participant_joined', (user: PresenceUser) => {
      setPresence((prev) => ({ ...prev, [user.userId]: user }));
    });

    newSocket.on('participant_left', (userId: string) => {
      setPresence((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    });

    newSocket.on('split_activity', (activity: ActivityEvent) => {
      setActivities((prev) => [activity, ...prev].slice(0, 50));
    });

    newSocket.on('split_updated', (_update: SplitUpdate) => {
      // State update wired to store in follow-up
    });

    newSocket.on('cursor_updated', ({ userId, coords }) => {
      setPresence((prev) => ({
        ...prev,
        [userId]: { ...prev[userId], cursor: coords },
      }));
    });

    // Connect only after listeners are attached and token is confirmed
    newSocket.connect();
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      setSocket(null);
      setWsStatus('disconnected');
    };
  }, []);

  const joinSplit = useCallback(
    (splitId: string, user: Partial<PresenceUser>) => {
      currentSplitId.current = splitId;
      currentUser.current = user;

      if (socket?.connected) {
        // Only splitId - matches server JoinSplitPayload interface
        socket.emit('join_split', { splitId });
      }
    },
    [socket],
  );

  const leaveSplit = useCallback(() => {
    if (socket && currentSplitId.current) {
      socket.emit('leave_split', { splitId: currentSplitId.current });
    }
    currentSplitId.current = null;
    setPresence({});
    setActivities([]);
  }, [socket]);

  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (socket && currentSplitId.current) {
        socket.emit('split_activity', {
          splitId: currentSplitId.current,
          activity: {
            type: 'custom',
            message: isTyping ? 'is typing...' : '',
            isTyping,
            userId: currentUser.current?.userId,
          },
        });
      }
    },
    [socket],
  );

  const sendUpdate = useCallback(
    (update: Omit<SplitUpdate, 'timestamp'>) => {
      if (socket && currentSplitId.current) {
        const fullUpdate: SplitUpdate = { ...update, timestamp: new Date() };
        socket.emit('split_activity', {
          splitId: currentSplitId.current,
          activity: fullUpdate,
        });
      }
    },
    [socket],
  );

  const resolveConflict = useCallback(
    (field: string, _resolution: 'local' | 'remote' | 'merge') => {
      setConflicts((prev) => prev.filter((c) => c.field !== field));
    },
    [],
  );

  const updateCursor = useCallback(
    (x: number, y: number) => {
      if (socket && currentSplitId.current) {
        socket.emit('cursor_move', {
          splitId: currentSplitId.current,
          userId: currentUser.current?.userId,
          coords: { x, y },
        });
      }
    },
    [socket],
  );

  const value: CollaborationContextType = {
    connected,
    wsStatus,
    presence,
    activities,
    conflicts,
    joinSplit,
    leaveSplit,
    setTyping,
    sendUpdate,
    resolveConflict,
    updateCursor,
  };

  return (
    <CollaborationContext.Provider value={value}>
      {children}
    </CollaborationContext.Provider>
  );
}