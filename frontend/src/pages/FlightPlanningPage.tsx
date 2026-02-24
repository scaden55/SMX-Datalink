import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Route, CalendarDays, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
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
import type { MyBidsResponse, BidWithDetails, Airport, FleetAircraft } from '@acars/shared';

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
    Promise.all([
      api.get<Airport[]>('/api/airports'),
      api.get<FleetAircraft[]>('/api/fleet'),
      api.get<MyBidsResponse>('/api/bids/my'),
    ]).then(([airports, fleet, bidsRes]) => {
      setAirports(airports);
      setFleet(fleet);
      setBids(bidsRes.bids);
      setBidsLoaded(true);
    }).catch((err) => {
      console.error('[Planning] Failed to load reference data:', err);
      setBidsLoaded(true);
    });
  }, [setAirports, setFleet]);

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

    let cancelled = false;

    api.get<{ ofpJson: any; flightPlanData: any; phase: string }>(`/api/bids/${numBidId}/flight-plan`)
      .catch(() => null)
      .then((planRes) => {
        if (cancelled) return;

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
          setPhase((planRes.phase as any) ?? 'planning');
        } else if (bid) {
          replaceForm({
            ...emptyForm,
            origin: bid.depIcao,
            destination: bid.arrIcao,
            flightNumber: bid.flightNumber,
            aircraftType: bid.aircraftType,
            etd: bid.depTime,
          });
        }

        setLoading(false);
      }).catch((err) => {
        if (cancelled) return;
        console.error('[Planning] Failed to load bid:', err);
        setError('Failed to load flight plan data');
        setLoading(false);
      });

    return () => { cancelled = true; };
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
    } catch (err) {
      console.error('[Planning] Start flight failed:', err);
    } finally {
      setSavingFlightPlan(false);
    }
  }, [activeBidId, ofp, form, setSavingFlightPlan, navigate]);

  // Empty state — no bids
  if (!bidId && bidsLoaded && !activeBidId && bids.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-4 bg-acars-bg">
        <img src="./logos/chevron-light.png" alt="SMA" className="h-12 w-auto opacity-10" />
        <div className="flex items-center justify-center w-14 h-14 rounded-md bg-blue-500/10 border border-blue-400/20">
          <Route className="w-7 h-7 text-blue-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-acars-text font-sans">No Active Bids</h2>
          <p className="text-[11px] text-acars-muted font-sans mt-1">Browse the schedule and place a bid to start planning a cargo run</p>
        </div>
        <button
          onClick={() => navigate('/schedule')}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-semibold font-sans text-amber-400 bg-amber-500/10 border border-amber-400/20 hover:bg-amber-500/20 transition-colors"
        >
          <CalendarDays className="w-3.5 h-3.5" /> Browse Schedule
        </button>
      </div>
    );
  }

  // Bid picker
  if (!bidId && bidsLoaded && !activeBidId && bids.length > 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-4 bg-acars-bg">
        <img src="./logos/chevron-light.png" alt="SMA" className="h-12 w-auto opacity-10" />
        <div className="flex items-center justify-center w-14 h-14 rounded-md bg-blue-500/10 border border-blue-400/20">
          <Route className="w-7 h-7 text-blue-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-acars-text font-sans">Select a Bid to Plan</h2>
          <p className="text-[11px] text-acars-muted font-sans mt-1">Choose one of your active bids</p>
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
      <div className="flex items-center justify-center h-full bg-acars-bg">
        <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-3 bg-acars-bg">
        <p className="text-[11px] text-red-400 font-sans">{error}</p>
        <button
          onClick={() => navigate('/schedule')}
          className="text-[10px] text-blue-400 hover:underline font-sans"
        >
          Back to Schedule
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-acars-bg planning-tnum">
      {/* Left: Form */}
      <PlanningLeftPanel
        onGenerate={handleGenerate}
        onFetch={handleFetch}
        onStartFlight={handleStartFlight}
      />

      {/* Center: Map + Profile + Info */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {simbriefError && (
          <div className="px-3 py-1.5 bg-red-500/10 border-b border-red-400/20 text-[11px] text-red-400 font-sans">
            {simbriefError}
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
          <div className="fixed top-0 right-0 bottom-0 w-80 bg-acars-panel border-l border-acars-border z-[9999] shadow-2xl">
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
