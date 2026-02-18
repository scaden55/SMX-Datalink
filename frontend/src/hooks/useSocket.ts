import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@acars/shared';
import { useTelemetryStore } from '../stores/telemetryStore';
import { useAuthStore } from '../stores/authStore';

type AcarsSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function useSocket(): AcarsSocket | null {
  const socketRef = useRef<AcarsSocket | null>(null);
  const setSnapshot = useTelemetryStore((s) => s.setSnapshot);
  const setConnectionStatus = useTelemetryStore((s) => s.setConnectionStatus);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) return;

    const socket: AcarsSocket = io({
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
      auth: { token: accessToken },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected');
      socket.emit('telemetry:subscribe');
    });

    socket.on('telemetry:update', (data) => {
      setSnapshot(data);
    });

    socket.on('connection:status', (status) => {
      setConnectionStatus(status);
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
    });

    return () => {
      socket.emit('telemetry:unsubscribe');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [setSnapshot, setConnectionStatus, accessToken]);

  return socketRef.current;
}
