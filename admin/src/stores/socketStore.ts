import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@acars/shared';

export type AcarsSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SocketState {
  socket: AcarsSocket | null;
  connected: boolean;
  connecting: boolean;
  /** Number of active page consumers — socket disconnects when it hits 0 */
  refCount: number;
  connect: (token: string) => void;
  disconnect: () => void;
  /** Call on mount from pages that need the socket; returns cleanup fn for useEffect */
  acquire: (token: string) => () => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  connected: false,
  connecting: false,
  refCount: 0,

  connect: (token: string) => {
    const existing = get().socket;
    if (existing) return;

    set({ connecting: true });

    const socket: AcarsSocket = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      set({ connected: true, connecting: false });
    });

    socket.on('disconnect', () => {
      set({ connected: false, connecting: true });
    });

    socket.on('connect_error', () => {
      set({ connected: false, connecting: true });
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, connected: false, connecting: false, refCount: 0 });
    }
  },

  acquire: (token: string) => {
    const { connect } = get();
    connect(token);
    set((s) => ({ refCount: s.refCount + 1 }));
    return () => {
      const next = get().refCount - 1;
      set({ refCount: next });
      if (next <= 0) {
        get().disconnect();
      }
    };
  },
}));
