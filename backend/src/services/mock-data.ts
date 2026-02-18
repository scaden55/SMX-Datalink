import type { TelemetrySnapshot } from '@acars/shared';
import { FlightPhase } from '@acars/shared';

/** Simulated cruise position between KIAH and KDEN */
const MOCK_LAT = 35.42;
const MOCK_LON = -101.73;

let tick = 0;

/**
 * Generates a realistic telemetry snapshot for UI development.
 * Simulates a B737-800 in cruise between KIAH and KDEN.
 */
export function generateMockSnapshot(): TelemetrySnapshot {
  tick++;

  // Slow drift to simulate movement
  const lat = MOCK_LAT + Math.sin(tick * 0.002) * 0.01;
  const lon = MOCK_LON + tick * 0.0001;
  const altBase = 35000;
  const alt = altBase + Math.sin(tick * 0.05) * 20; // minor turbulence

  return {
    aircraft: {
      position: {
        latitude: lat,
        longitude: lon,
        altitude: alt,
        heading: 325 + Math.sin(tick * 0.01) * 0.5,
        airspeedIndicated: 268 + Math.sin(tick * 0.03) * 2,
        airspeedTrue: 452 + Math.sin(tick * 0.03) * 2,
        groundSpeed: 478 + Math.sin(tick * 0.02) * 3,
        verticalSpeed: Math.sin(tick * 0.04) * 80,
        pitch: 2.1 + Math.sin(tick * 0.05) * 0.2,
        bank: Math.sin(tick * 0.01) * 1.5,
      },
      autopilot: {
        master: true,
        altitudeHold: true,
        altitudeTarget: 35000,
        headingHold: false,
        headingTarget: 325,
        speedHold: true,
        speedTarget: 270,
        verticalSpeedHold: false,
        verticalSpeedTarget: 0,
        approachHold: false,
        navHold: true,
      },
      transponder: { code: 4523, ident: false },
      com1: { activeFrequency: 132.850, standbyFrequency: 121.500 },
      com2: { activeFrequency: 121.500, standbyFrequency: 118.300 },
      nav1: { activeFrequency: 114.700, standbyFrequency: 110.100 },
      nav2: { activeFrequency: 117.300, standbyFrequency: 115.500 },
      title: 'Boeing 737-800 United Airlines',
      atcId: 'N884UA',
      atcType: 'B738',
      atcModel: 'B737-800',
    },
    engine: {
      numberOfEngines: 2,
      engines: [
        {
          n1: 87.3 + Math.sin(tick * 0.04) * 0.5,
          n2: 94.1 + Math.sin(tick * 0.04) * 0.3,
          fuelFlow: 2640 + Math.sin(tick * 0.03) * 20,
          oilTemperature: 630,
          oilPressure: 48.2,
          egt: 1220 + Math.sin(tick * 0.02) * 5,
          itt: 890,
        },
        {
          n1: 87.5 + Math.cos(tick * 0.04) * 0.5,
          n2: 94.2 + Math.cos(tick * 0.04) * 0.3,
          fuelFlow: 2635 + Math.cos(tick * 0.03) * 20,
          oilTemperature: 628,
          oilPressure: 47.9,
          egt: 1218 + Math.cos(tick * 0.02) * 5,
          itt: 888,
        },
      ],
    },
    fuel: {
      totalQuantityWeight: 30564 - tick * 0.8,
      totalQuantityGallons: 4560 - tick * 0.12,
      totalCapacityGallons: 6875,
      fuelPercentage: ((4560 - tick * 0.12) / 6875) * 100,
      tanks: [
        { name: 'Left', quantityGallons: 1980 - tick * 0.05, capacityGallons: 2750 },
        { name: 'Right', quantityGallons: 1975 - tick * 0.05, capacityGallons: 2750 },
        { name: 'Center', quantityGallons: 605 - tick * 0.02, capacityGallons: 1375 },
      ],
    },
    flight: {
      phase: FlightPhase.CRUISE,
      simOnGround: false,
      gearPosition: 0,
      gearHandlePosition: false,
      flapPosition: 0,
      flapsHandleIndex: 0,
      spoilersPosition: 0,
      parkingBrake: false,
      lightBeacon: true,
      lightLanding: false,
      lightNav: true,
      lightStrobe: true,
      lightTaxi: false,
      weightOnWheels: false,
      simulationTime: 45000 + tick,
      zuluTime: formatZulu(45000 + tick),
      localTime: formatLocal(45000 + tick, -6),
      simRate: 1,
      isPaused: false,
    },
    timestamp: new Date().toISOString(),
  };
}

function formatZulu(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600) % 24;
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}z`;
}

function formatLocal(zuluSeconds: number, offsetHours: number): string {
  let local = zuluSeconds + offsetHours * 3600;
  if (local < 0) local += 86400;
  const h = Math.floor(local / 3600) % 24;
  const m = Math.floor((local % 3600) / 60);
  const s = Math.floor(local % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
