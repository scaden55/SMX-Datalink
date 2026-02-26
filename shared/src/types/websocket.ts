import type { AircraftData } from './aircraft.js';
import type { EngineData } from './engine.js';
import type { FuelData } from './fuel.js';
import type { FlightData, ConnectionStatus, ActiveFlightHeartbeat } from './flight.js';
import type { DispatchEditPayload } from './dispatch.js';
import type { VatsimUpdateEvent, VatsimFlightStatus } from './vatsim.js';
import type { TrackPoint } from './track.js';

export interface TelemetrySnapshot {
  aircraft: AircraftData;
  engine: EngineData;
  fuel: FuelData;
  flight: FlightData;
  timestamp: string; // ISO UTC
}

/** Message payload broadcast over WebSocket for ACARS messaging */
export interface AcarsMessagePayload {
  id: string;
  bidId: number;
  senderId: number;
  senderName: string;
  type: string;
  content: string;
  source: string;
  timestamp: string;
}

export interface ServerToClientEvents {
  'telemetry:update': (data: TelemetrySnapshot) => void;
  'connection:status': (status: ConnectionStatus) => void;
  'flight:phaseChange': (data: { previous: string; current: string; timestamp: string }) => void;
  'acars:message': (message: AcarsMessagePayload) => void;
  'dispatch:updated': (data: { bidId: number; fields: DispatchEditPayload }) => void;
  'vatsim:update': (data: VatsimUpdateEvent) => void;
  'dispatch:vatsimStatus': (data: VatsimFlightStatus) => void;
  'track:point': (data: { bidId: number; point: TrackPoint }) => void;
  'flight:completed': (data: { bidId: number; logbookId: number }) => void;
  'dispatch:released': (data: { bidId: number; changedFields: string[] }) => void;
  'relay:start': () => void;
  'relay:stop': () => void;
  'flights:active': (flights: ActiveFlightHeartbeat[]) => void;
}

export interface ClientToServerEvents {
  'telemetry:subscribe': () => void;
  'telemetry:unsubscribe': () => void;
  'dispatch:subscribe': (bidId: number) => void;
  'dispatch:unsubscribe': (bidId: number) => void;
  'acars:sendMessage': (data: { bidId: number; content: string }) => void;
  'vatsim:subscribe': () => void;
  'vatsim:unsubscribe': () => void;
  'flight:heartbeat': (data: ActiveFlightHeartbeat) => void;
  'flight:telemetry': (data: TelemetrySnapshot) => void;
  'flight:ended': () => void;
  'livemap:subscribe': () => void;
  'livemap:unsubscribe': () => void;
}
