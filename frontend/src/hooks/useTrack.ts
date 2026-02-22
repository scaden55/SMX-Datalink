import { useEffect } from 'react';
import type { TrackPoint } from '@acars/shared';
import { useSocketStore } from '../stores/socketStore';
import { useTrackStore } from '../stores/trackStore';

/**
 * Hook that subscribes to WebSocket `track:point` events and
 * appends incoming points to the track store for the currently
 * selected bid. Call this once at the LiveMapPage level.
 *
 * Also handles fetching/clearing the track when selectedBidId changes.
 */
export function useTrack(selectedBidId: number | null): void {
  const socket = useSocketStore((s) => s.socket);
  const fetchTrack = useTrackStore((s) => s.fetchTrack);
  const appendPoint = useTrackStore((s) => s.appendPoint);
  const clearTrack = useTrackStore((s) => s.clearTrack);

  // Fetch track when bid changes, clear when deselected
  useEffect(() => {
    if (selectedBidId == null) {
      clearTrack();
      return;
    }
    fetchTrack(selectedBidId);
  }, [selectedBidId, fetchTrack, clearTrack]);

  // Subscribe to dispatch room for real-time track points
  useEffect(() => {
    if (!socket || selectedBidId == null) return;

    socket.emit('dispatch:subscribe', selectedBidId);

    const handleTrackPoint = (data: { bidId: number; point: TrackPoint }) => {
      appendPoint(data.bidId, data.point);
    };

    socket.on('track:point', handleTrackPoint);

    return () => {
      socket.emit('dispatch:unsubscribe', selectedBidId);
      socket.off('track:point', handleTrackPoint);
    };
  }, [socket, selectedBidId, appendPoint]);
}
