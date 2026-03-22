import { Suspense, lazy, useMemo, useCallback } from 'react';
import { SharedMapProvider, useSharedMap } from './SharedMapContext';
import { OverviewOverlay } from './OverviewOverlay';
import { DispatchOverlay } from './DispatchOverlay';
import type { ActiveFlightHeartbeat } from '@acars/shared';

const WorldMap = lazy(() =>
  import('@/components/map/WorldMap').then((m) => ({ default: m.WorldMap })),
);

// ── FlightData shape expected by WorldMap ────────────────────

interface FlightData {
  latitude: number;
  longitude: number;
  heading: number;
  callsign: string;
  flightNumber?: string;
  aircraftType?: string;
  depIcao?: string;
  arrIcao?: string;
  depLat?: number;
  depLon?: number;
  arrLat?: number;
  arrLon?: number;
  altitude?: number;
  groundSpeed?: number;
  phase?: string;
  trackPoints?: Array<{ lat: number; lon: number }>;
  bidId?: number;
}

// ── Heartbeat → FlightData mapper ────────────────────────────

function heartbeatToFlight(h: ActiveFlightHeartbeat): FlightData {
  return {
    latitude: h.latitude,
    longitude: h.longitude,
    heading: h.heading,
    callsign: h.callsign,
    flightNumber: h.flightNumber,
    aircraftType: h.aircraftType,
    depIcao: h.depIcao,
    arrIcao: h.arrIcao,
    depLat: h.depLat,
    depLon: h.depLon,
    arrLat: h.arrLat,
    arrLon: h.arrLon,
    altitude: h.altitude,
    groundSpeed: h.groundSpeed,
    phase: h.phase,
  };
}

// ── MapBridge — reads context, feeds WorldMap ────────────────

function MapBridge() {
  const {
    mode,
    liveFlights,
    dispatchFlights,
    hubs,
    selectedCallsign,
    setSelectedCallsign,
    selectedBidId,
    setSelectedBidId,
    setClickPosition,
    detailBidId,
  } = useSharedMap();

  // Build a lookup from callsign → heartbeat for merging
  const heartbeatMap = useMemo(() => {
    const map = new Map<string, ActiveFlightHeartbeat>();
    for (const h of liveFlights) {
      map.set(h.callsign, h);
    }
    return map;
  }, [liveFlights]);

  // Overview mode: merge dispatch flights + heartbeats so all flights appear
  const overviewFlights = useMemo<FlightData[]>(() => {
    const flightMap = new Map<string, FlightData>();

    // Start with dispatch flights (they have airport coords even without heartbeats)
    for (const df of dispatchFlights) {
      const hb = heartbeatMap.get(df.pilot.callsign);
      // Use bidId as key instead of callsign (same pilot can have multiple flights)
      flightMap.set(`${df.bid.id}`, {
        bidId: df.bid.id,
        latitude: hb?.latitude ?? df.depLat ?? 0,
        longitude: hb?.longitude ?? df.depLon ?? 0,
        heading: hb?.heading ?? 0,
        // Use flightNumber as callsign for unique selection (same pilot may have multiple flights)
        callsign: df.bid.flightNumber,
        flightNumber: df.bid.flightNumber,
        aircraftType: df.bid.aircraftType ?? undefined,
        depIcao: df.bid.depIcao,
        arrIcao: df.bid.arrIcao,
        depLat: df.depLat ?? undefined,
        depLon: df.depLon ?? undefined,
        arrLat: df.arrLat ?? undefined,
        arrLon: df.arrLon ?? undefined,
        altitude: hb?.altitude,
        groundSpeed: hb?.groundSpeed,
        phase: df.phase,
      });
    }

    // Add any heartbeat-only flights not already matched by bid
    for (const hb of liveFlights) {
      const key = hb.bidId ? `${hb.bidId}` : `hb-${hb.callsign}`;
      if (!flightMap.has(key)) {
        flightMap.set(key, { ...heartbeatToFlight(hb), bidId: hb.bidId });
      }
    }

    return Array.from(flightMap.values());
  }, [liveFlights, dispatchFlights, heartbeatMap]);

  // Dispatch mode: merge dispatch flights with live heartbeat data
  const dispatchMergedFlights = useMemo<FlightData[]>(() => {
    return dispatchFlights.map((df) => {
      const hb = heartbeatMap.get(df.pilot.callsign);
      // If we have a live heartbeat, use its position; otherwise fall back to airport coords
      const isCompleted = df.phase === 'completed';
      return {
        bidId: df.bid.id,
        latitude: hb?.latitude ?? (isCompleted ? (df.arrLat ?? df.depLat ?? 0) : (df.depLat ?? 0)),
        longitude: hb?.longitude ?? (isCompleted ? (df.arrLon ?? df.depLon ?? 0) : (df.depLon ?? 0)),
        heading: hb?.heading ?? 0,
        // Use flightNumber as callsign for unique selection (same pilot may have multiple flights)
        callsign: df.bid.flightNumber,
        flightNumber: df.bid.flightNumber,
        aircraftType: df.bid.aircraftType ?? undefined,
        depIcao: df.bid.depIcao,
        arrIcao: df.bid.arrIcao,
        depLat: df.depLat ?? undefined,
        depLon: df.depLon ?? undefined,
        arrLat: df.arrLat ?? undefined,
        arrLon: df.arrLon ?? undefined,
        altitude: hb?.altitude,
        groundSpeed: hb?.groundSpeed,
        phase: df.phase,
      };
    });
  }, [dispatchFlights, heartbeatMap]);

  // Extract OFP waypoints for the selected flight's route (both modes)
  const selectedRoute = useMemo(() => {
    // Try dispatch mode (selectedBidId)
    if (selectedBidId != null) {
      const df = dispatchFlights.find((f) => f.bid.id === selectedBidId);
      if (df?.ofpJson?.steps?.length) {
        return df.ofpJson.steps.map((s) => ({ lat: s.lat, lon: s.lon, altitudeFt: s.altitudeFt, fixType: s.fixType, ident: s.ident }));
      }
    }
    // Try overview mode (selectedCallsign is now flightNumber)
    if (selectedCallsign) {
      const df = dispatchFlights.find((f) => f.bid.flightNumber === selectedCallsign);
      if (df?.ofpJson?.steps?.length) {
        return df.ofpJson.steps.map((s) => ({ lat: s.lat, lon: s.lon, altitudeFt: s.altitudeFt, fixType: s.fixType, ident: s.ident }));
      }
    }
    return undefined;
  }, [selectedBidId, selectedCallsign, dispatchFlights]);

  // Compute bounds for the detail panel's flight route (zoom-to-fit)
  const focusBounds = useMemo<[number, number, number, number] | null>(() => {
    if (detailBidId == null) return null;
    const df = dispatchFlights.find((f) => f.bid.id === detailBidId);
    if (!df) return null;

    // Collect all relevant coordinates: OFP steps, or fallback to dep/arr airports
    const lats: number[] = [];
    const lons: number[] = [];

    if (df.ofpJson?.steps?.length) {
      for (const s of df.ofpJson.steps) {
        lats.push(s.lat);
        lons.push(s.lon);
      }
    } else {
      if (df.depLat != null && df.depLon != null) { lats.push(df.depLat); lons.push(df.depLon); }
      if (df.arrLat != null && df.arrLon != null) { lats.push(df.arrLat); lons.push(df.arrLon); }
    }

    if (lats.length < 2) return null;

    return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
  }, [detailBidId, dispatchFlights]);

  // Dispatch: derive selectedCallsign from selectedBidId
  // Use flightNumber as the selection key (callsign is shared when same pilot has multiple flights)
  const dispatchSelectedCallsign = useMemo(() => {
    if (selectedBidId == null) return null;
    const df = dispatchFlights.find((f) => f.bid.id === selectedBidId);
    return df?.bid.flightNumber ?? null;
  }, [selectedBidId, dispatchFlights]);

  // Dispatch: when a flight is selected on map by callsign, find the bidId
  const handleDispatchSelectCallsign = useCallback(
    (callsign: string | null) => {
      if (!callsign) {
        setSelectedBidId(null);
        return;
      }
      // Match by flightNumber first (used as selection key in dispatch), then callsign
      const df = dispatchFlights.find((f) => f.bid.flightNumber === callsign)
        ?? dispatchFlights.find((f) => f.pilot.callsign === callsign);
      setSelectedBidId(df?.bid.id ?? null);
    },
    [dispatchFlights, setSelectedBidId],
  );

  // Dispatch: onFlightClick handler — match by bidId for accuracy
  const handleFlightClick = useCallback(
    (flight: FlightData, event: React.MouseEvent) => {
      if (flight.bidId) {
        setSelectedBidId(flight.bidId);
        setClickPosition({ x: event.clientX, y: event.clientY });
      } else {
        // Fallback: match by callsign (heartbeat-only flights)
        const df = dispatchFlights.find((f) => f.pilot.callsign === flight.callsign);
        if (df) {
          setSelectedBidId(df.bid.id);
          setClickPosition({ x: event.clientX, y: event.clientY });
        }
      }
    },
    [dispatchFlights, setSelectedBidId, setClickPosition],
  );

  // Overview: when a flight is clicked, set selectedCallsign
  const handleOverviewFlightClick = useCallback(
    (flight: FlightData) => {
      setSelectedCallsign(flight.callsign === selectedCallsign ? null : flight.callsign);
    },
    [selectedCallsign, setSelectedCallsign],
  );

  if (mode === 'dispatch') {
    return (
      <WorldMap
        flights={dispatchMergedFlights}
        hubs={[]}
        selectedCallsign={dispatchSelectedCallsign}
        onSelectCallsign={handleDispatchSelectCallsign}
        onFlightClick={handleFlightClick}
        mode="dispatch"
        selectedRoute={selectedRoute}
        focusBounds={focusBounds}
      />
    );
  }

  // Overview mode
  return (
    <WorldMap
      flights={overviewFlights}
      hubs={hubs}
      selectedCallsign={selectedCallsign}
      onSelectCallsign={setSelectedCallsign}
      onFlightClick={handleOverviewFlightClick}
      mode="overview"
      selectedRoute={selectedRoute}
    />
  );
}

// ── Overlay bridges — read mode from context ─────────────────

function OverviewOverlayBridge() {
  const { mode } = useSharedMap();
  return <OverviewOverlay active={mode === 'overview'} />;
}

function DispatchOverlayBridge() {
  const { mode } = useSharedMap();
  return <DispatchOverlay active={mode === 'dispatch'} />;
}

// ── SharedMapContainer — persistent map wrapper ──────────────

export function SharedMapContainer() {
  return (
    <SharedMapProvider>
      <div className="absolute inset-0">
        <Suspense fallback={null}>
          <MapBridge />
        </Suspense>
      </div>
      {/* Both overlays always mounted — CSS transitions handle enter/exit */}
      <div className="relative h-full pointer-events-none" style={{ zIndex: 10 }}>
        <OverviewOverlayBridge />
        <DispatchOverlayBridge />
      </div>
    </SharedMapProvider>
  );
}
