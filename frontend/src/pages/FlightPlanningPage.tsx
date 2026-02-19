import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Route, CalendarDays, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { useFlightPlanStore, emptyForm } from '../stores/flightPlanStore';
import { useSimBrief } from '../components/planning/useSimBrief';
import { useWeather } from '../components/planning/useWeather';
import { PlanningLeftPanel } from '../components/planning/PlanningLeftPanel';
import { PlanningMap } from '../components/planning/PlanningMap';
import { PlanningAltitudeProfile } from '../components/planning/PlanningAltitudeProfile';
import { PlanningInfoPanel } from '../components/planning/PlanningInfoPanel';
import { PlanningRightPanel } from '../components/planning/PlanningRightPanel';
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
  } = useFlightPlanStore();

  const { fetchOFP, generateOFP } = useSimBrief();
  useWeather(); // auto-fetches on form.origin/dest changes

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
  // NOTE: activeBidId is intentionally NOT in the dep array — it's written here,
  // not read as input. Including it caused a double-fire race condition where the
  // second run hit the guard and skipped loading, leaving stale form data.
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

    // Always clear + reload when the URL bid changes
    resetForm();
    setActiveBidId(numBidId);
    setLoading(true);
    setError('');

    let cancelled = false;

    api.get<{ ofpJson: any; flightPlanData: any; phase: string }>(`/api/bids/${numBidId}/flight-plan`)
      .catch(() => null)
      .then((planRes) => {
        if (cancelled) return;

        // Find bid from our already-fetched list
        const bid = bids.find((b) => b.id === numBidId);

        // If saved plan exists, restore it (full replace, not merge)
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
          // No saved plan — populate defaults from bid
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

  // Handle bid selection from dropdown
  const handleSelectBid = useCallback((id: number) => {
    navigate(`/planning/${id}`, { replace: true });
  }, [navigate]);

  // Generate OFP via SimBrief API v1 popup
  const handleGenerate = useCallback(async () => {
    setSimbriefError('');
    try {
      await generateOFP();
    } catch (err: any) {
      setSimbriefError(err?.message ?? 'Failed to generate OFP');
    }
  }, [generateOFP]);

  // Manual fetch latest OFP
  const handleFetchLatest = useCallback(async () => {
    setSimbriefError('');
    try {
      await fetchOFP();
    } catch (err: any) {
      setSimbriefError(err?.message ?? 'Failed to fetch OFP');
    }
  }, [fetchOFP]);

  // Save handler
  const handleSave = useCallback(async () => {
    if (!activeBidId) return;
    setSavingFlightPlan(true);
    try {
      await api.put(`/api/bids/${activeBidId}/flight-plan`, {
        ofpJson: ofp,
        flightPlanData: form,
        phase: 'planning',
      });
    } catch (err) {
      console.error('[Planning] Save failed:', err);
    } finally {
      setSavingFlightPlan(false);
    }
  }, [activeBidId, ofp, form, setSavingFlightPlan]);

  // No bid in URL, bids loaded, no activeBidId to redirect to, and no bids at all → empty state
  if (!bidId && bidsLoaded && !activeBidId && bids.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-acars-magenta/10 border border-acars-magenta/20">
          <Route className="w-8 h-8 text-acars-magenta" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-acars-text">No Active Bids</h2>
          <p className="text-sm text-acars-muted mt-1">Browse the schedule and place a bid to start planning a flight</p>
        </div>
        <button
          onClick={() => navigate('/schedule')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold text-acars-amber bg-acars-amber/10 border border-acars-amber/20 hover:bg-acars-amber/20 transition-colors"
        >
          <CalendarDays className="w-4 h-4" /> Browse Schedule
        </button>
      </div>
    );
  }

  // No bid selected yet, but bids exist → show bid picker prompt
  if (!bidId && bidsLoaded && !activeBidId && bids.length > 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-acars-blue/10 border border-acars-blue/20">
          <Route className="w-8 h-8 text-acars-blue" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-acars-text">Select a Bid to Plan</h2>
          <p className="text-sm text-acars-muted mt-1">Choose one of your active bids</p>
        </div>
        <div className="w-80">
          <select
            onChange={(e) => {
              const id = parseInt(e.target.value, 10);
              if (!isNaN(id)) handleSelectBid(id);
            }}
            defaultValue=""
            className="w-full rounded bg-acars-panel border border-acars-border text-acars-text text-sm px-3 py-2.5 outline-none focus:border-acars-blue transition-colors cursor-pointer"
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

  // Still loading initial data
  if (loading || !bidsLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 text-acars-blue animate-spin" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-3">
        <p className="text-sm text-acars-red">{error}</p>
        <button
          onClick={() => navigate('/schedule')}
          className="text-xs text-acars-blue hover:underline"
        >
          Back to Schedule
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Form */}
      <PlanningLeftPanel
        onGenerate={handleGenerate}
        onFetchLatest={handleFetchLatest}
        onSave={handleSave}
      />

      {/* Center: Map + Profile + Info */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {simbriefError && (
          <div className="px-4 py-2 bg-acars-red/10 border-b border-acars-red/20 text-[11px] text-acars-red">
            {simbriefError}
          </div>
        )}
        <div className="flex-[5] min-h-0">
          <PlanningMap />
        </div>
        <PlanningAltitudeProfile />
        <PlanningInfoPanel />
      </div>

      {/* Right: Bid selector + phase */}
      <PlanningRightPanel bids={bids} onSelectBid={handleSelectBid} />
    </div>
  );
}
