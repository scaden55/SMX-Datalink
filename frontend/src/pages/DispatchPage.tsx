import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { useAuthStore } from '../stores/authStore';
import { useFlightPlanStore } from '../stores/flightPlanStore';
import { DispatchEditProvider } from '../contexts/DispatchEditContext';
import { api } from '../lib/api';
import { stepsToWaypoints } from '../components/planning/simbrief-parser';
import type { DispatchFlight, DispatchFlightsResponse, Airport } from '@acars/shared';

export function DispatchPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const setFlightPlan = useFlightPlanStore((s) => s.setFlightPlan);
  const setProgress = useFlightPlanStore((s) => s.setProgress);
  const setOfp = useFlightPlanStore((s) => s.setOfp);
  const setAirports = useFlightPlanStore((s) => s.setAirports);
  const airports = useFlightPlanStore((s) => s.airports);

  const [flights, setFlights] = useState<DispatchFlight[]>([]);
  const [selectedBidId, setSelectedBidId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // When selected flight changes, populate the store
  const selectedFlight = flights.find((f) => f.bid.id === selectedBidId) ?? null;

  useEffect(() => {
    if (!selectedFlight) {
      setFlightPlan(null);
      setProgress(null);
      setOfp(null);
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
  }, [selectedFlight, setFlightPlan, setProgress, setOfp]);

  // Clean up dispatch state on unmount so it doesn't contaminate the planning page store
  useEffect(() => {
    return () => {
      setFlightPlan(null);
      setProgress(null);
      setOfp(null);
    };
  }, [setFlightPlan, setProgress, setOfp]);

  const handleSelectFlight = useCallback((bidId: number) => {
    setSelectedBidId(bidId);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-acars-cyan border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-acars-muted">Loading dispatch flights...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-sm text-acars-red mb-2">Failed to load dispatch data</p>
          <p className="text-xs text-acars-muted">{error}</p>
        </div>
      </div>
    );
  }

  // Empty state — no active flights with saved plans
  if (flights.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center max-w-md space-y-3">
          <div className="text-4xl text-acars-muted/40">&#9992;</div>
          <h2 className="text-sm font-semibold text-acars-text">
            {isAdmin ? 'No Active Flights' : 'No Active Flight'}
          </h2>
          <p className="text-xs text-acars-muted leading-relaxed">
            {isAdmin
              ? 'No pilots currently have flights with saved flight plans. Active flights will appear here once a pilot saves a flight plan from the Planning page.'
              : 'You don\'t have an active flight with a saved flight plan. Place a bid on the Schedule page, then create a flight plan on the Planning page.'}
          </p>
          {!isAdmin && (
            <button
              onClick={() => navigate('/schedule')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-acars-cyan/10 text-acars-cyan border border-acars-cyan/20 hover:bg-acars-cyan/20 transition-colors"
            >
              Go to Schedule
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
      flightPlanData={selectedFlight?.flightPlanData ?? null}
    >
      <AppShell
        dispatchFlight={selectedFlight}
        flights={isAdmin ? flights : undefined}
        selectedBidId={selectedBidId}
        onSelectFlight={isAdmin ? handleSelectFlight : undefined}
      />
    </DispatchEditProvider>
  );
}
