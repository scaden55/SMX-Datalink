import type { EventEmitter } from 'events';
import type {
  AircraftPosition,
  AutopilotState,
  TransponderState,
  ComRadio,
  NavRadio,
  EngineData,
  FuelData,
  ConnectionStatus,
} from '@acars/shared';

export interface SimConnectEvents {
  connected: (status: ConnectionStatus) => void;
  disconnected: () => void;
  positionUpdate: (data: AircraftPosition) => void;
  engineUpdate: (data: EngineData) => void;
  fuelUpdate: (data: FuelData) => void;
  flightStateUpdate: (data: {
    simOnGround: boolean;
    gearPosition: number;
    gearHandlePosition: boolean;
    flapPosition: number;
    flapsHandleIndex: number;
    spoilersPosition: number;
    parkingBrake: boolean;
    lightBeacon: boolean;
    lightLanding: boolean;
    lightNav: boolean;
    lightStrobe: boolean;
    lightTaxi: boolean;
    weightOnWheels: boolean;
    simulationTime: number;
    zuluTime: string;
    localTime: string;
    simRate: number;
    isPaused: boolean;
  }) => void;
  autopilotUpdate: (data: AutopilotState) => void;
  radioUpdate: (data: { transponder: TransponderState; com1: ComRadio; com2: ComRadio; nav1: NavRadio; nav2: NavRadio }) => void;
  aircraftInfoUpdate: (data: { title: string; atcId: string; atcType: string; atcModel: string }) => void;
  paused: (isPaused: boolean) => void;
  crashed: () => void;
  simStart: () => void;
  simStop: () => void;
}

/**
 * Shared interface for SimConnect manager implementations.
 * Consumers depend on this instead of the concrete SimConnectManager class.
 */
export interface ISimConnectManager extends EventEmitter {
  readonly connected: boolean;
  getConnectionStatus(): ConnectionStatus;
  connect(): Promise<void>;
  disconnect(): void;
}
