import { useEffect, useRef } from 'react';
import { useSocketStore } from '../stores/socketStore';

/**
 * Subscribe to a socket room/event with automatic cleanup.
 * Handles the repeated pattern of emit subscribe, listen, cleanup off + unsubscribe.
 *
 * The `handlerRef` pattern ensures handler closure changes don't trigger
 * re-subscriptions — only socket/event/subscription changes do.
 */
export function useSocketSubscription<T>(
  listenEvent: string,
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

    if (options?.subscribeEvent) {
      if (options.subscribeArg !== undefined) {
        socket.emit(options.subscribeEvent as any, options.subscribeArg);
      } else {
        socket.emit(options.subscribeEvent as any);
      }
    }

    socket.on(listenEvent as any, stableHandler);

    return () => {
      if (options?.unsubscribeEvent) {
        if (options.subscribeArg !== undefined) {
          socket.emit(options.unsubscribeEvent as any, options.subscribeArg);
        } else {
          socket.emit(options.unsubscribeEvent as any);
        }
      }
      socket.off(listenEvent as any, stableHandler);
    };
  }, [socket, listenEvent, options?.subscribeEvent, options?.unsubscribeEvent, options?.subscribeArg]);
}
