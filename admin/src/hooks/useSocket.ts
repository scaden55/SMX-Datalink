import { useEffect, useRef } from 'react';
import { useSocketStore } from '@/stores/socketStore';

/**
 * Subscribe to a socket event with automatic cleanup.
 * Uses a stable handler ref so handler closure changes
 * don't trigger re-subscriptions.
 */
export function useSocket<T>(
  event: string,
  handler: (data: T) => void,
  options?: {
    subscribeEvent?: string;
    unsubscribeEvent?: string;
    subscribeArg?: unknown;
  },
): void {
  const socket = useSocketStore((s) => s.socket);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!socket) return;

    const stableHandler = (data: T) => handlerRef.current(data);

    // Emit subscribe event if specified
    if (options?.subscribeEvent) {
      if (options.subscribeArg !== undefined) {
        socket.emit(options.subscribeEvent as any, options.subscribeArg);
      } else {
        socket.emit(options.subscribeEvent as any);
      }
    }

    socket.on(event as any, stableHandler);

    return () => {
      if (options?.unsubscribeEvent) {
        if (options.subscribeArg !== undefined) {
          socket.emit(options.unsubscribeEvent as any, options.subscribeArg);
        } else {
          socket.emit(options.unsubscribeEvent as any);
        }
      }
      socket.off(event as any, stableHandler);
    };
  }, [socket, event, options?.subscribeEvent, options?.unsubscribeEvent, options?.subscribeArg]);
}
