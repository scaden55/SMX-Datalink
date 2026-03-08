import { useTelemetry } from './useTelemetry';
import { useDispatchEdit } from '../contexts/DispatchEditContext';
import { useActiveFlightsStore } from '../stores/activeFlightsStore';
import { useFlightPlanStore } from '../stores/flightPlanStore';
import type { AircraftData, FlightData } from '@acars/shared';

/**
 * Returns telemetry data appropriate for the dispatch page:
 * - Own flight → local SimConnect telemetry (full detail)
 * - Observed flight → lightweight heartbeat data from activeFlightsStore
 */
export function useDispatchTelemetry() {
  const local = useTelemetry();
  const { isOwnFlight } = useDispatchEdit();

  const activeBidId = useFlightPlanStore((s) => s.activeBidId);
  const heartbeats = useActiveFlightsStore((s) => s.flights);

  if (isOwnFlight) {
    return local;
  }

  // Find the heartbeat for the observed pilot's bid
  const heartbeat = heartbeats.find((f) => f.bidId === activeBidId);

  if (!heartbeat) {
    return {
      aircraft: null,
      engine: null,
      fuel: null,
      flight: null,
      connected: false,
      connectionStatus: local.connectionStatus,
      lastUpdate: 0,
      isStale: true,
    };
  }

  // Map heartbeat to a minimal AircraftData shape
  const aircraft: AircraftData = {
    position: {
      latitude: heartbeat.latitude,
      longitude: heartbeat.longitude,
      altitude: heartbeat.altitude,
      heading: heartbeat.heading,
      airspeedIndicated: heartbeat.groundSpeed,
      airspeedTrue: heartbeat.groundSpeed,
      groundSpeed: heartbeat.groundSpeed,
      verticalSpeed: 0,
      pitch: 0,
      bank: 0,
      altitudeAgl: 0,
      totalWeight: 0,
      gForce: 1,
    },
    autopilot: {
      master: false,
      altitudeHold: false,
      altitudeTarget: 0,
      headingHold: false,
      headingTarget: 0,
      speedHold: false,
      speedTarget: 0,
      verticalSpeedHold: false,
      verticalSpeedTarget: 0,
      approachHold: false,
      navHold: false,
    },
    transponder: { code: 0, ident: false },
    com1: { activeFrequency: 0, standbyFrequency: 0 },
    com2: { activeFrequency: 0, standbyFrequency: 0 },
    nav1: { activeFrequency: 0, standbyFrequency: 0 },
    nav2: { activeFrequency: 0, standbyFrequency: 0 },
    title: heartbeat.aircraftType,
    atcId: heartbeat.callsign,
    atcType: heartbeat.aircraftType,
    atcModel: '',
  };

  return {
    aircraft,
    engine: null,
    fuel: null,
    flight: {
      phase: heartbeat.phase,
      simOnGround: false,
      gearPosition: 0,
      gearHandlePosition: false,
      flapPosition: 0,
      flapsHandleIndex: 0,
      spoilersPosition: 0,
      parkingBrake: false,
      lightBeacon: false,
      lightLanding: false,
      lightNav: false,
      lightStrobe: false,
      lightTaxi: false,
      weightOnWheels: false,
      simulationTime: 0,
      zuluTime: '',
      localTime: '',
      simRate: 1,
      isPaused: false,
    } as FlightData,
    connected: true,
    connectionStatus: local.connectionStatus,
    lastUpdate: new Date(heartbeat.timestamp).getTime(),
    isStale: Date.now() - new Date(heartbeat.timestamp).getTime() > 60_000,
  };
}
