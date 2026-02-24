import { useEffect, useRef } from 'react';
import type { VatsimDataSnapshot, VatsimUpdateEvent } from '@acars/shared';
import { useVatsimStore } from '../stores/vatsimStore';
import { useSocketStore } from '../stores/socketStore';
import { getApiBase } from '../lib/api';

/**
 * Hook that fetches VATSIM data via REST on mount, then subscribes
 * to WebSocket updates for real-time 15s refreshes.
 */
export function useVatsim(): void {
  const setSnapshot = useVatsimStore((s) => s.setSnapshot);
  const socket = useSocketStore((s) => s.socket);
  const fetchedRef = useRef(false);

  // Initial REST fetch
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    fetch(`${getApiBase()}/api/vatsim/data`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data: VatsimDataSnapshot | null) => {
        if (data) setSnapshot(data);
      })
      .catch(() => {
        // VATSIM data is optional — map works without it
      });
  }, [setSnapshot]);

  // WebSocket subscription
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = (data: VatsimUpdateEvent) => {
      // Reconstruct a full snapshot from the update event
      const current = useVatsimStore.getState().snapshot;
      const snapshot: VatsimDataSnapshot = {
        general: current?.general ?? {
          version: 3,
          reload: 1,
          update: '',
          update_timestamp: '',
          connected_clients: 0,
          unique_users: 0,
        },
        pilots: data.pilots,
        controllers: data.controllers,
        atis: data.atis,
        updatedAt: data.updatedAt,
      };
      setSnapshot(snapshot);
    };

    socket.emit('vatsim:subscribe');
    socket.on('vatsim:update', handleUpdate);

    return () => {
      socket.emit('vatsim:unsubscribe');
      socket.off('vatsim:update', handleUpdate);
    };
  }, [socket, setSnapshot]);
}
