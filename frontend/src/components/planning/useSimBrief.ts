import { useCallback, useRef, useEffect } from 'react';
import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { parseSimBriefResponse, ofpToFormFields, stepsToWaypoints } from './simbrief-parser';
import { api } from '../../lib/api';

const SIMBRIEF_LOADER_URL = 'https://www.simbrief.com/ofp/ofp.loader.api.php';

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

  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
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

      const ofp = parseSimBriefResponse(json);
      const formFields = ofpToFormFields(ofp);
      const waypoints = stepsToWaypoints(ofp.steps);

      setOfp(ofp);
      setSteps(ofp.steps);
      setPlanningWaypoints(waypoints);
      setForm({
        ...formFields,
        // Preserve manually-set fields
        flightNumber: form.flightNumber || formFields.origin + '-' + formFields.destination,
        etd: form.etd || '',
      });
    } catch (err) {
      console.error('[SimBrief] Fetch failed:', err);
      throw err;
    } finally {
      setSimbriefLoading(false);
    }
  }, [form.flightNumber, form.etd, setSimbriefLoading, setOfp, setSteps, setPlanningWaypoints, setForm]);

  /**
   * Generate OFP via SimBrief API v1 popup flow.
   * Opens a popup to SimBrief, monitors it, and auto-fetches the result.
   */
  const generateOFP = useCallback(async () => {
    if (simbriefLoading) return;

    // Validate required fields
    if (!form.origin || !form.destination || !form.aircraftType) {
      throw new Error('Origin, destination, and aircraft type are required');
    }

    setSimbriefLoading(true);

    try {
      // Callback URL — same origin so Vite proxy / production both work
      const callbackUrl = window.location.origin + '/api/simbrief/callback';

      // Get API code from backend
      const { apicode, timestamp, outputpage } = await api.post<{
        apicode: string;
        timestamp: string;
        outputpage: string;
      }>('/api/simbrief/apicode', {
        orig: form.origin,
        dest: form.destination,
        type: form.aircraftType.toLowerCase(),
        outputpage: callbackUrl,
      });

      // Build loader URL
      const params = buildLoaderParams(form, fleet, apicode, timestamp, outputpage);
      const loaderUrl = `${SIMBRIEF_LOADER_URL}?${params.toString()}`;

      // Close any previous popup
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
      if (pollRef.current) clearInterval(pollRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      // Open SimBrief generation popup
      const popup = window.open(loaderUrl, 'SBworker', 'width=600,height=400');
      popupRef.current = popup;

      if (!popup) {
        setSimbriefLoading(false);
        throw new Error('Popup blocked — please allow popups for this site');
      }

      // Monitor popup closure
      pollRef.current = setInterval(async () => {
        if (!popup || popup.closed) {
          if (pollRef.current) clearInterval(pollRef.current);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          pollRef.current = null;
          timeoutRef.current = null;

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
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        setSimbriefLoading(false);
        console.warn('[SimBrief] Generation timed out');
      }, 300_000);

    } catch (err) {
      setSimbriefLoading(false);
      throw err;
    }
  }, [form, fleet, simbriefLoading, setSimbriefLoading, fetchOFP]);

  return { fetchOFP, generateOFP, simbriefLoading };
}
