import { useEffect } from 'react';
import { useFlightPlanStore } from '../stores/flightPlanStore';
import type { FlightPlan } from '@acars/shared';

/** KIAH → KDEN mock flight plan matching the reference screenshots */
const MOCK_FLIGHT_PLAN: FlightPlan = {
  id: 'UAL79-05',
  origin: 'KIAH',
  destination: 'KDEN',
  alternates: ['KJFK', 'KRIC'],
  cruiseAltitude: 35000,
  route: 'BLZZR4 BLZZR DCT BAF Q480 AIR J110 PYLLS DCT MCJ J24 SLN DCT HVE J28 MLF DCT KDEN',
  totalDistance: 862,
  activeWaypointIndex: 5,
  waypoints: [
    { ident: 'KIAH', type: 'airport', latitude: 29.9844, longitude: -95.3414, altitude: 0, isActive: false, distanceFromPrevious: 0, ete: null, eta: null, passed: true },
    { ident: 'BLZZR', type: 'intersection', latitude: 30.28, longitude: -95.81, altitude: 8000, isActive: false, distanceFromPrevious: 32, ete: null, eta: null, passed: true },
    { ident: 'BAF', type: 'vor', latitude: 30.85, longitude: -96.52, altitude: 18000, isActive: false, distanceFromPrevious: 55, ete: null, eta: null, passed: true },
    { ident: 'AIR', type: 'vor', latitude: 31.42, longitude: -97.43, altitude: 28000, isActive: false, distanceFromPrevious: 62, ete: null, eta: null, passed: true },
    { ident: 'PYLLS', type: 'intersection', latitude: 32.15, longitude: -98.71, altitude: 35000, isActive: false, distanceFromPrevious: 85, ete: null, eta: null, passed: true },
    { ident: 'MCJ', type: 'vor', latitude: 33.24, longitude: -99.85, altitude: 35000, isActive: true, distanceFromPrevious: 88, ete: 720, eta: null, passed: false },
    { ident: 'SLN', type: 'vor', latitude: 34.62, longitude: -100.92, altitude: 35000, isActive: false, distanceFromPrevious: 102, ete: 1440, eta: null, passed: false },
    { ident: 'HVE', type: 'vor', latitude: 36.05, longitude: -102.15, altitude: 35000, isActive: false, distanceFromPrevious: 110, ete: 2280, eta: null, passed: false },
    { ident: 'MLF', type: 'vor', latitude: 37.28, longitude: -103.48, altitude: 35000, isActive: false, distanceFromPrevious: 105, ete: 3060, eta: null, passed: false },
    { ident: 'DOLXY', type: 'intersection', latitude: 38.45, longitude: -104.22, altitude: 25000, isActive: false, distanceFromPrevious: 88, ete: 3720, eta: null, passed: false },
    { ident: 'KDEN', type: 'airport', latitude: 39.8561, longitude: -104.6737, altitude: 5430, isActive: false, distanceFromPrevious: 95, ete: 4500, eta: null, passed: false },
  ],
};

/**
 * Seeds the flight plan store with mock KIAH-KDEN flight plan data for UI preview.
 */
export function useMockFlightPlan(): void {
  const setFlightPlan = useFlightPlanStore((s) => s.setFlightPlan);
  const setProgress = useFlightPlanStore((s) => s.setProgress);

  useEffect(() => {
    setFlightPlan(MOCK_FLIGHT_PLAN);
    setProgress({
      distanceFlown: 322,
      distanceRemaining: 540,
      eteDestination: 4068,
      etaDestination: new Date(Date.now() + 4068 * 1000).toISOString(),
      fuelAtDestination: 6731,
      topOfDescent: 105,
    });
  }, [setFlightPlan, setProgress]);
}
