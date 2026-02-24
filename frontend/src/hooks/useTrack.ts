import { useEffect } from 'react';
import type { TrackPoint } from '@acars/shared';
import { useTrackStore } from '../stores/trackStore';
import { useSocketSubscription } from './useSocketSubscription';

/**
 * Hook that subscribes to WebSocket `track:point` events and
 * appends incoming points to the track store for the currently
 * selected bid. Call this once at the LiveMapPage level.
 *
 * Also handles fetching/clearing the track when selectedBidId changes.
 */
export function useTrack(selectedBidId: number | null): void {
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
  const handleTrackPoint = (data: { bidId: number; point: TrackPoint }) => {
    appendPoint(data.bidId, data.point);
  };

  useSocketSubscription<{ bidId: number; point: TrackPoint }>('track:point', handleTrackPoint, {
    subscribeEvent: selectedBidId != null ? 'dispatch:subscribe' : undefined,
    unsubscribeEvent: selectedBidId != null ? 'dispatch:unsubscribe' : undefined,
    subscribeArg: selectedBidId != null ? selectedBidId : undefined,
  });
}
