import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDots, AirplaneTilt, Path, Broadcast, ArrowRight } from '@phosphor-icons/react';
import { AppShell } from '../components/layout/AppShell';
import { useAuthStore } from '../stores/authStore';
import { useFlightPlanStore } from '../stores/flightPlanStore';
import { useCargoStore } from '../stores/cargoStore';
import { useSocketStore } from '../stores/socketStore';
import { useActiveFlightsStore } from '../stores/activeFlightsStore';
import { DispatchEditProvider } from '../contexts/DispatchEditContext';
import { api } from '../lib/api';
import { stepsToWaypoints } from '../components/planning/simbrief-parser';
import type { DispatchFlight, DispatchFlightsResponse, Airport, VatsimFlightStatus, RegulatoryAssessment, CargoManifest } from '@acars/shared';

export function DispatchPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const setFlightPlan = useFlightPlanStore((s) => s.setFlightPlan);
  const setProgress = useFlightPlanStore((s) => s.setProgress);
  const setOfp = useFlightPlanStore((s) => s.setOfp);
  const setAirports = useFlightPlanStore((s) => s.setAirports);
  const setActiveBidId = useFlightPlanStore((s) => s.setActiveBidId);
  const airports = useFlightPlanStore((s) => s.airports);

  const socket = useSocketStore((s) => s.socket);

  const [flights, setFlights] = useState<DispatchFlight[]>([]);
  const [selectedBidId, setSelectedBidId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regulatoryAssessment, setRegulatoryAssessment] = useState<RegulatoryAssessment | null>(null);

  // Fetch active flights + airports on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [dispatchData, airportsData] = await Promise.all([
          api.get<DispatchFlightsResponse>('/api/dispatch/flights'),
          api.get<Airport[]>('/api/airports'),
        ]);
        if (cancelled) return;
        setFlights(dispatchData.flights);
        setAirports(airportsData);
        // Auto-select first flight
        if (dispatchData.flights.length > 0) {
          setSelectedBidId(dispatchData.flights[0].bid.id);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? 'Failed to load dispatch flights');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [setAirports]);

  // Auto-refresh flight list when heartbeats show a flight not in our list
  const activeHeartbeats = useActiveFlightsStore((s) => s.flights);
  useEffect(() => {
    if (loading || activeHeartbeats.length === 0) return;
    const hasNew = activeHeartbeats.some(
      (hb) => hb.bidId && !flights.some((f) => f.bid.id === hb.bidId),
    );
    if (!hasNew) return;
    api.get<DispatchFlightsResponse>('/api/dispatch/flights').then((data) => {
      setFlights(data.flights);
      // Auto-select the new flight if nothing is selected
      if (!selectedBidId && data.flights.length > 0) {
        setSelectedBidId(data.flights[0].bid.id);
      }
    }).catch(() => {});
  }, [activeHeartbeats, flights, loading, selectedBidId]);

  // Listen for real-time VATSIM status changes
  useEffect(() => {
    if (!socket) return;

    const handleVatsimStatus = (status: VatsimFlightStatus) => {
      setFlights((prev) =>
        prev.map((f) =>
          f.bid.id === status.bidId
            ? { ...f, vatsimConnected: status.vatsimConnected, vatsimCallsign: status.vatsimCallsign }
            : f,
        ),
      );
    };

    const handleFlightCompleted = (data: { bidId: number; logbookId: number }) => {
      // Remove completed flight from dispatch list
      setFlights((prev) => prev.filter((f) => f.bid.id !== data.bidId));
    };

    const handleReleased = (data: { bidId: number; changedFields: string[] }) => {
      // Re-fetch the full flight list so the pilot sees the dispatcher's changes
      api.get<DispatchFlightsResponse>('/api/dispatch/flights').then((freshData) => {
        setFlights(freshData.flights);
      }).catch(() => {
        // Fallback: at least update the releasedFields flag
        setFlights((prev) =>
          prev.map((f) =>
            f.bid.id === data.bidId
              ? { ...f, releasedFields: data.changedFields }
              : f,
          ),
        );
      });
    };

    const handleUpdated = () => {
      // Dispatcher edited a field — re-fetch to show latest values
      api.get<DispatchFlightsResponse>('/api/dispatch/flights').then((freshData) => {
        setFlights(freshData.flights);
      }).catch(() => {});
    };

    socket.on('dispatch:vatsimStatus', handleVatsimStatus);
    socket.on('flight:completed', handleFlightCompleted);
    socket.on('dispatch:released', handleReleased);
    socket.on('dispatch:updated', handleUpdated);
    return () => {
      socket.off('dispatch:vatsimStatus', handleVatsimStatus);
      socket.off('flight:completed', handleFlightCompleted);
      socket.off('dispatch:released', handleReleased);
      socket.off('dispatch:updated', handleUpdated);
    };
  }, [socket]);

  // When selected flight changes, populate the store
  const selectedFlight = flights.find((f) => f.bid.id === selectedBidId) ?? null;

  // Fetch any route airports missing from the store (e.g. non-hub airports only in oa_airports)
  const fetchedAirportsRef = useRef(new Set<string>());
  useEffect(() => {
    if (!selectedFlight || airports.length === 0) return;

    const { bid, flightPlanData } = selectedFlight;
    const icaos = [bid.depIcao, bid.arrIcao, flightPlanData?.alternate1, flightPlanData?.alternate2].filter(Boolean) as string[];
    const missing = icaos.filter(icao => !airports.some(a => a.icao === icao) && !fetchedAirportsRef.current.has(icao));
    if (missing.length === 0) return;

    missing.forEach(icao => fetchedAirportsRef.current.add(icao));

    Promise.all(
      missing.map(icao =>
        api.get<{ icao: string; name: string; latitude: number; longitude: number; elevation_ft: number | null; country: string | null; municipality: string | null; region: string | null }>(
          `/api/airports/${icao}`
        ).then(detail => ({
          id: 0,
          icao: detail.icao,
          name: detail.name,
          city: detail.municipality ?? '',
          state: detail.region ?? '',
          country: detail.country ?? '',
          lat: detail.latitude,
          lon: detail.longitude,
          elevation: detail.elevation_ft ?? 0,
          timezone: '',
        } as Airport)).catch(() => null)
      )
    ).then(results => {
      const fetched = results.filter((a): a is Airport => a !== null);
      if (fetched.length > 0) {
        const latest = useFlightPlanStore.getState().airports;
        const merged = [...latest, ...fetched.filter(f => !latest.some(c => c.icao === f.icao))];
        setAirports(merged);
      }
    });
  }, [selectedFlight, airports, setAirports]);

  useEffect(() => {
    // Keep activeBidId in sync so TopBar can show End Flight button
    setActiveBidId(selectedBidId);
  }, [selectedBidId, setActiveBidId]);

  // Fetch regulatory assessment when selected flight changes
  useEffect(() => {
    if (!selectedFlight) {
      setRegulatoryAssessment(null);
      return;
    }

    let cancelled = false;
    const { bid, ofpJson } = selectedFlight;
    const origin = ofpJson?.origin ?? bid.depIcao;
    const dest = ofpJson?.destination ?? bid.arrIcao;
    const cruiseAlt = ofpJson?.cruiseAltitude ?? 0;

    const params = new URLSearchParams({ origin, dest });
    if (cruiseAlt) params.set('cruiseAlt', String(cruiseAlt));

    api.get<RegulatoryAssessment>(`/api/regulatory/assess?${params}`)
      .then((data) => { if (!cancelled) setRegulatoryAssessment(data); })
      .catch(() => { if (!cancelled) setRegulatoryAssessment(null); });

    return () => { cancelled = true; };
  }, [selectedFlight]);

  useEffect(() => {
    if (!selectedFlight) {
      setFlightPlan(null);
      setProgress(null);
      setOfp(null);
      useCargoStore.getState().clearCargo();
      return;
    }

    const { ofpJson, flightPlanData, bid } = selectedFlight;

    // Set OFP in store so info-panel tabs can read it
    setOfp(ofpJson ?? null);

    // Build FlightPlan from OFP steps or form data.
    // Use OFP origin/destination for bookends — the OFP route direction may
    // differ from the bid schedule direction (e.g. bid KBOS→KJFK but OFP KJFK→KBOS).
    const routeOrigin = ofpJson?.origin ?? bid.depIcao;
    const routeDest = ofpJson?.destination ?? bid.arrIcao;
    const depApt = airports.find((a) => a.icao === routeOrigin);
    const arrApt = airports.find((a) => a.icao === routeDest);
    const originBookend = depApt ? { icao: depApt.icao, lat: depApt.lat, lon: depApt.lon, elevation: depApt.elevation } : undefined;
    const destBookend = arrApt ? { icao: arrApt.icao, lat: arrApt.lat, lon: arrApt.lon, elevation: arrApt.elevation } : undefined;

    const steps = ofpJson?.steps ?? [];
    const waypoints = steps.length > 0 ? stepsToWaypoints(steps, originBookend, destBookend) : [];
    const alternates: string[] = [];
    if (flightPlanData?.alternate1) alternates.push(flightPlanData.alternate1);
    if (flightPlanData?.alternate2) alternates.push(flightPlanData.alternate2);

    setFlightPlan({
      id: bid.flightNumber,
      origin: bid.depIcao,
      destination: bid.arrIcao,
      alternates,
      cruiseAltitude: ofpJson?.cruiseAltitude ?? 0,
      route: ofpJson?.route ?? flightPlanData?.route ?? '',
      waypoints,
      totalDistance: bid.distanceNm,
      activeWaypointIndex: 0,
    });

    setProgress({
      distanceFlown: 0,
      distanceRemaining: bid.distanceNm,
      eteDestination: null,
      etaDestination: null,
      fuelAtDestination: null,
      topOfDescent: null,
    });

    // Load cargo manifest if available
    api.get<CargoManifest>(`/api/cargo/${bid.id}`)
      .then((manifest) => useCargoStore.getState().setManifest(manifest))
      .catch(() => useCargoStore.getState().setManifest(null));
  }, [selectedFlight, setFlightPlan, setProgress, setOfp]);

  // Clean up dispatch state on unmount so it doesn't contaminate the planning page store
  useEffect(() => {
    return () => {
      setFlightPlan(null);
      setProgress(null);
      setOfp(null);
      setActiveBidId(null);
      useCargoStore.getState().clearCargo();
    };
  }, [setFlightPlan, setProgress, setOfp, setActiveBidId]);

  // Join dispatch room for the selected bid (for track:point, acars:message, dispatch:updated, etc.)
  const isOwnFlight = user?.id === selectedFlight?.bid?.userId;

  useEffect(() => {
    if (!socket || !selectedBidId) return;

    socket.emit('dispatch:subscribe', selectedBidId);

    return () => {
      socket.emit('dispatch:unsubscribe', selectedBidId);
    };
  }, [socket, selectedBidId]);

  const handleSelectFlight = useCallback((bidId: number) => {
    setSelectedBidId(bidId);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-6 w-6 border-2 border-blue-400/30 border-t-blue-400 rounded-full mx-auto mb-3" />
          <p className="text-[12px] text-acars-muted">Loading dispatch flights...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-[12px] text-red-400 mb-2">Failed to load dispatch data</p>
          <p className="text-[11px] text-acars-muted">{error}</p>
        </div>
      </div>
    );
  }

  // Empty state — no active flights with saved plans
  if (flights.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center text-center gap-4">
          <img src="./logos/chevron-light.png" alt="SMX" className="h-12 w-auto opacity-10" />
          <div className="flex items-center justify-center w-12 h-12 rounded-md bg-sky-500/10 border border-sky-400/20">
            <Broadcast className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <h2 className="text-[13px] font-semibold text-acars-text">
              {isAdmin ? 'No Active Flights' : 'No Active Flight'}
            </h2>
            <p className="text-[12px] text-acars-muted mt-1 max-w-sm mx-auto">
              {isAdmin
                ? 'No pilots currently have flights with saved flight plans. Active flights will appear here once a pilot saves a flight plan.'
                : 'Place a bid on the Schedule, create a flight plan, then your flight will appear here.'}
            </p>
          </div>
          {!isAdmin && (
            <button
              onClick={() => navigate('/schedule')}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-400/20 hover:bg-amber-500/20 transition-colors"
            >
              <CalendarDots className="w-3.5 h-3.5" /> Browse Schedule
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <DispatchEditProvider
      bidId={selectedBidId}
      phase={selectedFlight?.phase ?? 'planning'}
      isAdmin={!!isAdmin}
      isOwnFlight={!!isOwnFlight}
      flightPlanData={selectedFlight?.flightPlanData ?? null}
      releasedFields={selectedFlight?.releasedFields ?? null}
    >
      <AppShell
        dispatchFlight={selectedFlight}
        flights={flights}
        selectedBidId={selectedBidId}
        onSelectFlight={handleSelectFlight}
        ruleChips={regulatoryAssessment?.ruleChips}
      />
    </DispatchEditProvider>
  );
}
