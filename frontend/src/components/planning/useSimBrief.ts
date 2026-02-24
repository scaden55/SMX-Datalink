import { useCallback, useRef, useEffect } from 'react';
import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { parseSimBriefResponse, ofpToFormFields, stepsToWaypoints } from './simbrief-parser';
import { api, getApiBase } from '../../lib/api';
import { useCargoStore } from '../../stores/cargoStore';
import type { CargoManifest } from '@acars/shared';

const SIMBRIEF_LOADER_URL = 'https://www.simbrief.com/ofp/ofp.loader.api.php';

/** Two hours in seconds (for comparing Unix timestamps) */
const OFP_FRESHNESS_S = 2 * 60 * 60;

/**
 * Build query string for the SimBrief API v1 loader popup.
 */
function buildLoaderParams(
  form: ReturnType<typeof useFlightPlanStore.getState>['form'],
  fleet: ReturnType<typeof useFlightPlanStore.getState>['fleet'],
  apicode: string,
  timestamp: string,
  outputpage: string,
): URLSearchParams {
  const params = new URLSearchParams();

  // Required
  params.set('orig', form.origin);
  params.set('dest', form.destination);
  params.set('type', form.aircraftType.toLowerCase());

  // Flight info
  if (form.flightNumber) {
    const match = form.flightNumber.match(/^([A-Z]{2,3})(\d+)$/i);
    if (match) {
      params.set('airline', match[1].toUpperCase());
      params.set('fltnum', match[2]);
    } else {
      params.set('fltnum', form.flightNumber);
    }
  }

  // Departure date
  if (form.depDate) {
    params.set('date', form.depDate);
  }

  // Departure time
  if (form.etd) {
    const [hh, mm] = form.etd.split(':');
    if (hh) params.set('deph', hh);
    if (mm) params.set('depm', mm);
  }

  // Route
  if (form.route) params.set('route', form.route);

  // Cruise altitude
  if (form.cruiseFL) {
    const fl = form.cruiseFL.replace(/^FL/i, '');
    const alt = parseInt(fl, 10);
    if (!isNaN(alt)) {
      params.set('fl', String(alt < 1000 ? alt * 100 : alt));
    }
  }

  // Cost index
  if (form.costIndex) params.set('civalue', form.costIndex);

  // Flight rules
  params.set('flightrules', form.flightRules === 'VFR' ? 'v' : 'i');

  // Alternates
  if (form.alternate1) params.set('altn', form.alternate1);
  if (form.alternate2) {
    params.set('altn_count', '2');
    params.set('altn_1_id', form.alternate1);
    params.set('altn_2_id', form.alternate2);
  }

  // Passengers & cargo
  if (form.paxCount) params.set('pax', form.paxCount);
  if (form.cargoLbs) params.set('cargo', form.cargoLbs);

  // Manual weights
  if (form.estZfw) params.set('manualzfw', form.estZfw);
  if (form.payload) params.set('manualpayload', form.payload);

  // Fuel fields
  if (form.fuelExtra) params.set('addedfuel', form.fuelExtra);
  if (form.fuelTaxi) params.set('taxifuel', form.fuelTaxi);

  // Aircraft registration from fleet
  const selected = fleet.find((a) => a.id === form.aircraftId);
  if (selected?.registration) params.set('reg', selected.registration);

  // Remarks
  if (form.dispatcherRemarks) params.set('manualrmk', form.dispatcherRemarks);

  // SimBrief generation options
  params.set('units', form.units);
  params.set('contpct', form.contpct);
  params.set('resvrule', form.resvrule);
  params.set('navlog', '1');
  params.set('stepclimbs', form.stepclimbs ? '1' : '0');
  params.set('etops', form.etops ? '1' : '0');
  params.set('tlr', form.tlr ? '1' : '0');
  params.set('notams', form.inclNotams ? '1' : '0');
  params.set('firnot', form.firnot ? '1' : '0');
  params.set('maps', form.maps);
  if (form.planformat) params.set('planformat', form.planformat);

  // API auth params
  params.set('apicode', apicode);
  params.set('outputpage', outputpage);
  params.set('timestamp', timestamp);

  return params;
}

/**
 * Check whether a SimBrief OFP was generated recently (< 2 hours ago).
 * Uses `params.time_generated` (the generation Unix timestamp) instead of
 * `schedDep` — departure time can be far in the past/future and isn't a
 * reliable freshness indicator.
 */
function isOfpFreshByGenTime(json: any): boolean {
  const genTime = Number(json?.params?.time_generated);
  if (!genTime || isNaN(genTime)) return false;
  return (Date.now() / 1000) - genTime < OFP_FRESHNESS_S;
}

/**
 * JSON round-trip: normalizes data to plain JSON types.
 * Mirrors the save→reload path (JSON.stringify → SQLite → JSON.parse) which
 * strips any edge-case non-serializable values from the SimBrief response.
 * Prevents React error #310 in Electron where the raw API response may contain
 * nested objects that parseSimBriefResponse doesn't fully flatten to primitives.
 */
function jsonNormalize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function useSimBrief() {
  const {
    form,
    fleet,
    setForm,
    setOfp,
    setSteps,
    setPlanningWaypoints,
    setSimbriefLoading,
    simbriefLoading,
  } = useFlightPlanStore();

  const activeBidId = useFlightPlanStore((s) => s.activeBidId);

  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Cancel any active popup polling and timeout */
  const cancelPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => cancelPolling();
  }, [cancelPolling]);

  /** Fire-and-forget cargo manifest generation after OFP is applied. */
  const triggerCargoGeneration = useCallback((ofp: any, mergedForm: any, bidId: number) => {
    const cargoConfig = useCargoStore.getState().config;
    const payloadWeight = ofp.weights?.payload || 0;
    const aircraftIcao = ofp.aircraftType || mergedForm.aircraftType || '';

    if (payloadWeight <= 0 || !aircraftIcao || !bidId) return;

    // Send raw payload weight with original unit — backend handles conversion
    useCargoStore.getState().setGenerating(true);
    api.post<CargoManifest>('/api/cargo/generate', {
      flightId: bidId,
      aircraftIcao,
      payloadKg: payloadWeight,
      payloadUnit: mergedForm.units || 'LBS',
      cargoMode: cargoConfig.cargoMode,
      primaryCategory: cargoConfig.cargoMode === 'single' ? cargoConfig.primaryCategory : undefined,
      useRealWorldCompanies: cargoConfig.useRealWorldCompanies,
    })
      .then((manifest) => useCargoStore.getState().setManifest(manifest))
      .catch((err) => console.error('[Cargo] Auto-generate failed:', err))
      .finally(() => useCargoStore.getState().setGenerating(false));
  }, []);

  /**
   * Fetch the latest OFP via backend proxy (avoids CORS).
   */
  const fetchOFP = useCallback(async () => {
    setSimbriefLoading(true);
    try {
      const json = await api.get<any>('/api/simbrief/ofp');

      if (json.fetch?.status === 'Error') {
        throw new Error(json.fetch.result ?? 'SimBrief fetch error');
      }

      const ofp = jsonNormalize(parseSimBriefResponse(json));

      // Validate OFP route matches the active bid
      const currentForm = useFlightPlanStore.getState().form;
      if (currentForm.origin && ofp.origin && currentForm.origin !== ofp.origin) {
        throw new Error(
          `OFP origin (${ofp.origin}) doesn't match your bid origin (${currentForm.origin}). Generate a new OFP for this route first.`
        );
      }
      if (currentForm.destination && ofp.destination && currentForm.destination !== ofp.destination) {
        throw new Error(
          `OFP destination (${ofp.destination}) doesn't match your bid destination (${currentForm.destination}). Generate a new OFP for this route first.`
        );
      }

      const formFields = ofpToFormFields(ofp);
      const waypoints = stepsToWaypoints(ofp.steps);

      setOfp(ofp);
      setSteps(ofp.steps);
      setPlanningWaypoints(waypoints);

      // Re-read form after store updates above
      const latestForm = useFlightPlanStore.getState().form;
      const mergedForm = {
        ...latestForm,
        ...formFields,
        // Preserve manually-set fields
        flightNumber: latestForm.flightNumber || formFields.origin + '-' + formFields.destination,
        etd: latestForm.etd || '',
      };
      setForm(mergedForm);

      // Auto-save to backend so data persists across navigation
      const bidId = useFlightPlanStore.getState().activeBidId;
      if (bidId) {
        api.put(`/api/bids/${bidId}/flight-plan`, {
          ofpJson: ofp,
          flightPlanData: mergedForm,
          phase: 'planning',
        }).catch((err) => console.error('[SimBrief] Auto-save failed:', err));

        // Auto-generate cargo manifest
        triggerCargoGeneration(ofp, mergedForm, bidId);
      }
    } catch (err) {
      console.error('[SimBrief] Fetch failed:', err);
      throw err;
    } finally {
      setSimbriefLoading(false);
    }
  }, [activeBidId, setSimbriefLoading, setOfp, setSteps, setPlanningWaypoints, setForm, triggerCargoGeneration]);

  /**
   * Generate OFP via SimBrief API v1 popup flow.
   * Opens a popup to SimBrief, monitors it, and auto-fetches the result.
   */
  const generateOFP = useCallback(async () => {
    // Guard against concurrent generation attempts
    if (useFlightPlanStore.getState().simbriefLoading) return;

    // Validate required fields
    const currentForm = useFlightPlanStore.getState().form;
    if (!currentForm.origin || !currentForm.destination || !currentForm.aircraftType) {
      throw new Error('Origin, destination, and aircraft type are required');
    }

    // Pre-check: SimBrief username must be configured to retrieve the OFP
    try {
      const profileRes = await api.get<{ simbriefUsername: string | null }>('/api/profile/simbrief');
      if (!profileRes.simbriefUsername) {
        throw new Error('SimBrief username not set — go to Settings to configure it before generating an OFP');
      }
    } catch (err: any) {
      if (err?.message?.includes('SimBrief username')) throw err;
      // Network error — continue and let the generation attempt proceed
    }

    setSimbriefLoading(true);

    try {
      // Callback URL: in Electron the origin is file:// which SimBrief can't
      // redirect to, so use the backend base URL directly instead.
      const base = window.electronAPI ? getApiBase() : window.location.origin;
      const callbackUrl = base + '/api/simbrief/callback';

      // Get API code from backend
      const { apicode, timestamp, outputpage } = await api.post<{
        apicode: string;
        timestamp: string;
        outputpage: string;
      }>('/api/simbrief/apicode', {
        orig: currentForm.origin,
        dest: currentForm.destination,
        type: currentForm.aircraftType.toLowerCase(),
        outputpage: callbackUrl,
      });

      // Build loader URL
      const currentFleet = useFlightPlanStore.getState().fleet;
      const params = buildLoaderParams(currentForm, currentFleet, apicode, timestamp, outputpage);
      const loaderUrl = `${SIMBRIEF_LOADER_URL}?${params.toString()}`;

      // Clean up any previous popup/polling before starting new one
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
      cancelPolling();

      // Open SimBrief generation popup (or system browser in Electron)
      const popup = window.open(loaderUrl, 'SBworker', 'width=600,height=400');
      popupRef.current = popup;

      if (!popup) {
        // In Electron, setWindowOpenHandler opens the URL in the system browser
        // but returns null (action: 'deny'). This is expected — not a blocked popup.
        // Poll the SimBrief API until a fresh OFP appears.
        if (window.electronAPI?.isElectron) {
          console.log('[SimBrief] Opened in system browser — polling for OFP completion');

          // Track the OFP generation timestamp before generation to detect a new one.
          // Using `params.time_generated` (Unix timestamp of OFP creation) instead of
          // `schedDep` because departure time can repeat across regenerations.
          let preGenerateTimestamp: string | null = null;
          try {
            const preCheck = await api.get<any>('/api/simbrief/ofp');
            if (!preCheck.fetch?.status?.startsWith?.('Error')) {
              preGenerateTimestamp = preCheck.params?.time_generated ?? null;
            }
          } catch {
            // No existing OFP — fine, any OFP we find will be new
          }

          // Poll every 4 seconds for a fresh OFP
          let pollErrorCount = 0;
          let pollBusy = false; // guard against overlapping async callbacks
          pollRef.current = setInterval(async () => {
            if (pollBusy) return;
            pollBusy = true;
            try {
              const json = await api.get<any>('/api/simbrief/ofp');

              if (json.fetch?.status?.startsWith?.('Error')) {
                // Permanent SimBrief-level errors (e.g. "Error: Unknown UserID")
                // These won't resolve by retrying — stop immediately
                const errMsg = json.fetch.status as string;
                console.error('[SimBrief] Permanent API error:', errMsg);
                cancelPolling();
                setSimbriefLoading(false);
                return;
              }

              // Only accept a recently-generated OFP (< 2 hours old)
              if (!isOfpFreshByGenTime(json)) return;

              // If we had a pre-existing OFP, only accept if generation timestamp
              // changed (meaning SimBrief produced a new OFP, not the cached one)
              const genTimestamp = json.params?.time_generated;
              if (preGenerateTimestamp && genTimestamp === preGenerateTimestamp) return;

              // Fresh OFP available — stop polling and apply it
              cancelPolling();
              try {
                await fetchOFP();
              } catch (fetchErr) {
                console.error('[SimBrief] Failed to apply OFP after polling:', fetchErr);
              }
            } catch (pollErr: any) {
              pollErrorCount++;
              // Detect permanent failures — stop polling instead of spinning forever
              const status = pollErr?.status;
              if (status === 400 || status === 401 || status === 403 || pollErrorCount >= 5) {
                cancelPolling();
                setSimbriefLoading(false);
                console.error('[SimBrief] Permanent fetch error:', pollErr?.message);
              }
              // Transient errors (network, 502, 504) — keep polling
            } finally {
              pollBusy = false;
            }
          }, 4000);

          // Safety timeout — stop polling after 5 minutes
          timeoutRef.current = setTimeout(() => {
            cancelPolling();
            setSimbriefLoading(false);
            console.warn('[SimBrief] Generation timed out');
          }, 300_000);

          return; // URL was opened externally — don't throw
        }

        setSimbriefLoading(false);
        throw new Error('Popup blocked — please allow popups for this site');
      }

      // Browser: monitor popup closure — single interval, cancellable
      pollRef.current = setInterval(async () => {
        if (!popup || popup.closed) {
          cancelPolling();

          // Brief delay for SimBrief to finalize
          await new Promise((r) => setTimeout(r, 1500));

          // Auto-fetch the generated OFP
          try {
            await fetchOFP();
          } catch (err) {
            console.error('[SimBrief] Auto-fetch after generate failed:', err);
            setSimbriefLoading(false);
          }
        }
      }, 500);

      // Safety timeout — stop polling after 5 minutes
      timeoutRef.current = setTimeout(() => {
        cancelPolling();
        setSimbriefLoading(false);
        console.warn('[SimBrief] Generation timed out');
      }, 300_000);

    } catch (err) {
      setSimbriefLoading(false);
      throw err;
    }
  }, [setSimbriefLoading, fetchOFP, cancelPolling]);

  /**
   * Smart generate: if an OFP already exists for this bid and its departure
   * time is less than 2 hours old, just fetch the existing one.
   * Otherwise, open the SimBrief generation popup.
   */
  const generateOrFetchOFP = useCallback(async () => {
    // First try fetching the existing OFP to see if it's still fresh
    try {
      setSimbriefLoading(true);
      const json = await api.get<any>('/api/simbrief/ofp');

      if (json.fetch?.status !== 'Error') {
        const existingOfp = jsonNormalize(parseSimBriefResponse(json));

        // Check route matches current bid
        const currentForm = useFlightPlanStore.getState().form;
        const routeMatches =
          (!currentForm.origin || !existingOfp.origin || currentForm.origin === existingOfp.origin) &&
          (!currentForm.destination || !existingOfp.destination || currentForm.destination === existingOfp.destination);

        if (routeMatches && isOfpFreshByGenTime(json)) {
          // OFP is fresh and route matches — use it directly
          const formFields = ofpToFormFields(existingOfp);
          const waypoints = stepsToWaypoints(existingOfp.steps);

          setOfp(existingOfp);
          setSteps(existingOfp.steps);
          setPlanningWaypoints(waypoints);

          const latestForm = useFlightPlanStore.getState().form;
          const mergedForm = {
            ...latestForm,
            ...formFields,
            flightNumber: latestForm.flightNumber || formFields.origin + '-' + formFields.destination,
            etd: latestForm.etd || '',
          };
          setForm(mergedForm);

          // Auto-save
          const bidId = useFlightPlanStore.getState().activeBidId;
          if (bidId) {
            api.put(`/api/bids/${bidId}/flight-plan`, {
              ofpJson: existingOfp,
              flightPlanData: mergedForm,
              phase: 'planning',
            }).catch((err) => console.error('[SimBrief] Auto-save failed:', err));

            // Auto-generate cargo manifest
            triggerCargoGeneration(existingOfp, mergedForm, bidId);
          }

          setSimbriefLoading(false);
          return;
        }
      }
    } catch {
      // Fetch failed or no existing OFP — fall through to generate
    }

    setSimbriefLoading(false);

    // No fresh OFP found — generate a new one (this sets its own loading state)
    await generateOFP();
  }, [generateOFP, setSimbriefLoading, setOfp, setSteps, setPlanningWaypoints, setForm, triggerCargoGeneration]);

  return { fetchOFP, generateOFP, generateOrFetchOFP, simbriefLoading };
}
