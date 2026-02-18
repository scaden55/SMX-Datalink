import { create } from 'zustand';
import type {
  FlightPlan,
  FlightPlanProgress,
  FlightPlanFormData,
  FlightPlanPhase,
  SimBriefOFP,
  SimBriefStep,
  Waypoint,
  WeatherCache,
  FleetAircraft,
  Airport,
  PlanningInfoTab,
} from '@acars/shared';

const emptyForm: FlightPlanFormData = {
  origin: '',
  destination: '',
  flightNumber: '',
  depDate: '',
  etd: '',
  aircraftId: null,
  aircraftType: '',
  route: '',
  cruiseFL: '',
  flightRules: 'IFR',
  costIndex: '',
  alternate1: '',
  alternate2: '',
  fuelPlanned: '',
  fuelExtra: '',
  fuelAlternate: '',
  fuelReserve: '',
  fuelTaxi: '',
  fuelContingency: '',
  fuelTotal: '',
  fuelBurn: '',
  estZfw: '',
  estTow: '',
  estLdw: '',
  payload: '',
  paxCount: '',
  cargoLbs: '',
  melRestrictions: '',
  dispatcherRemarks: '',
  autoRemarks: '',
  // SimBrief generation options
  units: 'LBS',
  contpct: 'auto',
  resvrule: '45',
  stepclimbs: true,
  etops: false,
  tlr: true,
  planformat: 'lido',
  inclNotams: true,
  firnot: false,
  maps: 'detail',
};

interface FlightPlanState {
  // Existing (backward compat with Dispatch)
  flightPlan: FlightPlan | null;
  progress: FlightPlanProgress | null;
  setFlightPlan: (plan: FlightPlan) => void;
  setProgress: (progress: FlightPlanProgress) => void;

  // Planning page state
  form: FlightPlanFormData;
  setFormField: <K extends keyof FlightPlanFormData>(key: K, value: FlightPlanFormData[K]) => void;
  setForm: (form: Partial<FlightPlanFormData>) => void;
  resetForm: () => void;

  ofp: SimBriefOFP | null;
  setOfp: (ofp: SimBriefOFP | null) => void;
  steps: SimBriefStep[];
  setSteps: (steps: SimBriefStep[]) => void;
  planningWaypoints: Waypoint[];
  setPlanningWaypoints: (wps: Waypoint[]) => void;

  phase: FlightPlanPhase;
  setPhase: (phase: FlightPlanPhase) => void;
  activeBidId: number | null;
  setActiveBidId: (id: number | null) => void;

  weatherCache: WeatherCache;
  setWeatherCache: (cache: WeatherCache) => void;
  updateWeather: (icao: string, data: WeatherCache[string]) => void;

  selectedAirportIcao: string | null;
  setSelectedAirportIcao: (icao: string | null) => void;
  planningTab: PlanningInfoTab;
  setPlanningTab: (tab: PlanningInfoTab) => void;

  simbriefLoading: boolean;
  setSimbriefLoading: (v: boolean) => void;
  weatherLoading: boolean;
  setWeatherLoading: (v: boolean) => void;
  savingFlightPlan: boolean;
  setSavingFlightPlan: (v: boolean) => void;

  fleet: FleetAircraft[];
  setFleet: (fleet: FleetAircraft[]) => void;
  airports: Airport[];
  setAirports: (airports: Airport[]) => void;
}

export const useFlightPlanStore = create<FlightPlanState>((set) => ({
  // Existing
  flightPlan: null,
  progress: null,
  setFlightPlan: (plan) => set({ flightPlan: plan }),
  setProgress: (progress) => set({ progress }),

  // Planning form
  form: { ...emptyForm },
  setFormField: (key, value) => set((s) => ({ form: { ...s.form, [key]: value } })),
  setForm: (partial) => set((s) => ({ form: { ...s.form, ...partial } })),
  resetForm: () => set({ form: { ...emptyForm }, ofp: null, steps: [], planningWaypoints: [], phase: 'planning' }),

  // OFP
  ofp: null,
  setOfp: (ofp) => set({ ofp }),
  steps: [],
  setSteps: (steps) => set({ steps }),
  planningWaypoints: [],
  setPlanningWaypoints: (wps) => set({ planningWaypoints: wps }),

  // Phase & bid
  phase: 'planning',
  setPhase: (phase) => set({ phase }),
  activeBidId: null,
  setActiveBidId: (id) => set({ activeBidId: id }),

  // Weather
  weatherCache: {},
  setWeatherCache: (cache) => set({ weatherCache: cache }),
  updateWeather: (icao, data) => set((s) => ({ weatherCache: { ...s.weatherCache, [icao]: data } })),

  // UI
  selectedAirportIcao: null,
  setSelectedAirportIcao: (icao) => set({ selectedAirportIcao: icao }),
  planningTab: 'weather',
  setPlanningTab: (tab) => set({ planningTab: tab }),

  // Loading flags
  simbriefLoading: false,
  setSimbriefLoading: (v) => set({ simbriefLoading: v }),
  weatherLoading: false,
  setWeatherLoading: (v) => set({ weatherLoading: v }),
  savingFlightPlan: false,
  setSavingFlightPlan: (v) => set({ savingFlightPlan: v }),

  // Reference data
  fleet: [],
  setFleet: (fleet) => set({ fleet }),
  airports: [],
  setAirports: (airports) => set({ airports }),
}));
