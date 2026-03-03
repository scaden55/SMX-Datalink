import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@acars/shared';

export type AcarsSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SocketState {
  socket: AcarsSocket | null;
  connected: boolean;
  connecting: boolean;
  connect: (token: string) => void;
  disconnect: () => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  connected: false,
  connecting: false,

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
      set({ socket: null, connected: false, connecting: false });
    }
  },
}));
