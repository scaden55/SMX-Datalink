import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@acars/shared';

export type AcarsSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SocketState {
  socket: AcarsSocket | null;
  connected: boolean;
  connect: (token: string) => void;
  disconnect: () => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  connected: false,

  connect: (token: string) => {
    const existing = get().socket;
    if (existing) return;

    const socket: AcarsSocket = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      set({ connected: true });
    });

    socket.on('disconnect', () => {
      set({ connected: false });
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, connected: false });
    }
  },
}));
