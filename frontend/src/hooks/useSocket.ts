import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@acars/shared';
import { useTelemetryStore } from '../stores/telemetryStore';
import { useAuthStore } from '../stores/authStore';
import { useSocketStore } from '../stores/socketStore';

type AcarsSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function useSocket(): AcarsSocket | null {
  const socketRef = useRef<AcarsSocket | null>(null);
  const setSnapshot = useTelemetryStore((s) => s.setSnapshot);
  const setConnectionStatus = useTelemetryStore((s) => s.setConnectionStatus);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setSocket = useSocketStore((s) => s.setSocket);
  const tokenRef = useRef(accessToken);

  // Update auth on existing socket in-place instead of tearing down and reconnecting
  // This prevents the visible "blink" in connection state on every token refresh
  useEffect(() => {
    tokenRef.current = accessToken;
    if (socketRef.current && accessToken) {
      socketRef.current.auth = { token: accessToken };
    }
  }, [accessToken]);

  useEffect(() => {
    if (!tokenRef.current) return;

    const socket: AcarsSocket = io({
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
      auth: { token: tokenRef.current },
    });

    socketRef.current = socket;
    setSocket(socket as any);

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
      setSocket(null);
    };
  }, [setSnapshot, setConnectionStatus, setSocket]); // accessToken removed from deps

  return socketRef.current;
}
