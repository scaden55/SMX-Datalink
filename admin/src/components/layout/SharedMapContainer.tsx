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
      flightMap.set(df.pilot.callsign, {
        latitude: hb?.latitude ?? df.depLat ?? 0,
        longitude: hb?.longitude ?? df.depLon ?? 0,
        heading: hb?.heading ?? 0,
        callsign: df.pilot.callsign,
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

    // Add any heartbeat-only flights not in dispatch data
    for (const hb of liveFlights) {
      if (!flightMap.has(hb.callsign)) {
        flightMap.set(hb.callsign, heartbeatToFlight(hb));
      }
    }

    return Array.from(flightMap.values());
  }, [liveFlights, dispatchFlights, heartbeatMap]);

  // Dispatch mode: merge dispatch flights with live heartbeat data
  const dispatchMergedFlights = useMemo<FlightData[]>(() => {
    return dispatchFlights.map((df) => {
      const hb = heartbeatMap.get(df.pilot.callsign);
      // If we have a live heartbeat, use its position; otherwise fall back to API data
      return {
        latitude: hb?.latitude ?? 0,
        longitude: hb?.longitude ?? 0,
        heading: hb?.heading ?? 0,
        callsign: df.pilot.callsign,
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

  // Dispatch: derive selectedCallsign from selectedBidId
  const dispatchSelectedCallsign = useMemo(() => {
    if (selectedBidId == null) return null;
    const df = dispatchFlights.find((f) => f.bid.id === selectedBidId);
    return df?.pilot.callsign ?? null;
  }, [selectedBidId, dispatchFlights]);

  // Dispatch: when a callsign is selected on map, find the bidId
  const handleDispatchSelectCallsign = useCallback(
    (callsign: string | null) => {
      if (!callsign) {
        setSelectedBidId(null);
        return;
      }
      const df = dispatchFlights.find((f) => f.pilot.callsign === callsign);
      setSelectedBidId(df?.bid.id ?? null);
    },
    [dispatchFlights, setSelectedBidId],
  );

  // Dispatch: onFlightClick handler
  const handleFlightClick = useCallback(
    (flight: FlightData, event: React.MouseEvent) => {
      const df = dispatchFlights.find(
        (f) => f.pilot.callsign === flight.callsign,
      );
      if (df) {
        setSelectedBidId(df.bid.id);
        setClickPosition({ x: event.clientX, y: event.clientY });
      }
    },
    [dispatchFlights, setSelectedBidId, setClickPosition],
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
      />
    );
  }

  // Overview: when a flight is clicked, set selectedCallsign
  const handleOverviewFlightClick = useCallback(
    (flight: FlightData) => {
      setSelectedCallsign(flight.callsign === selectedCallsign ? null : flight.callsign);
    },
    [selectedCallsign, setSelectedCallsign],
  );

  // Overview mode
  return (
    <WorldMap
      flights={overviewFlights}
      hubs={hubs}
      selectedCallsign={selectedCallsign}
      onSelectCallsign={setSelectedCallsign}
      onFlightClick={handleOverviewFlightClick}
      mode="overview"
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
