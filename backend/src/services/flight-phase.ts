import { FlightPhase, PhaseThresholds } from '@acars/shared';

interface PhaseInput {
  groundSpeed: number;
  verticalSpeed: number;
  altitude: number;
  simOnGround: boolean;
  gearHandlePosition: boolean;
  engineN1: number;
  parkingBrake: boolean;
}

/**
 * Pure finite state machine for flight phase detection.
 * Transitions are deterministic based on current state + telemetry inputs.
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

  /**
   * Evaluates telemetry inputs and returns the current flight phase.
   * Call once per second (aligned with telemetry update rate).
   */
  update(input: PhaseInput): FlightPhase {
    const next = this.evaluate(input);
    if (next !== this.currentPhase) {
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
    const { groundSpeed, verticalSpeed, altitude, simOnGround, gearHandlePosition, engineN1, parkingBrake } = input;
    const T = PhaseThresholds;

    switch (this.currentPhase) {
      case FlightPhase.PREFLIGHT:
        // Engines running + parking brake released + moving
        if (engineN1 > 15 && !parkingBrake && groundSpeed > T.GROUND_SPEED_TAXI) {
          return FlightPhase.TAXI_OUT;
        }
        return FlightPhase.PREFLIGHT;

      case FlightPhase.TAXI_OUT:
        if (!simOnGround) return FlightPhase.TAKEOFF;
        if (groundSpeed > T.GROUND_SPEED_TAKEOFF && engineN1 > 70) {
          return FlightPhase.TAKEOFF;
        }
        // Returned to gate
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
        if (altitude < T.APPROACH_ALTITUDE_AGL && gearHandlePosition) {
          return FlightPhase.APPROACH;
        }
        return FlightPhase.DESCENT;

      case FlightPhase.APPROACH:
        if (simOnGround) return FlightPhase.LANDING;
        if (verticalSpeed > T.CLIMB_VS && altitude > T.APPROACH_ALTITUDE_AGL) {
          return FlightPhase.CLIMB; // go-around
        }
        return FlightPhase.APPROACH;

      case FlightPhase.LANDING:
        if (groundSpeed < T.TAXI_IN_SPEED) return FlightPhase.TAXI_IN;
        if (!simOnGround) return FlightPhase.CLIMB; // bounce / go-around
        return FlightPhase.LANDING;

      case FlightPhase.TAXI_IN:
        if (parkingBrake && groundSpeed < T.GROUND_SPEED_TAXI) {
          return FlightPhase.PARKED;
        }
        return FlightPhase.TAXI_IN;

      case FlightPhase.PARKED:
        // Stay parked — flight complete
        return FlightPhase.PARKED;

      default:
        return FlightPhase.PREFLIGHT;
    }
  }
}
