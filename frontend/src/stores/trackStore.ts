import { create } from 'zustand';
import type { TrackPoint, SimBriefStep } from '@acars/shared';
import { api } from '../lib/api';

// ── Track Store ─────────────────────────────────────────────
// Holds the flight track and OFP waypoints for the currently
// selected SMX bid. Track data is persisted server-side in
// telemetry_track; this store caches it and appends real-time
// WebSocket track:point events incrementally.

interface TrackState {
  /** Currently loaded track (null = none selected) */
  selectedBidTrack: { bidId: number; points: TrackPoint[] } | null;
  /** OFP route waypoints for predicted path (null = no OFP) */
  ofpSteps: SimBriefStep[] | null;
  /** Loading state for fetch */
  loading: boolean;
  /** Fetch track + OFP from REST APIs for a bid */
  fetchTrack: (bidId: number) => Promise<void>;
  /** Append a single point (from WebSocket) if bidId matches */
  appendPoint: (bidId: number, point: TrackPoint) => void;
  /** Clear the selected track */
  clearTrack: () => void;
}

export const useTrackStore = create<TrackState>((set, get) => ({
  selectedBidTrack: null,
  ofpSteps: null,
  loading: false,

  fetchTrack: async (bidId: number) => {
    set({ loading: true, ofpSteps: null });

    // Fetch track and OFP in parallel
    const [trackResult, ofpResult] = await Promise.allSettled([
      api.get<{ bidId: number; points: TrackPoint[] }>(`/api/flights/${bidId}/track`),
      api.get<{ ofpJson: { steps?: SimBriefStep[] } | null }>(`/api/bids/${bidId}/flight-plan`),
    ]);

    const points =
      trackResult.status === 'fulfilled' ? trackResult.value.points : [];
    const steps =
      ofpResult.status === 'fulfilled' && ofpResult.value.ofpJson?.steps
        ? ofpResult.value.ofpJson.steps
        : null;

    set({
      selectedBidTrack: { bidId, points },
      ofpSteps: steps,
      loading: false,
    });
  },

  appendPoint: (bidId: number, point: TrackPoint) => {
    const current = get().selectedBidTrack;
    if (!current || current.bidId !== bidId) return;
    set({
      selectedBidTrack: {
        ...current,
        points: [...current.points, point],
      },
    });
  },

  clearTrack: () => set({ selectedBidTrack: null, ofpSteps: null, loading: false }),
}));
