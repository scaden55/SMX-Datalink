/**
 * Captures key flight events that TelemetryService doesn't remember:
 * - Landing rate (vertical speed at touchdown)
 * - Takeoff fuel weight
 * - Takeoff timestamp
 *
 * Called from WebSocket handler on phase transitions.
 * Singleton per server — one active flight at a time.
 */
export interface FlightEvents {
  landingRateFpm: number | null;
  takeoffFuelLbs: number | null;
  takeoffTime: string | null; // ISO UTC
}

export class FlightEventTracker {
  private landingRateFpm: number | null = null;
  private takeoffFuelLbs: number | null = null;
  private takeoffTime: string | null = null;

  /** Last vertical speed seen before touchdown (captured every tick while airborne) */
  private lastVerticalSpeed = 0;

  /**
   * Called every telemetry tick (~1s) to track the latest VS while airborne.
   * This ensures we capture the VS *just before* the simOnGround flag flips.
   */
  updateAirborneVs(verticalSpeed: number, simOnGround: boolean): void {
    if (!simOnGround) {
      this.lastVerticalSpeed = verticalSpeed;
    }
  }

  /**
   * Called from WebSocket handler when a phase transition occurs.
   */
  onPhaseChange(
    previous: string,
    current: string,
    fuelTotalLbs: number,
  ): void {
    // Takeoff: capture fuel weight and timestamp
    if (current === 'TAKEOFF' && previous !== 'TAKEOFF') {
      this.takeoffFuelLbs = Math.round(fuelTotalLbs);
      this.takeoffTime = new Date().toISOString();
    }

    // Landing: capture the last airborne VS as landing rate
    if (current === 'LANDING' && previous === 'APPROACH') {
      this.landingRateFpm = Math.round(this.lastVerticalSpeed);
    }
  }

  /** Returns captured events for PIREP submission. */
  getEvents(): FlightEvents {
    return {
      landingRateFpm: this.landingRateFpm,
      takeoffFuelLbs: this.takeoffFuelLbs,
      takeoffTime: this.takeoffTime,
    };
  }

  /** Reset for next flight. */
  reset(): void {
    this.landingRateFpm = null;
    this.takeoffFuelLbs = null;
    this.takeoffTime = null;
    this.lastVerticalSpeed = 0;
  }
}
