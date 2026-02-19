// Types
export type { AircraftPosition, AutopilotState, TransponderState, ComRadio, NavRadio, AircraftData } from './types/aircraft.js';
export type { EngineData, EngineParameters } from './types/engine.js';
export type { FuelData, FuelTank } from './types/fuel.js';
export type { FlightData, ConnectionStatus } from './types/flight.js';
export type { Waypoint, FlightPlan, FlightPlanProgress } from './types/flight-plan.js';
export type { OOOIEventType, AcarsMessage, DispatcherRemarks, SystemInfo } from './types/acars.js';
export type { TelemetrySnapshot, AcarsMessagePayload, ServerToClientEvents, ClientToServerEvents } from './types/websocket.js';
export type {
  UserRole,
  LoginRequest,
  RegisterRequest,
  RefreshRequest,
  UserProfile,
  LoginResponse,
  RefreshResponse,
  AuthPayload,
  CreateUserRequest,
} from './types/auth.js';
export type {
  SimBriefStep,
  SimBriefFuel,
  SimBriefWeights,
  SimBriefAlternate,
  SimBriefTimes,
  SimBriefOFP,
  MetarData,
  TafData,
  NotamData,
  FlightPlanFormData,
  FlightPlanPhase,
  PlanningInfoTab,
  WeatherCache,
} from './types/flight-planning.js';
export type {
  CharterType,
  FleetStatus,
  Airport,
  FleetAircraft,
  CreateFleetAircraftRequest,
  UpdateFleetAircraftRequest,
  FleetListResponse,
  ScheduledFlight,
  Bid,
  BidWithDetails,
  ScheduleListItem,
  ScheduleListResponse,
  BidResponse,
  MyBidsResponse,
  ActiveBidEntry,
  AllBidsResponse,
  DashboardStats,
  CreateCharterRequest,
  CreateCharterResponse,
} from './types/schedule.js';
export type {
  DispatchFlight,
  DispatchFlightsResponse,
  DispatchEditPayload,
} from './types/dispatch.js';
export type {
  FaaGroundStop,
  FaaGroundDelay,
  FaaArrivalDepartureDelay,
  FaaDeicing,
  FaaAirportConfig,
  FaaFreeForm,
  FaaAirportEvent,
} from './types/faa.js';

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
