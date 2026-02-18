// Types
export type { AircraftPosition, AutopilotState, TransponderState, ComRadio, NavRadio, AircraftData } from './types/aircraft.js';
export type { EngineData, EngineParameters } from './types/engine.js';
export type { FuelData, FuelTank } from './types/fuel.js';
export type { FlightData, ConnectionStatus } from './types/flight.js';
export type { Waypoint, FlightPlan, FlightPlanProgress } from './types/flight-plan.js';
export type { OOOIEventType, AcarsMessage, DispatcherRemarks, SystemInfo } from './types/acars.js';
export type { TelemetrySnapshot, ServerToClientEvents, ClientToServerEvents } from './types/websocket.js';

// Constants
export { FlightPhase, PhaseThresholds } from './constants/flight-phases.js';
export {
  POSITION_VARS,
  ENGINE_VARS,
  FUEL_VARS,
  FLIGHT_VARS,
  AUTOPILOT_VARS,
  RADIO_VARS,
  AIRCRAFT_INFO_VARS,
} from './constants/simvars.js';
