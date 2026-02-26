import type { RawBuffer } from 'node-simconnect';
import type {
  AircraftPosition,
  AutopilotState,
  TransponderState,
  ComRadio,
  NavRadio,
  EngineData,
  EngineParameters,
  FuelData,
  FuelTank,
} from '@acars/shared';

/**
 * Reads position data from a SimConnect buffer.
 * Must match POSITION_VARS order exactly.
 */
export function readPosition(data: RawBuffer): AircraftPosition {
  return {
    latitude: data.readFloat64(),
    longitude: data.readFloat64(),
    altitude: data.readFloat64(),
    heading: data.readFloat64(),
    airspeedIndicated: data.readFloat64(),
    airspeedTrue: data.readFloat64(),
    groundSpeed: data.readFloat64(),
    verticalSpeed: data.readFloat64(),
    pitch: data.readFloat64(),
    bank: data.readFloat64(),
  };
}

/**
 * Reads engine data. Must match ENGINE_VARS order exactly.
 */
export function readEngine(data: RawBuffer): EngineData {
  const numberOfEngines = data.readInt32();

  const readSingleEngine = (): EngineParameters => ({
    n1: data.readFloat64(),
    n2: data.readFloat64(),
    fuelFlow: data.readFloat64(),
    oilTemperature: data.readFloat64(),
    oilPressure: data.readFloat64(),
    egt: data.readFloat64(),
    itt: data.readFloat64(),
  });

  const eng1 = readSingleEngine();
  const eng2 = readSingleEngine();

  const engines = numberOfEngines >= 2 ? [eng1, eng2] : [eng1];

  return { numberOfEngines, engines };
}

/** Safe FLOAT64 read — returns 0 if buffer is exhausted */
function safeFloat64(data: RawBuffer): number {
  try { return data.readFloat64(); } catch { return 0; }
}

/**
 * Reads fuel data. Must match FUEL_VARS order exactly.
 */
export function readFuel(data: RawBuffer): FuelData {
  const totalQuantityWeight = safeFloat64(data);
  const totalQuantityGallons = safeFloat64(data);
  const totalCapacityGallons = safeFloat64(data);

  const leftQty = safeFloat64(data);
  const rightQty = safeFloat64(data);
  const centerQty = safeFloat64(data);
  const leftCap = safeFloat64(data);
  const rightCap = safeFloat64(data);
  const centerCap = safeFloat64(data);

  const tanks: FuelTank[] = [
    { name: 'Left', quantityGallons: leftQty, capacityGallons: leftCap },
    { name: 'Right', quantityGallons: rightQty, capacityGallons: rightCap },
  ];

  if (centerCap > 0) {
    tanks.push({ name: 'Center', quantityGallons: centerQty, capacityGallons: centerCap });
  }

  const fuelPercentage = totalCapacityGallons > 0
    ? (totalQuantityGallons / totalCapacityGallons) * 100
    : 0;

  return { totalQuantityWeight, totalQuantityGallons, totalCapacityGallons, fuelPercentage, tanks };
}

/**
 * Reads flight state data. Must match FLIGHT_VARS order exactly.
 */
export function readFlightState(data: RawBuffer) {
  const simOnGround = data.readInt32() === 1;
  const gearPosition = data.readFloat64();
  const gearHandlePosition = data.readInt32() === 1;
  const flapPosition = data.readFloat64();
  const flapsHandleIndex = data.readInt32();
  const spoilersPosition = data.readFloat64();
  const parkingBrake = data.readInt32() === 1;
  const lightBeacon = data.readInt32() === 1;
  const lightLanding = data.readInt32() === 1;
  const lightNav = data.readInt32() === 1;
  const lightStrobe = data.readInt32() === 1;
  const lightTaxi = data.readInt32() === 1;
  const simulationTime = data.readFloat64();
  const zuluSeconds = data.readFloat64();
  const localSeconds = data.readFloat64();
  const simRate = data.readFloat64();

  const formatTime = (totalSeconds: number): string => {
    const h = Math.floor(totalSeconds / 3600) % 24;
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return {
    simOnGround,
    gearPosition,
    gearHandlePosition,
    flapPosition,
    flapsHandleIndex,
    spoilersPosition,
    parkingBrake,
    lightBeacon,
    lightLanding,
    lightNav,
    lightStrobe,
    lightTaxi,
    weightOnWheels: simOnGround,
    simulationTime,
    zuluTime: formatTime(zuluSeconds) + 'z',
    localTime: formatTime(localSeconds),
    simRate,
    isPaused: false, // updated via system events
  };
}

/**
 * Reads autopilot state. Must match AUTOPILOT_VARS order exactly.
 */
export function readAutopilot(data: RawBuffer): AutopilotState {
  return {
    master: data.readInt32() === 1,
    altitudeHold: data.readInt32() === 1,
    altitudeTarget: data.readFloat64(),
    headingHold: data.readInt32() === 1,
    headingTarget: data.readFloat64(),
    speedHold: data.readInt32() === 1,
    speedTarget: data.readFloat64(),
    verticalSpeedHold: data.readInt32() === 1,
    verticalSpeedTarget: data.readFloat64(),
    approachHold: data.readInt32() === 1,
    navHold: data.readInt32() === 1,
  };
}

/**
 * Reads radio/transponder data. Must match RADIO_VARS order exactly.
 */
export function readRadio(data: RawBuffer): {
  transponder: TransponderState;
  com1: ComRadio;
  com2: ComRadio;
  nav1: NavRadio;
  nav2: NavRadio;
} {
  return {
    transponder: {
      code: data.readInt32(),
      ident: data.readInt32() === 1,
    },
    com1: {
      activeFrequency: data.readFloat64(),
      standbyFrequency: data.readFloat64(),
    },
    com2: {
      activeFrequency: data.readFloat64(),
      standbyFrequency: data.readFloat64(),
    },
    nav1: {
      activeFrequency: data.readFloat64(),
      standbyFrequency: data.readFloat64(),
    },
    nav2: {
      activeFrequency: data.readFloat64(),
      standbyFrequency: data.readFloat64(),
    },
  };
}

/**
 * Reads aircraft info strings. Must match AIRCRAFT_INFO_VARS order exactly.
 */
export function readAircraftInfo(data: RawBuffer): {
  title: string;
  atcId: string;
  atcType: string;
  atcModel: string;
} {
  return {
    title: data.readString256(),
    atcId: data.readString32(),
    atcType: data.readString32(),
    atcModel: data.readString32(),
  };
}
