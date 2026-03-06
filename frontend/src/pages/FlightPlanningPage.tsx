import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Path, CalendarDots, SpinnerGap, Warning } from '@phosphor-icons/react';
import { api } from '../lib/api';
import { toast } from '../stores/toastStore';
import { useFlightPlanStore, emptyForm } from '../stores/flightPlanStore';
import { useCargoStore } from '../stores/cargoStore';
import { useSimBrief } from '../components/planning/useSimBrief';
import { useWeather } from '../components/planning/useWeather';
import { useRoutePreview } from '../hooks/useRoutePreview';
import { PlanningLeftPanel } from '../components/planning/PlanningLeftPanel';
import { PlanningMap } from '../components/planning/PlanningMap';
import { PlanningAltitudeProfile } from '../components/planning/PlanningAltitudeProfile';
import { PlanningInfoPanel } from '../components/planning/PlanningInfoPanel';
import { PlanningRightPanel } from '../components/planning/PlanningRightPanel';
import { VatsimPrefile } from '../components/planning/VatsimPrefile';
import { stepsToWaypoints } from '../components/planning/simbrief-parser';
import type { MyBidsResponse, BidWithDetails, Airport, FleetAircraft, FlightPlanPhase } from '@acars/shared';

export function FlightPlanningPage() {
  const { bidId } = useParams<{ bidId?: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [simbriefError, setSimbriefError] = useState('');
  const [bids, setBids] = useState<BidWithDetails[]>([]);
  const [bidsLoaded, setBidsLoaded] = useState(false);
  const [showVatsimPrefile, setShowVatsimPrefile] = useState(false);
  const redirectedRef = useRef(false);

  const {
    form,
    setForm,
    replaceForm,
    setActiveBidId,
    setFleet,
    setAirports,
    setOfp,
    setSteps,
    setPlanningWaypoints,
    setPhase,
    setSavingFlightPlan,
    resetForm,
    activeBidId,
    ofp,
    airports,
    fleet,
  } = useFlightPlanStore();

  const { generateOFP, fetchOFP, generateOrFetchOFP } = useSimBrief();
  useWeather();
  useRoutePreview();

  // Load reference data + bids on mount
  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      api.get<Airport[]>('/api/airports'),
      api.get<FleetAircraft[]>('/api/fleet'),
      api.get<MyBidsResponse>('/api/bids/my'),
    ]).then(([airports, fleet, bidsRes]) => {
      if (controller.signal.aborted) return;
      setAirports(airports);
      setFleet(fleet);
      setBids(bidsRes.bids);
      setBidsLoaded(true);
    }).catch((err) => {
      if (controller.signal.aborted) return;
      console.error('[Planning] Failed to load reference data:', err);
      toast.error('Failed to load reference data');
      setBidsLoaded(true);
    });

    return () => controller.abort();
  }, [setAirports, setFleet]);

  // Fetch any route airports missing from the store (e.g. non-hub airports only in oa_airports).
  // Keeps a ref of attempted ICAOs to avoid re-fetching 404s (prevents infinite loops).
  // Depends on `airports` so it re-runs after the bulk hub-airports load completes.
  const fetchedAirportsRef = useRef(new Set<string>());
  useEffect(() => {
    const icaos = [form.origin, form.destination, form.alternate1, form.alternate2].filter(Boolean);
    if (icaos.length === 0 || airports.length === 0) return;

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
  }, [form.origin, form.destination, form.alternate1, form.alternate2, airports, setAirports]);

  // Auto-redirect: if no bidId in URL but activeBidId in store, restore it
  useEffect(() => {
    if (bidId || !bidsLoaded || redirectedRef.current) return;

    if (activeBidId && bids.some((b) => b.id === activeBidId)) {
      redirectedRef.current = true;
      navigate(`/planning/${activeBidId}`, { replace: true });
    }
  }, [bidId, bidsLoaded, activeBidId, bids, navigate]);

  // Load bid data when bidId changes
  useEffect(() => {
    if (!bidId) {
      setLoading(false);
      return;
    }

    const numBidId = parseInt(bidId, 10);
    if (isNaN(numBidId)) {
      setError('Invalid bid ID');
      setLoading(false);
      return;
    }

    resetForm();
    useCargoStore.getState().clearCargo();
    setActiveBidId(numBidId);
    setLoading(true);
    setError('');

    const controller = new AbortController();

    api.get<{ ofpJson: any; flightPlanData: any; phase: FlightPlanPhase }>(`/api/bids/${numBidId}/flight-plan`)
      .catch(() => null)
      .then((planRes) => {
        if (controller.signal.aborted) return;

        const bid = bids.find((b) => b.id === numBidId);

        if (planRes?.flightPlanData) {
          replaceForm(planRes.flightPlanData);
          if (planRes.ofpJson) {
            setOfp(planRes.ofpJson);
            if (planRes.ofpJson.steps) {
              setSteps(planRes.ofpJson.steps);
              const currentAirports = useFlightPlanStore.getState().airports;
              const depApt = currentAirports.find((a: Airport) => a.icao === planRes.ofpJson.origin);
              const arrApt = currentAirports.find((a: Airport) => a.icao === planRes.ofpJson.destination);
              const ob = depApt ? { icao: depApt.icao, lat: depApt.lat, lon: depApt.lon, elevation: depApt.elevation } : undefined;
              const db = arrApt ? { icao: arrApt.icao, lat: arrApt.lat, lon: arrApt.lon, elevation: arrApt.elevation } : undefined;
              setPlanningWaypoints(stepsToWaypoints(planRes.ofpJson.steps, ob, db));
            }
          }
          setPhase(planRes.phase ?? 'planning');
        } else if (bid) {
          replaceForm({
            ...emptyForm,
            origin: bid.depIcao,
            destination: bid.arrIcao,
            flightNumber: bid.flightNumber,
            aircraftType: bid.aircraftType ?? '',
            etd: bid.depTime,
          });
        }

        setLoading(false);
      }).catch((err) => {
        if (controller.signal.aborted) return;
        console.error('[Planning] Failed to load bid:', err);
        toast.error('Failed to load flight plan');
        setError('Failed to load flight plan data');
        setLoading(false);
      });

    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run on URL bidId or bids list changes
  }, [bidId, bids]);

  const handleSelectBid = useCallback((id: number) => {
    navigate(`/planning/${id}`, { replace: true });
  }, [navigate]);

  const handleGenerate = useCallback(async () => {
    setSimbriefError('');
    try {
      await generateOFP();
    } catch (err: any) {
      setSimbriefError(err?.message ?? 'Failed to generate OFP');
    }
  }, [generateOFP]);

  const handleFetch = useCallback(async () => {
    setSimbriefError('');
    try {
      await fetchOFP();
    } catch (err: any) {
      setSimbriefError(err?.message ?? 'Failed to fetch OFP');
    }
  }, [fetchOFP]);

  const handleStartFlight = useCallback(async () => {
    if (!activeBidId) return;
    setSavingFlightPlan(true);
    try {
      await api.put(`/api/bids/${activeBidId}/flight-plan`, {
        ofpJson: ofp,
        flightPlanData: form,
        phase: 'active',
      });
      navigate('/dispatch');
    } catch (err: any) {
      console.error('[Planning] Start flight failed:', err);
      toast.error(err?.message || 'Failed to start flight');
    } finally {
      setSavingFlightPlan(false);
    }
  }, [activeBidId, ofp, form, setSavingFlightPlan, navigate]);

  // Empty state — no bids
  if (!bidId && bidsLoaded && !activeBidId && bids.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-4 bg-transparent">
        <img src="./logos/chevron-light.png" alt="SMX" className="h-12 w-auto opacity-10" />
        <div className="flex items-center justify-center w-12 h-12 rounded-md bg-[#3b5bdb]/10 border border-[#3b5bdb]/20">
          <Path className="w-5 h-5 text-[#6b8aff]" />
        </div>
        <div>
          <h2 className="text-[13px] font-semibold text-acars-text">No Active Bids</h2>
          <p className="text-[11px] text-acars-muted mt-1">Browse the schedule and place a bid to start planning a cargo run</p>
        </div>
        <button
          onClick={() => navigate('/schedule')}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-400/20 hover:bg-amber-500/20 transition-colors"
        >
          <CalendarDots className="w-3.5 h-3.5" /> Browse Schedule
        </button>
      </div>
    );
  }

  // Bid picker
  if (!bidId && bidsLoaded && !activeBidId && bids.length > 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-4 bg-transparent">
        <img src="./logos/chevron-light.png" alt="SMX" className="h-12 w-auto opacity-10" />
        <div className="flex items-center justify-center w-12 h-12 rounded-md bg-[#3b5bdb]/10 border border-[#3b5bdb]/20">
          <Path className="w-5 h-5 text-[#6b8aff]" />
        </div>
        <div>
          <h2 className="text-[13px] font-semibold text-acars-text">Select a Bid to Plan</h2>
          <p className="text-[11px] text-acars-muted mt-1">Choose one of your active bids</p>
        </div>
        <div className="w-72">
          <select
            onChange={(e) => {
              const id = parseInt(e.target.value, 10);
              if (!isNaN(id)) handleSelectBid(id);
            }}
            defaultValue=""
            className="select-field h-auto py-2 text-[11px]"
          >
            <option value="" disabled>Select a bid...</option>
            {bids.map((b) => (
              <option key={b.id} value={b.id}>
                {b.flightNumber} — {b.depIcao} → {b.arrIcao} ({b.aircraftType}) {b.depTime}Z
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  // Loading
  if (loading || !bidsLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-transparent">
        <SpinnerGap className="w-5 h-5 text-[#6b8aff] animate-spin" />
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-3 bg-transparent">
        <p className="text-[11px] text-red-400">{error}</p>
        <button
          onClick={() => navigate('/schedule')}
          className="text-[10px] text-[#6b8aff] hover:underline"
        >
          Back to Schedule
        </button>
      </div>
    );
  }

  // Aircraft location mismatch detection
  const currentBid = bids.find(b => b.id === activeBidId);
  const bidAircraft = currentBid?.aircraftId ? fleet.find(f => f.id === currentBid.aircraftId) : null;
  const effectiveLocation = bidAircraft?.locationIcao ?? bidAircraft?.baseIcao;
  const aircraftNotAtDeparture = ofp && bidAircraft && effectiveLocation && effectiveLocation !== currentBid?.depIcao;

  return (
    <div className="flex h-full overflow-hidden bg-transparent planning-tnum">
      {/* Left: Form */}
      <PlanningLeftPanel
        onGenerate={handleGenerate}
        onFetch={handleFetch}
        onStartFlight={handleStartFlight}
      />

      {/* Center: Map + Profile + Info */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {simbriefError && (
          <div className="px-3 py-1.5 bg-red-500/10 border-b border-red-400/20 text-[11px] text-red-400">
            {simbriefError}
          </div>
        )}
        {aircraftNotAtDeparture && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border-b border-amber-400/20 text-[11px] text-amber-400 shrink-0">
            <Warning className="w-4 h-4 shrink-0" weight="fill" />
            <span>
              <span className="font-semibold">{bidAircraft.registration}</span> is currently at{' '}
              <span className="tabular-nums font-semibold">{effectiveLocation}</span>, not departure airport{' '}
              <span className="tabular-nums font-semibold">{currentBid!.depIcao}</span>.
              Aircraft must be repositioned before starting this flight.
            </span>
          </div>
        )}
        <div className="flex-[5] min-h-0">
          <PlanningMap />
        </div>
        <PlanningAltitudeProfile />
        <PlanningInfoPanel />
      </div>

      {/* VATSIM Prefile slide-over */}
      {showVatsimPrefile && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-[9998]"
            onClick={() => setShowVatsimPrefile(false)}
          />
          <div className="fixed top-0 right-0 bottom-0 w-80 border-l border-white/[0.06] z-[9999] shadow-2xl" style={{ background: 'linear-gradient(to top right, #000000, #1B1B1C)' }}>
            <VatsimPrefile
              form={form}
              ofp={ofp}
              aircraft={fleet.find(a => a.icaoType === form.aircraftType) ?? null}
              onClose={() => setShowVatsimPrefile(false)}
            />
          </div>
        </>
      )}

      {/* Right: Bid selector + VATSIM file */}
      <PlanningRightPanel
        bids={bids}
        onSelectBid={handleSelectBid}
        onFileVatsim={() => setShowVatsimPrefile(true)}
      />
    </div>
  );
}
