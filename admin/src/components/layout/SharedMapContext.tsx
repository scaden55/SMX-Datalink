import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import type {
  ActiveFlightHeartbeat,
  DispatchFlight,
  DispatchFlightsResponse,
  Airport,
} from '@acars/shared';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useSocketStore } from '@/stores/socketStore';
import { useSocket } from '@/hooks/useSocket';

// ── Types ────────────────────────────────────────────────────

export type MapMode = 'overview' | 'dispatch';

export interface DispatchMapFlight {
  bidId: number;
  callsign: string;
  flightNumber: string;
  depIcao: string;
  arrIcao: string;
  aircraftType: string;
  phase: 'flying' | 'planning' | 'completed';
  latitude?: number;
  longitude?: number;
  altitude?: number;
  groundSpeed?: number;
  heading?: number;
  pilot?: { callsign: string; name: string };
  depLat?: number;
  depLon?: number;
  arrLat?: number;
  arrLon?: number;
}

export interface SharedMapContextValue {
  mode: MapMode;
  liveFlights: ActiveFlightHeartbeat[];
  dispatchFlights: DispatchFlight[];
  hubs: Array<{ lat: number; lon: number; icao?: string; coverage?: number }>;
  selectedCallsign: string | null;
  setSelectedCallsign: (callsign: string | null) => void;
  selectedBidId: number | null;
  setSelectedBidId: (bidId: number | null) => void;
  detailBidId: number | null;
  setDetailBidId: (id: number | null) => void;
  clickPosition: { x: number; y: number } | null;
  setClickPosition: (pos: { x: number; y: number } | null) => void;
}

const SharedMapContext = createContext<SharedMapContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────

const DISPATCH_POLL_MS = 30_000;

export function SharedMapProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const { acquire } = useSocketStore();

  // ── Mode derived from route ──────────────────────────────
  const mode: MapMode = useMemo(() => {
    if (pathname.startsWith('/dispatch')) return 'dispatch';
    return 'overview';
  }, [pathname]);

  // ── Live flights via socket ──────────────────────────────
  const [liveFlights, setLiveFlights] = useState<ActiveFlightHeartbeat[]>([]);

  useEffect(() => {
    if (accessToken) return acquire(accessToken);
  }, [accessToken, acquire]);

  useSocket<ActiveFlightHeartbeat[]>('flights:active', setLiveFlights, {
    subscribeEvent: 'livemap:subscribe',
    unsubscribeEvent: 'livemap:unsubscribe',
  });

  // ── Dispatch flights via polling ─────────────────────────
  const [dispatchFlights, setDispatchFlights] = useState<DispatchFlight[]>([]);

  const fetchDispatchFlights = useCallback(async () => {
    try {
      const data = await api.get<DispatchFlightsResponse>(
        '/api/dispatch/flights?phase=all',
      );
      setDispatchFlights(data.flights);
    } catch {
      /* ignore — will retry on next poll */
    }
  }, []);

  useEffect(() => {
    fetchDispatchFlights();
    const id = setInterval(fetchDispatchFlights, DISPATCH_POLL_MS);
    return () => clearInterval(id);
  }, [fetchDispatchFlights]);

  // ── Hubs (fetch once) ────────────────────────────────────
  const [hubs, setHubs] = useState<
    Array<{ lat: number; lon: number; icao?: string; coverage?: number }>
  >([]);
  const hubsFetched = useRef(false);

  useEffect(() => {
    if (hubsFetched.current) return;
    hubsFetched.current = true;

    (async () => {
      try {
        const res = await api.get<{ airports: Airport[] }>('/api/admin/airports');
        const hubList = res.airports
          .filter((a) => a.isHub)
          .map((a) => ({ lat: a.lat, lon: a.lon, icao: a.icao }));
        if (hubList.length > 0) setHubs(hubList);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  // ── Selection state ──────────────────────────────────────
  const [selectedCallsign, setSelectedCallsign] = useState<string | null>(null);
  const [selectedBidId, setSelectedBidId] = useState<number | null>(null);
  const [detailBidId, setDetailBidId] = useState<number | null>(null);
  const [clickPosition, setClickPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // ── Context value (stable reference) ─────────────────────
  const value = useMemo<SharedMapContextValue>(
    () => ({
      mode,
      liveFlights,
      dispatchFlights,
      hubs,
      selectedCallsign,
      setSelectedCallsign,
      selectedBidId,
      setSelectedBidId,
      detailBidId,
      setDetailBidId,
      clickPosition,
      setClickPosition,
    }),
    [
      mode,
      liveFlights,
      dispatchFlights,
      hubs,
      selectedCallsign,
      selectedBidId,
      detailBidId,
      clickPosition,
    ],
  );

  return (
    <SharedMapContext.Provider value={value}>
      {children}
    </SharedMapContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────

export function useSharedMap(): SharedMapContextValue {
  const ctx = useContext(SharedMapContext);
  if (!ctx) {
    throw new Error('useSharedMap must be used within a SharedMapProvider');
  }
  return ctx;
}
