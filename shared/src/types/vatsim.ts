// ── VATSIM Data Feed Types ──────────────────────────────────────
// Based on https://data.vatsim.net/v3/vatsim-data.json

/** VATSIM facility type codes (0-6) */
export type VatsimFacilityType = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Human-readable names for facility types */
export const VATSIM_FACILITY_NAMES: Record<VatsimFacilityType, string> = {
  0: 'Observer',
  1: 'Flight Service Station',
  2: 'Delivery',
  3: 'Ground',
  4: 'Tower',
  5: 'Approach/Departure',
  6: 'Center',
} as const;

/** VATSIM pilot flight plan as returned by the data feed */
export interface VatsimFlightPlan {
  flight_rules: 'I' | 'V' | 'Y' | 'Z';
  aircraft: string;
  aircraft_faa: string;
  aircraft_short: string;
  departure: string;
  arrival: string;
  alternate: string;
  cruise_tas: string;
  altitude: string;
  deptime: string;
  enroute_time: string;
  fuel_time: string;
  remarks: string;
  route: string;
  revision_id: number;
  assigned_transponder: string;
}

/** A pilot connected to the VATSIM network */
export interface VatsimPilot {
  cid: number;
  name: string;
  callsign: string;
  server: string;
  pilot_rating: number;
  military_rating: number;
  latitude: number;
  longitude: number;
  altitude: number;
  groundspeed: number;
  transponder: string;
  heading: number;
  qnh_i_hg: number;
  qnh_mb: number;
  flight_plan: VatsimFlightPlan | null;
  logon_time: string;
  last_updated: string;
}

/** A controller connected to the VATSIM network */
export interface VatsimController {
  cid: number;
  name: string;
  callsign: string;
  frequency: string;
  facility: VatsimFacilityType;
  rating: number;
  server: string;
  visual_range: number;
  text_atis: string[] | null;
  last_updated: string;
  logon_time: string;
}

/** ATIS station on the VATSIM network */
export interface VatsimAtis {
  cid: number;
  name: string;
  callsign: string;
  frequency: string;
  facility: VatsimFacilityType;
  rating: number;
  server: string;
  visual_range: number;
  atis_code: string | null;
  text_atis: string[] | null;
  last_updated: string;
  logon_time: string;
}

/** General metadata from the VATSIM data feed */
export interface VatsimGeneral {
  version: number;
  reload: number;
  update: string;
  update_timestamp: string;
  connected_clients: number;
  unique_users: number;
}

// ── Transceiver Data ────────────────────────────────────────────

/** Single transceiver position from the transceivers feed */
export interface VatsimTransceiverPosition {
  id: number;
  frequency: number;
  latDeg: number;
  lonDeg: number;
  heightMslM: number;
  heightAglM: number;
}

/** Entry from the VATSIM transceivers-data.json feed */
export interface VatsimTransceiverEntry {
  callsign: string;
  transceivers: VatsimTransceiverPosition[];
}

// ── Enriched Types ──────────────────────────────────────────────

/** Parsed controller callsign: EDGG_E_CTR -> prefix=EDGG, fullPrefix=EDGG_E, suffix=CTR */
export interface ParsedCallsign {
  prefix: string;
  fullPrefix: string;
  suffix: string;
}

/** Controller enriched with transceiver position + resolved boundary */
export interface VatsimControllerWithPosition extends VatsimController {
  latitude: number | null;
  longitude: number | null;
  boundaryId: string | null;
  parsed: ParsedCallsign;
}

// ── Snapshot & Events ───────────────────────────────────────────

/** Full cached VATSIM data snapshot (served via REST + initial WS load) */
export interface VatsimDataSnapshot {
  general: VatsimGeneral;
  pilots: VatsimPilot[];
  controllers: VatsimControllerWithPosition[];
  atis: VatsimAtis[];
  updatedAt: string;
}

/** WebSocket broadcast payload (same shape, slightly trimmed) */
export interface VatsimUpdateEvent {
  pilots: VatsimPilot[];
  controllers: VatsimControllerWithPosition[];
  atis: VatsimAtis[];
  updatedAt: string;
}

/** VATSIM connection status for a dispatch flight */
export interface VatsimFlightStatus {
  bidId: number;
  vatsimConnected: boolean;
  vatsimCallsign: string | null;
  vatsimCid: number | null;
}
