import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import type { ActiveFlightHeartbeat, DispatchFlightsResponse, DispatchFlight } from '@acars/shared';
import { useAuthStore } from '@/stores/authStore';
import { useSocketStore } from '@/stores/socketStore';
import { useSocket } from '@/hooks/useSocket';
import { api } from '@/lib/api';
import { FilterBar, type PhaseFilter } from '@/components/dispatch/FilterBar';
import { FlightStrip } from '@/components/dispatch/FlightStrip';
import { FlightMarker } from '@/components/dispatch/FlightMarker';
import { FloatingFlightCard } from '@/components/dispatch/FloatingFlightCard';
import 'leaflet/dist/leaflet.css';

/* ─── Local type for unified map flights ───────────────────────── */

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

/* ─── Map background setter ────────────────────────────────────── */

function MapBackground() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    container.style.background = 'var(--surface-0)';
  }, [map]);
  return null;
}

/* ─── Convert API DispatchFlight → DispatchMapFlight ───────────── */

function apiFlightToMapFlight(df: DispatchFlight): DispatchMapFlight {
  const phase: DispatchMapFlight['phase'] =
    df.phase === 'active' ? 'flying' : df.phase === 'completed' ? 'completed' : 'planning';

  return {
    bidId: df.bid.id,
    callsign: df.pilot.callsign,
    flightNumber: df.bid.flightNumber,
    depIcao: df.bid.depIcao,
    arrIcao: df.bid.arrIcao,
    aircraftType: df.bid.aircraftType ?? '',
    phase,
    pilot: df.pilot,
    depLat: df.depLat ?? undefined,
    depLon: df.depLon ?? undefined,
    arrLat: df.arrLat ?? undefined,
    arrLon: df.arrLon ?? undefined,
    // Position defaults: planning → dep airport, completed → arr airport
    latitude: phase === 'completed' ? (df.arrLat ?? undefined) : (df.depLat ?? undefined),
    longitude: phase === 'completed' ? (df.arrLon ?? undefined) : (df.depLon ?? undefined),
  };
}

/* ─── Merge heartbeat data into map flights ────────────────────── */

function mergeHeartbeats(
  mapFlights: Map<number, DispatchMapFlight>,
  heartbeats: ActiveFlightHeartbeat[],
): Map<number, DispatchMapFlight> {
  const merged = new Map(mapFlights);

  for (const hb of heartbeats) {
    if (!hb.bidId) continue;
    const existing = merged.get(hb.bidId);
    if (existing) {
      // Update position and status from heartbeat
      merged.set(hb.bidId, {
        ...existing,
        phase: 'flying',
        latitude: hb.latitude,
        longitude: hb.longitude,
        altitude: hb.altitude,
        groundSpeed: hb.groundSpeed,
        heading: hb.heading,
      });
    } else {
      // Flight from heartbeat not in API — create entry
      merged.set(hb.bidId, {
        bidId: hb.bidId,
        callsign: hb.callsign,
        flightNumber: hb.flightNumber ?? '',
        depIcao: hb.depIcao ?? '',
        arrIcao: hb.arrIcao ?? '',
        aircraftType: hb.aircraftType,
        phase: 'flying',
        latitude: hb.latitude,
        longitude: hb.longitude,
        altitude: hb.altitude,
        groundSpeed: hb.groundSpeed,
        heading: hb.heading,
        depLat: hb.depLat,
        depLon: hb.depLon,
        arrLat: hb.arrLat,
        arrLon: hb.arrLon,
      });
    }
  }

  return merged;
}

/* ─── Main page component ──────────────────────────────────────── */

export default function DispatchMapPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const { acquire } = useSocketStore();

  // Core state
  const [apiFlights, setApiFlights] = useState<Map<number, DispatchMapFlight>>(new Map());
  const [heartbeats, setHeartbeats] = useState<ActiveFlightHeartbeat[]>([]);
  const [selectedBidId, setSelectedBidId] = useState<number | null>(null);
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Poll interval ref for cleanup
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Socket connection ──────────────────────────────────────── */

  useEffect(() => {
    if (accessToken) return acquire(accessToken);
  }, [accessToken, acquire]);

  /* ── Subscribe to livemap heartbeats ────────────────────────── */

  useSocket<ActiveFlightHeartbeat[]>('flights:active', (data) => {
    setHeartbeats(data);
  }, {
    subscribeEvent: 'livemap:subscribe',
    unsubscribeEvent: 'livemap:unsubscribe',
  });

  /* ── Fetch dispatch flights from API ────────────────────────── */

  const fetchFlights = useCallback(() => {
    api.get<DispatchFlightsResponse>('/api/dispatch/flights?phase=all')
      .then((res) => {
        const map = new Map<number, DispatchMapFlight>();
        for (const f of res.flights) {
          const mf = apiFlightToMapFlight(f);
          map.set(mf.bidId, mf);
        }
        setApiFlights(map);
      })
      .catch(() => { /* silently retry on next poll */ });
  }, []);

  useEffect(() => {
    fetchFlights();
    pollRef.current = setInterval(fetchFlights, 30_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchFlights]);

  /* ── Merge API data with heartbeats ─────────────────────────── */

  const allFlights = useMemo(() => {
    const merged = mergeHeartbeats(apiFlights, heartbeats);
    return Array.from(merged.values());
  }, [apiFlights, heartbeats]);

  /* ── Phase counts ───────────────────────────────────────────── */

  const phaseCounts = useMemo(() => {
    const counts = { flying: 0, planning: 0, completed: 0 };
    for (const f of allFlights) counts[f.phase]++;
    return counts;
  }, [allFlights]);

  /* ── Filtered + searched flights ────────────────────────────── */

  const visibleFlights = useMemo(() => {
    let list = allFlights;

    // Phase filter
    if (phaseFilter !== 'all') {
      list = list.filter((f) => f.phase === phaseFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((f) =>
        f.callsign.toLowerCase().includes(q) ||
        f.flightNumber.toLowerCase().includes(q) ||
        f.depIcao.toLowerCase().includes(q) ||
        f.arrIcao.toLowerCase().includes(q) ||
        f.aircraftType.toLowerCase().includes(q) ||
        (f.pilot?.name.toLowerCase().includes(q) ?? false)
      );
    }

    return list;
  }, [allFlights, phaseFilter, searchQuery]);

  /* ── Selected flight lookup ────────────────────────────────── */

  const selectedFlight = useMemo(() => {
    if (selectedBidId == null) return null;
    return visibleFlights.find((f) => f.bidId === selectedBidId) ?? null;
  }, [visibleFlights, selectedBidId]);

  /* ── Handlers ───────────────────────────────────────────────── */

  const handleSelectFlight = useCallback((bidId: number) => {
    setSelectedBidId((prev) => (prev === bidId ? null : bidId));
  }, []);

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[30, 0]}
        zoom={3}
        zoomControl={false}
        attributionControl={false}
        className="h-full w-full"
        style={{ background: 'var(--surface-0)' }}
      >
        <MapBackground />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />

        {/* Flight markers */}
        {visibleFlights.map((f) => (
          <FlightMarker
            key={f.bidId}
            flight={f}
            isSelected={f.bidId === selectedBidId}
            onClick={() => handleSelectFlight(f.bidId)}
          />
        ))}

        {/* Floating card for selected flight */}
        {selectedFlight && (
          <FloatingFlightCard
            flight={selectedFlight}
            onOpenDetails={() => navigate(`/dispatch/${selectedFlight.bidId}`)}
            onClose={() => setSelectedBidId(null)}
          />
        )}
      </MapContainer>

      {/* Overlay controls */}
      <FilterBar
        phaseCounts={phaseCounts}
        activeFilter={phaseFilter}
        onFilterChange={setPhaseFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <FlightStrip
        flights={visibleFlights}
        selectedBidId={selectedBidId}
        onSelectFlight={handleSelectFlight}
      />
    </div>
  );
}
