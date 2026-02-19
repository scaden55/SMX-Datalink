// ─── SimBrief OFP Types ──────────────────────────────────────

export interface SimBriefStep {
  ident: string;
  lat: number;
  lon: number;
  altitudeFt: number;
  distanceFromOriginNm: number;
  fuelRemainLbs: number;
  wind: string;
  oat: number;
  /** SimBrief fix type (apt, vor, ndb, wpt, ltlg, toc, tod, etc.) */
  fixType?: string;
}

export interface SimBriefFuel {
  plannedLbs: number;
  extraLbs: number;
  alternateLbs: number;
  reserveLbs: number;
  taxiLbs: number;
  contingencyLbs: number;
  totalLbs: number;
  burnLbs: number;
}

export interface SimBriefWeights {
  estZfw: number;
  maxZfw: number;
  estTow: number;
  maxTow: number;
  estLdw: number;
  maxLdw: number;
  payload: number;
  paxCount: number;
  cargoLbs: number;
}

export interface SimBriefAlternate {
  icao: string;
  name: string;
  distanceNm: number;
  fuelLbs: number;
}

export interface SimBriefTimes {
  schedDep: string;
  schedArr: string;
  estEnroute: number; // minutes
  estBlock: number; // minutes
}

export interface SimBriefOFP {
  origin: string;
  destination: string;
  route: string;
  cruiseAltitude: number;
  costIndex: number;
  airline: string;
  flightNumber: string;
  aircraftType: string;
  fuel: SimBriefFuel;
  weights: SimBriefWeights;
  steps: SimBriefStep[];
  times: SimBriefTimes;
  alternates: SimBriefAlternate[];
  rawText: string;
}

// ─── Weather Types ───────────────────────────────────────────

export interface MetarData {
  icao: string;
  rawOb: string;
  temp: number | null;
  dewpoint: number | null;
  windDir: number | null;
  windSpeed: number | null;
  windGust: number | null;
  visibility: number | null;
  altimeter: number | null;
  flightCategory: string | null;
}

export interface TafData {
  icao: string;
  rawTaf: string;
  validTimeFrom: string;
  validTimeTo: string;
}

export interface NotamData {
  icao: string;
  text: string;
  effectiveStart: string;
  effectiveEnd: string;
  classification: string;
}

// ─── Flight Plan Form Types ──────────────────────────────────

export interface FlightPlanFormData {
  origin: string;
  destination: string;
  flightNumber: string;
  depDate: string;
  etd: string;
  aircraftId: number | null;
  aircraftType: string;
  route: string;
  cruiseFL: string;
  flightRules: 'IFR' | 'VFR';
  costIndex: string;
  alternate1: string;
  alternate2: string;
  fuelPlanned: string;
  fuelExtra: string;
  fuelAlternate: string;
  fuelReserve: string;
  fuelTaxi: string;
  fuelContingency: string;
  fuelTotal: string;
  fuelBurn: string;
  estZfw: string;
  estTow: string;
  estLdw: string;
  payload: string;
  paxCount: string;
  cargoLbs: string;
  melRestrictions: string;
  dispatcherRemarks: string;
  autoRemarks: string;
  // SimBrief generation options
  units: 'LBS' | 'KGS';
  contpct: string;
  resvrule: string;
  stepclimbs: boolean;
  etops: boolean;
  tlr: boolean;
  planformat: string;
  inclNotams: boolean;
  firnot: boolean;
  maps: 'detail' | 'simple' | 'none';
}

export type FlightPlanPhase = 'planning' | 'active' | 'completed';

export type PlanningInfoTab = 'weather' | 'notam' | 'airport-info' | 'ofp' | 'weight-balance' | 'flight-log';

// ─── Weather Cache ───────────────────────────────────────────

export interface WeatherCache {
  [icao: string]: {
    metar?: MetarData;
    taf?: TafData;
    notams?: NotamData[];
    fetchedAt: number;
  };
}
