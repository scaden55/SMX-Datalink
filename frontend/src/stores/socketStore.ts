import { create } from 'zustand';
import type { Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@acars/shared';

export type AcarsSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SocketState {
  socket: AcarsSocket | null;
  setSocket: (socket: AcarsSocket | null) => void;
}

export const useSocketStore = create<SocketState>((set) => ({
  socket: null,
  setSocket: (socket) => set({ socket }),
}));
