import type { BidWithDetails } from './schedule.js';
import type { FlightPlanFormData, FlightPlanPhase, SimBriefOFP } from './flight-planning.js';

export interface DispatchFlight {
  bid: BidWithDetails;
  flightPlanData: FlightPlanFormData | null;
  ofpJson: SimBriefOFP | null;
  phase: FlightPlanPhase;
  pilot: { callsign: string; name: string };
  vatsimConnected: boolean;
  vatsimCallsign: string | null;
  /** Field names changed during the last dispatcher release (null = no pending changes) */
  releasedFields: string[] | null;
}

export interface DispatchFlightsResponse {
  flights: DispatchFlight[];
}

export interface DispatchEditPayload {
  route?: string;
  cruiseFL?: string;
  alternate1?: string;
  alternate2?: string;
  fuelPlanned?: string;
  fuelExtra?: string;
  fuelAlternate?: string;
  fuelReserve?: string;
  fuelTaxi?: string;
  fuelContingency?: string;
  fuelTotal?: string;
  fuelBurn?: string;
  melRestrictions?: string;
  dispatcherRemarks?: string;
  autoRemarks?: string;
  // New dispatcher fields
  depTime?: string;
  depRunway?: string;
  arrRunway?: string;
  costIndex?: number;
  paxCount?: number;
}

/** Payload sent when a dispatcher releases flight plan edits to the pilot */
export interface DispatchReleasePayload {
  changedFields: string[];
}
