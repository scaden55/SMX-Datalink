import type {
  AircraftData,
  AircraftPosition,
  AutopilotState,
  TransponderState,
  ComRadio,
  NavRadio,
  EngineData,
  FuelData,
  FlightData,
  TelemetrySnapshot,
} from '@acars/shared';
import { FlightPhase } from '@acars/shared';
import type { ISimConnectManager } from '../simconnect/types.js';
import { FlightPhaseService } from './flight-phase.js';
import { generateMockSnapshot } from './mock-data.js';

/**
 * Aggregates all SimConnect data into a single telemetry state.
 * Caches the latest values for REST API access and Socket.io broadcast.
 */
export class TelemetryService {
  private position: AircraftPosition = {
    latitude: 0, longitude: 0, altitude: 0, heading: 0,
    airspeedIndicated: 0, airspeedTrue: 0, groundSpeed: 0,
    verticalSpeed: 0, pitch: 0, bank: 0,
  };

  private autopilot: AutopilotState = {
    master: false, altitudeHold: false, altitudeTarget: 0,
    headingHold: false, headingTarget: 0, speedHold: false, speedTarget: 0,
    verticalSpeedHold: false, verticalSpeedTarget: 0, approachHold: false, navHold: false,
  };

  private transponder: TransponderState = { code: 1200, ident: false };
  private com1: ComRadio = { activeFrequency: 118.0, standbyFrequency: 118.0 };
  private com2: ComRadio = { activeFrequency: 118.0, standbyFrequency: 118.0 };
  private nav1: NavRadio = { activeFrequency: 110.0, standbyFrequency: 110.0 };
  private nav2: NavRadio = { activeFrequency: 110.0, standbyFrequency: 110.0 };

  private aircraftInfo = { title: '', atcId: '', atcType: '', atcModel: '' };

  private engine: EngineData = { numberOfEngines: 0, engines: [] };
  private fuel: FuelData = {
    totalQuantityWeight: 0, totalQuantityGallons: 0,
    totalCapacityGallons: 0, fuelPercentage: 0, tanks: [],
  };

  private flightState: Omit<FlightData, 'phase'> = {
    simOnGround: true, gearPosition: 1, gearHandlePosition: true,
    flapPosition: 0, flapsHandleIndex: 0, spoilersPosition: 0,
    parkingBrake: true, lightBeacon: false, lightLanding: false,
    lightNav: false, lightStrobe: false, lightTaxi: false,
    weightOnWheels: true, simulationTime: 0, zuluTime: '00:00:00z',
    localTime: '00:00:00', simRate: 1, isPaused: false,
  };

  private phaseService: FlightPhaseService;

  constructor(private simConnect: ISimConnectManager) {
    this.phaseService = new FlightPhaseService();
    this.wireEvents();
  }

  private wireEvents(): void {
    this.simConnect.on('positionUpdate', (data: AircraftPosition) => {
      this.position = data;
    });

    this.simConnect.on('autopilotUpdate', (data: AutopilotState) => {
      this.autopilot = data;
    });

    this.simConnect.on('radioUpdate', (data: { transponder: TransponderState; com1: ComRadio; com2: ComRadio; nav1: NavRadio; nav2: NavRadio }) => {
      this.transponder = data.transponder;
      this.com1 = data.com1;
      this.com2 = data.com2;
      this.nav1 = data.nav1;
      this.nav2 = data.nav2;
    });

    this.simConnect.on('aircraftInfoUpdate', (data: typeof this.aircraftInfo) => {
      this.aircraftInfo = data;
    });

    this.simConnect.on('engineUpdate', (data: EngineData) => {
      this.engine = data;
    });

    this.simConnect.on('fuelUpdate', (data: FuelData) => {
      this.fuel = data;
    });

    this.simConnect.on('flightStateUpdate', (data: Omit<FlightData, 'phase'>) => {
      this.flightState = data;
    });

    this.simConnect.on('paused', (isPaused: boolean) => {
      this.flightState = { ...this.flightState, isPaused };
    });
  }

  private get useMock(): boolean {
    return !this.simConnect.connected;
  }

  getAircraftData(): AircraftData {
    if (this.useMock) return generateMockSnapshot().aircraft;
    return {
      position: this.position,
      autopilot: this.autopilot,
      transponder: this.transponder,
      com1: this.com1,
      com2: this.com2,
      nav1: this.nav1,
      nav2: this.nav2,
      ...this.aircraftInfo,
    };
  }

  getEngineData(): EngineData {
    if (this.useMock) return generateMockSnapshot().engine;
    return this.engine;
  }

  getFuelData(): FuelData {
    if (this.useMock) return generateMockSnapshot().fuel;
    return this.fuel;
  }

  getFlightData(): FlightData {
    if (this.useMock) return generateMockSnapshot().flight;
    const phase = this.phaseService.update({
      groundSpeed: this.position.groundSpeed,
      verticalSpeed: this.position.verticalSpeed,
      altitude: this.position.altitude,
      simOnGround: this.flightState.simOnGround,
      gearHandlePosition: this.flightState.gearHandlePosition,
      engineN1: this.engine.engines[0]?.n1 ?? 0,
      parkingBrake: this.flightState.parkingBrake,
    });

    return { ...this.flightState, phase };
  }

  getSnapshot(): TelemetrySnapshot {
    return {
      aircraft: this.getAircraftData(),
      engine: this.engine,
      fuel: this.fuel,
      flight: this.getFlightData(),
      timestamp: new Date().toISOString(),
    };
  }
}
