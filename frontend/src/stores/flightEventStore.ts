/**
 * Client-side flight event tracker.
 *
 * Mirrors backend FlightEventTracker — subscribes to telemetry updates,
 * detects phase transitions, and captures key events (landing rate, fuel,
 * OOOI times). Data is sent alongside the PIREP so the backend has a
 * fallback when its own server-side tracker is empty (VPS / no SimConnect).
 */
import { create } from 'zustand';
import { useTelemetryStore } from './telemetryStore';
import type { TelemetrySnapshot } from '@acars/shared';

interface FlightEventState {
  // Captured events (mirrors backend FlightEvents)
  landingRateFpm: number | null;
  landingGForce: number | null;
  takeoffFuelLbs: number | null;
  takeoffTime: string | null;
  oooiOut: string | null;
  oooiOff: string | null;
  oooiOn: string | null;
  oooiIn: string | null;

  // Internal tracking
  _lastPhase: string;
  _lastVs: number;
  _lastG: number;

  processSnapshot: (snapshot: TelemetrySnapshot) => void;
  reset: () => void;
}

export const useFlightEventStore = create<FlightEventState>((set, get) => ({
  landingRateFpm: null,
  landingGForce: null,
  takeoffFuelLbs: null,
  takeoffTime: null,
  oooiOut: null,
  oooiOff: null,
  oooiOn: null,
  oooiIn: null,
  _lastPhase: '',
  _lastVs: 0,
  _lastG: 1.0,

  processSnapshot: (snapshot) => {
    const state = get();
    const prev = state._lastPhase;
    const curr = snapshot.flight.phase;
    const updates: Partial<FlightEventState> = {};

    // Track VS while airborne (for landing rate capture)
    if (!snapshot.flight.simOnGround) {
      updates._lastVs = snapshot.aircraft.position.verticalSpeed;
    }
    // Track G-force every tick (for touchdown G capture)
    if (snapshot.aircraft.position.gForce != null) {
      updates._lastG = snapshot.aircraft.position.gForce;
    }

    // Detect phase transitions
    if (curr && curr !== prev) {
      updates._lastPhase = curr;
      const now = new Date().toISOString();

      // OUT: parking brake released → taxi
      if (prev === 'PREFLIGHT' && curr === 'TAXI_OUT') {
        updates.oooiOut = now;
      }

      // Takeoff: capture fuel weight and timestamp
      if (curr === 'TAKEOFF' && prev !== 'TAKEOFF') {
        updates.takeoffFuelLbs = Math.round(snapshot.fuel.totalQuantityWeight);
        updates.takeoffTime = now;
      }

      // OFF: wheels off the ground
      if (prev === 'TAKEOFF' && curr === 'CLIMB') {
        updates.oooiOff = now;
      }

      // Landing: capture the last airborne VS and G-force at touchdown
      if (curr === 'LANDING' && prev === 'APPROACH') {
        updates.landingRateFpm = Math.round(state._lastVs);
        updates.landingGForce = Math.round(state._lastG * 100) / 100;
      }

      // ON: touchdown
      if (curr === 'LANDING') {
        updates.oooiOn = now;
      }

      // IN: parked at destination
      if (curr === 'PARKED' && (prev === 'TAXI_IN' || prev === 'LANDING')) {
        updates.oooiIn = now;
      }
    }

    if (Object.keys(updates).length > 0) {
      set(updates);
    }
  },

  reset: () => set({
    landingRateFpm: null,
    landingGForce: null,
    takeoffFuelLbs: null,
    takeoffTime: null,
    oooiOut: null,
    oooiOff: null,
    oooiOn: null,
    oooiIn: null,
    _lastPhase: '',
    _lastVs: 0,
    _lastG: 1.0,
  }),
}));

// ── Auto-subscribe to telemetry updates ──────────────────────────
// Fires on every telemetry store change; processSnapshot is cheap
// (only acts on phase transitions) so this is fine at tick rate.
let _lastRef: TelemetrySnapshot | null = null;
useTelemetryStore.subscribe((state) => {
  if (state.snapshot && state.snapshot !== _lastRef) {
    _lastRef = state.snapshot;
    useFlightEventStore.getState().processSnapshot(state.snapshot);
  }
});
