import type { AircraftData } from './aircraft.js';
import type { EngineData } from './engine.js';
import type { FuelData } from './fuel.js';
import type { FlightData, ConnectionStatus } from './flight.js';

export interface TelemetrySnapshot {
  aircraft: AircraftData;
  engine: EngineData;
  fuel: FuelData;
  flight: FlightData;
  timestamp: string; // ISO UTC
}

export interface ServerToClientEvents {
  'telemetry:update': (data: TelemetrySnapshot) => void;
  'connection:status': (status: ConnectionStatus) => void;
  'flight:phaseChange': (data: { previous: string; current: string; timestamp: string }) => void;
  'acars:message': (message: { type: string; content: string; timestamp: string }) => void;
}

export interface ClientToServerEvents {
  'telemetry:subscribe': () => void;
  'telemetry:unsubscribe': () => void;
}
