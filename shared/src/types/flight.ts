import type { FlightPhase } from '../constants/flight-phases.js';

export interface FlightData {
  phase: FlightPhase;
  simOnGround: boolean;
  gearPosition: number; // 0 = retracted, 1 = extended
  gearHandlePosition: boolean;
  flapPosition: number; // degrees
  flapsHandleIndex: number;
  spoilersPosition: number; // percent
  parkingBrake: boolean;
  lightBeacon: boolean;
  lightLanding: boolean;
  lightNav: boolean;
  lightStrobe: boolean;
  lightTaxi: boolean;
  weightOnWheels: boolean;
  simulationTime: number; // seconds since midnight
  zuluTime: string; // HH:MM:SSz
  localTime: string; // HH:MM:SS
  simRate: number;
  isPaused: boolean;
}

export interface ConnectionStatus {
  connected: boolean;
  simulator: 'msfs2020' | 'msfs2024' | 'unknown';
  simConnectVersion: string;
  applicationName: string;
  lastUpdate: string; // ISO timestamp
  lastError?: string;
}

/** Lightweight heartbeat sent by pilot's Electron app every 30s */
export interface ActiveFlightHeartbeat {
  userId: number;
  bidId?: number; // active_bids.id — populated by backend, used by admin dispatch board
  callsign: string;
  flightNumber?: string;
  aircraftType: string;
  latitude: number;
  longitude: number;
  altitude: number;
  heading: number;
  groundSpeed: number;
  phase: string;
  timestamp: string;
  // Route endpoints — populated by backend from bid → schedule → airports
  depIcao?: string;
  arrIcao?: string;
  depLat?: number;
  depLon?: number;
  arrLat?: number;
  arrLon?: number;
}
