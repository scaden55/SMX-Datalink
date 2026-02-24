import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Plane, Route, Radio, ArrowRight } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { useAuthStore } from '../stores/authStore';
import { useFlightPlanStore } from '../stores/flightPlanStore';
import { useCargoStore } from '../stores/cargoStore';
import { useSocketStore } from '../stores/socketStore';
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

    socket.on('dispatch:vatsimStatus', handleVatsimStatus);
    socket.on('flight:completed', handleFlightCompleted);
    return () => {
      socket.off('dispatch:vatsimStatus', handleVatsimStatus);
      socket.off('flight:completed', handleFlightCompleted);
    };
  }, [socket]);

  // When selected flight changes, populate the store
  const selectedFlight = flights.find((f) => f.bid.id === selectedBidId) ?? null;

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

  const handleSelectFlight = useCallback((bidId: number) => {
    setSelectedBidId(bidId);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-sky-400 border-t-transparent rounded-full mx-auto mb-3" />
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
          <p className="text-sm text-red-400 mb-2">Failed to load dispatch data</p>
          <p className="text-xs text-acars-muted">{error}</p>
        </div>
      </div>
    );
  }

  // Empty state — no active flights with saved plans
  if (flights.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center max-w-lg space-y-6">
          <h2 className="text-base font-semibold text-acars-text">
            {isAdmin ? 'No Active Flights' : 'No Active Flight'}
          </h2>

          {!isAdmin && (
            <>
              <div className="flex items-center justify-center gap-3">
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-10 h-10 rounded-md bg-amber-500/10 border border-amber-400/20 flex items-center justify-center">
                    <CalendarDays className="w-5 h-5 text-amber-400" />
                  </div>
                  <span className="text-[10px] font-medium text-amber-400">Schedule</span>
                </div>
                <ArrowRight className="w-4 h-4 text-sky-400/40" />
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-10 h-10 rounded-md bg-blue-500/10 border border-blue-400/20 flex items-center justify-center">
                    <Plane className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="text-[10px] font-medium text-blue-400">Bid</span>
                </div>
                <ArrowRight className="w-4 h-4 text-sky-400/40" />
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-10 h-10 rounded-md bg-blue-500/10 border border-blue-400/20 flex items-center justify-center">
                    <Route className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="text-[10px] font-medium text-blue-400">Plan</span>
                </div>
                <ArrowRight className="w-4 h-4 text-sky-400/40" />
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-10 h-10 rounded-md bg-sky-500/10 border border-sky-400/20 flex items-center justify-center">
                    <Radio className="w-5 h-5 text-sky-400" />
                  </div>
                  <span className="text-[10px] font-medium text-sky-400">Dispatch</span>
                </div>
              </div>

              <p className="text-xs text-acars-muted leading-relaxed max-w-sm mx-auto">
                Place a bid on the Schedule, create a flight plan on the Planning page, then your flight will appear here.
              </p>

              <button
                onClick={() => navigate('/schedule')}
                className="btn-primary btn-sm"
              >
                Go to Schedule
              </button>
            </>
          )}

          {isAdmin && (
            <p className="text-xs text-acars-muted leading-relaxed max-w-sm mx-auto">
              No pilots currently have flights with saved flight plans. Active flights will appear here once a pilot saves a flight plan from the Planning page.
            </p>
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
        ruleChips={regulatoryAssessment?.ruleChips}
      />
    </DispatchEditProvider>
  );
}
