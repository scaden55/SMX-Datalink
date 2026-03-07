/**
 * Flight phase detection FSM for the Electron main process.
 * Constants are inlined here to avoid importing @acars/shared values
 * at runtime (shared compiles to ESM, Electron main process is CJS).
 *
 * Keep in sync with:
 * - shared/src/constants/flight-phases.ts (FlightPhase, PhaseThresholds)
 * - backend/src/services/flight-phase.ts  (identical FSM logic)
 */

const FlightPhase = {
  PREFLIGHT: 'PREFLIGHT',
  TAXI_OUT: 'TAXI_OUT',
  TAKEOFF: 'TAKEOFF',
  CLIMB: 'CLIMB',
  CRUISE: 'CRUISE',
  DESCENT: 'DESCENT',
  APPROACH: 'APPROACH',
  LANDING: 'LANDING',
  TAXI_IN: 'TAXI_IN',
  PARKED: 'PARKED',
} as const;

type FlightPhase = (typeof FlightPhase)[keyof typeof FlightPhase];

const PhaseThresholds = {
  GROUND_SPEED_TAXI: 5,
  GROUND_SPEED_TAKEOFF: 40,
  LIFTOFF_VERTICAL_SPEED: 200,
  CLIMB_VS: 300,
  CRUISE_VS_BAND: 200,
  DESCENT_VS: -300,
  APPROACH_ALTITUDE_AGL: 3000,
  LANDING_GEAR_DOWN_ALT: 5000,
  TOUCHDOWN_VS: -50,
  TAXI_IN_SPEED: 30,
} as const;

interface PhaseInput {
  groundSpeed: number;
  verticalSpeed: number;
  altitude: number;       // MSL — used for cruise/climb thresholds
  altitudeAgl: number;    // AGL — used for approach/landing thresholds
  simOnGround: boolean;
  gearHandlePosition: boolean;
  engineN1: number;
  parkingBrake: boolean;
}

/**
 * Pure finite state machine for flight phase detection.
 * Call update() once per telemetry cycle (~1 Hz).
 */
export class FlightPhaseService {
  private currentPhase: FlightPhase = FlightPhase.PREFLIGHT;
  private previousPhase: FlightPhase = FlightPhase.PREFLIGHT;

  get phase(): FlightPhase {
    return this.currentPhase;
  }

  get previous(): FlightPhase {
    return this.previousPhase;
  }

  update(input: PhaseInput): FlightPhase {
    const next = this.evaluate(input);
    if (next !== this.currentPhase) {
      console.log(`[FlightPhase] ${this.currentPhase} → ${next}`);
      this.previousPhase = this.currentPhase;
      this.currentPhase = next;
    }
    return this.currentPhase;
  }

  reset(): void {
    this.currentPhase = FlightPhase.PREFLIGHT;
    this.previousPhase = FlightPhase.PREFLIGHT;
  }

  private evaluate(input: PhaseInput): FlightPhase {
    const { groundSpeed, verticalSpeed, altitude, altitudeAgl, simOnGround, gearHandlePosition, engineN1, parkingBrake } = input;
    const T = PhaseThresholds;

    // ── Global safety nets (override any stuck state) ────────
    // On the ground + slow = definitely not flying
    if (simOnGround && groundSpeed < T.TAXI_IN_SPEED) {
      if (this.currentPhase === FlightPhase.DESCENT
        || this.currentPhase === FlightPhase.APPROACH
        || this.currentPhase === FlightPhase.CRUISE
        || this.currentPhase === FlightPhase.CLIMB) {
        return FlightPhase.TAXI_IN;
      }
    }
    // On the ground + fast = just landed (rollout)
    if (simOnGround && groundSpeed >= T.TAXI_IN_SPEED) {
      if (this.currentPhase === FlightPhase.DESCENT
        || this.currentPhase === FlightPhase.CRUISE
        || this.currentPhase === FlightPhase.CLIMB) {
        return FlightPhase.LANDING;
      }
    }

    switch (this.currentPhase) {
      case FlightPhase.PREFLIGHT:
        if (engineN1 > 15 && !parkingBrake && groundSpeed > T.GROUND_SPEED_TAXI) {
          return FlightPhase.TAXI_OUT;
        }
        return FlightPhase.PREFLIGHT;

      case FlightPhase.TAXI_OUT:
        if (!simOnGround) return FlightPhase.TAKEOFF;
        if (groundSpeed > T.GROUND_SPEED_TAKEOFF && engineN1 > 70) {
          return FlightPhase.TAKEOFF;
        }
        if (parkingBrake && groundSpeed < T.GROUND_SPEED_TAXI) {
          return FlightPhase.PREFLIGHT;
        }
        return FlightPhase.TAXI_OUT;

      case FlightPhase.TAKEOFF:
        if (!simOnGround && verticalSpeed > T.CLIMB_VS) {
          return FlightPhase.CLIMB;
        }
        return FlightPhase.TAKEOFF;

      case FlightPhase.CLIMB:
        if (verticalSpeed < T.DESCENT_VS) return FlightPhase.DESCENT;
        if (Math.abs(verticalSpeed) < T.CRUISE_VS_BAND && altitude > 10000) {
          return FlightPhase.CRUISE;
        }
        return FlightPhase.CLIMB;

      case FlightPhase.CRUISE:
        if (verticalSpeed > T.CLIMB_VS) return FlightPhase.CLIMB;
        if (verticalSpeed < T.DESCENT_VS) return FlightPhase.DESCENT;
        return FlightPhase.CRUISE;

      case FlightPhase.DESCENT:
        if (verticalSpeed > T.CLIMB_VS) return FlightPhase.CLIMB;
        if (Math.abs(verticalSpeed) < T.CRUISE_VS_BAND && altitude > 15000) {
          return FlightPhase.CRUISE;
        }
        if (altitudeAgl < T.APPROACH_ALTITUDE_AGL && gearHandlePosition) {
          return FlightPhase.APPROACH;
        }
        return FlightPhase.DESCENT;

      case FlightPhase.APPROACH:
        if (simOnGround) return FlightPhase.LANDING;
        if (verticalSpeed > T.CLIMB_VS && altitudeAgl > T.APPROACH_ALTITUDE_AGL) {
          return FlightPhase.CLIMB;
        }
        return FlightPhase.APPROACH;

      case FlightPhase.LANDING:
        if (groundSpeed < T.TAXI_IN_SPEED) return FlightPhase.TAXI_IN;
        if (!simOnGround) return FlightPhase.CLIMB;
        return FlightPhase.LANDING;

      case FlightPhase.TAXI_IN:
        if (parkingBrake && groundSpeed < T.GROUND_SPEED_TAXI) {
          return FlightPhase.PARKED;
        }
        return FlightPhase.TAXI_IN;

      case FlightPhase.PARKED:
        return FlightPhase.PARKED;

      default:
        return FlightPhase.PREFLIGHT;
    }
  }
}
