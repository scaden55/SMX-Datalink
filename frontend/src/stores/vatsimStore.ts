import { create } from 'zustand';
import type { VatsimDataSnapshot } from '@acars/shared';
import { api } from '../lib/api';

// ── Track points for VATSIM pilot trails ────────────────────

export interface VatsimTrailPoint {
  lat: number;
  lon: number;
  alt: number;
}

const MAX_TRACK_POINTS = 2000; // ~8h at 15s VATSIM update interval

// ── Layer toggles ───────────────────────────────────────────

interface VatsimLayers {
  showFirBoundaries: boolean;
  showTraconBoundaries: boolean;
  showControllers: boolean;
  showPilots: boolean;
  showAirportLabels: boolean;
  showNavaids: boolean;
}

// ── Store ───────────────────────────────────────────────────

interface VatsimState {
  snapshot: VatsimDataSnapshot | null;
  layers: VatsimLayers;
  /** Accumulated position history for each pilot, keyed by CID */
  pilotTracks: Map<number, VatsimTrailPoint[]>;
  /** Server-persisted track for the currently selected pilot */
  serverTrack: VatsimTrailPoint[] | null;
  serverTrackCid: number | null;
  setSnapshot: (data: VatsimDataSnapshot) => void;
  toggleLayer: (layer: keyof VatsimLayers) => void;
  fetchPilotTrack: (cid: number) => Promise<void>;
  clearServerTrack: () => void;
}

export const useVatsimStore = create<VatsimState>((set) => ({
  snapshot: null,
  pilotTracks: new Map(),
  serverTrack: null,
  serverTrackCid: null,
  layers: {
    showFirBoundaries: true,
    showTraconBoundaries: true,
    showControllers: false,
    showPilots: false,
    showAirportLabels: true,
    showNavaids: false,
  },
  setSnapshot: (data) =>
    set((state) => {
      // Accumulate position tracks for all moving pilots
      const tracks = new Map(state.pilotTracks);

      for (const pilot of data.pilots) {
        // Skip stationary aircraft (no trail needed)
        if (pilot.groundspeed < 30) continue;

        const existing = tracks.get(pilot.cid) ?? [];
        const last = existing[existing.length - 1];

        // Only append if position actually changed
        if (!last || last.lat !== pilot.latitude || last.lon !== pilot.longitude) {
          existing.push({
            lat: pilot.latitude,
            lon: pilot.longitude,
            alt: pilot.altitude,
          });
          if (existing.length > MAX_TRACK_POINTS) existing.shift();
          tracks.set(pilot.cid, existing);
        }
      }

      // Prune tracks for pilots no longer in the snapshot
      const activeCids = new Set(data.pilots.map((p) => p.cid));
      for (const cid of tracks.keys()) {
        if (!activeCids.has(cid)) tracks.delete(cid);
      }

      return { snapshot: data, pilotTracks: tracks };
    }),
  toggleLayer: (layer) =>
    set((state) => ({
      layers: { ...state.layers, [layer]: !state.layers[layer] },
    })),

  fetchPilotTrack: async (cid) => {
    try {
      const data = await api.get<{ cid: number; points: VatsimTrailPoint[] }>(
        `/api/vatsim/pilots/${cid}/track`,
      );
      set({ serverTrack: data.points, serverTrackCid: cid });
    } catch {
      // Non-critical — fall back to client-only trail
      set({ serverTrack: null, serverTrackCid: cid });
    }
  },

  clearServerTrack: () => set({ serverTrack: null, serverTrackCid: null }),
}));
