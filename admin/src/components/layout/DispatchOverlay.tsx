import { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { useSharedMap, type DispatchMapFlight } from './SharedMapContext';
import { FilterBar, type PhaseFilter } from '@/components/dispatch/FilterBar';
import { FlightStrip } from '@/components/dispatch/FlightStrip';
import { FloatingFlightCard } from '@/components/dispatch/FloatingFlightCard';

const FlightDetailPanel = lazy(() => import('@/components/dispatch/FlightDetailPanel'));

// ── Component ────────────────────────────────────────────────

interface DispatchOverlayProps {
  active: boolean;
}

export function DispatchOverlay({ active }: DispatchOverlayProps) {
  const {
    dispatchFlights,
    liveFlights,
    selectedBidId,
    setSelectedBidId,
    detailBidId,
    setDetailBidId,
    clickPosition,
  } = useSharedMap();

  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  /* ── Build DispatchMapFlight[] from context data ─────────────── */

  const allFlights = useMemo(() => {
    const flightMap = new Map<number, DispatchMapFlight>();

    for (const df of dispatchFlights) {
      const phase: DispatchMapFlight['phase'] =
        df.phase === 'active' ? 'flying' : df.phase === 'completed' ? 'completed' : 'planning';
      flightMap.set(df.bid.id, {
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
        latitude: phase === 'completed' ? (df.arrLat ?? undefined) : (df.depLat ?? undefined),
        longitude: phase === 'completed' ? (df.arrLon ?? undefined) : (df.depLon ?? undefined),
      });
    }

    // Override with heartbeat positions for flying flights
    for (const hb of liveFlights) {
      if (!hb.bidId) continue;
      const existing = flightMap.get(hb.bidId);
      if (existing) {
        flightMap.set(hb.bidId, {
          ...existing,
          phase: 'flying',
          latitude: hb.latitude,
          longitude: hb.longitude,
          altitude: hb.altitude,
          groundSpeed: hb.groundSpeed,
          heading: hb.heading,
        });
      } else {
        flightMap.set(hb.bidId, {
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

    return Array.from(flightMap.values());
  }, [dispatchFlights, liveFlights]);

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
        (f.pilot?.name.toLowerCase().includes(q) ?? false),
      );
    }

    return list;
  }, [allFlights, phaseFilter, searchQuery]);

  /* ── Selected flight lookup ────────────────────────────────── */

  const selectedFlight = useMemo(() => {
    if (selectedBidId == null) return null;
    return visibleFlights.find((f) => f.bidId === selectedBidId) ?? null;
  }, [visibleFlights, selectedBidId]);

  /* ── Toggle handler (stable ref) ───────────────────────────── */

  const handleSelectFlight = useCallback(
    (bidId: number) => setSelectedBidId(bidId === selectedBidId ? null : bidId),
    [selectedBidId, setSelectedBidId],
  );

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Filter bar */}
      <div className={`map-panel-top ${active ? 'active' : ''} pointer-events-auto`}>
        <FilterBar
          phaseCounts={phaseCounts}
          activeFilter={phaseFilter}
          onFilterChange={setPhaseFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>

      {/* Floating card — hidden when detail panel is open */}
      {active && selectedFlight && clickPosition && detailBidId == null && (
        <div className="pointer-events-auto">
          <FloatingFlightCard
            flight={selectedFlight}
            position={clickPosition}
            onOpenDetails={() => {
              setDetailBidId(selectedFlight.bidId);
            }}
            onClose={() => setSelectedBidId(null)}
          />
        </div>
      )}

      {/* Slide-in detail panel */}
      {active && (
        <Suspense fallback={null}>
          <FlightDetailPanel
            bidId={detailBidId!}
            open={detailBidId != null}
            onClose={() => setDetailBidId(null)}
          />
        </Suspense>
      )}

      {/* Flight strip */}
      <div className={`map-panel-bottom ${active ? 'active' : ''} pointer-events-auto`}>
        <FlightStrip
          flights={visibleFlights}
          selectedBidId={selectedBidId}
          onSelectFlight={handleSelectFlight}
        />
      </div>
    </div>
  );
}
