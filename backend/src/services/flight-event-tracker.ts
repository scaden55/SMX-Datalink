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
  landingGForce: number | null;
  takeoffFuelLbs: number | null;
  takeoffTime: string | null; // ISO UTC
  // OOOI timestamps
  oooiOut: string | null;
  oooiOff: string | null;
  oooiOn: string | null;
  oooiIn: string | null;
}

export class FlightEventTracker {
  private landingRateFpm: number | null = null;
  private landingGForce: number | null = null;
  private takeoffFuelLbs: number | null = null;
  private takeoffTime: string | null = null;
  private oooiOut: string | null = null;
  private oooiOff: string | null = null;
  private oooiOn: string | null = null;
  private oooiIn: string | null = null;

  /** Last vertical speed seen before touchdown (captured every tick while airborne) */
  private lastVerticalSpeed = 0;
  /** Peak G-force seen near touchdown (tracked during final approach + landing) */
  private lastGForce = 1.0;

  /**
   * Called every telemetry tick (~1s) to track VS and G-force while airborne.
   * This ensures we capture the values *just before* the simOnGround flag flips.
   */
  updateAirborneVs(verticalSpeed: number, simOnGround: boolean, gForce?: number): void {
    if (!simOnGround) {
      this.lastVerticalSpeed = verticalSpeed;
    }
    // Track G-force every tick — we want the peak G at touchdown
    if (gForce != null) {
      this.lastGForce = gForce;
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
    // OUT: parking brake released, starting to taxi
    if (previous === 'PREFLIGHT' && current === 'TAXI_OUT') {
      this.oooiOut = new Date().toISOString();
    }

    // Takeoff: capture fuel weight and timestamp
    if (current === 'TAKEOFF' && previous !== 'TAKEOFF') {
      this.takeoffFuelLbs = Math.round(fuelTotalLbs);
      this.takeoffTime = new Date().toISOString();
    }

    // OFF: wheels off the ground (takeoff → climb)
    if (previous === 'TAKEOFF' && current === 'CLIMB') {
      this.oooiOff = new Date().toISOString();
    }

    // Landing: capture the last airborne VS and G-force at touchdown
    if (current === 'LANDING' && previous === 'APPROACH') {
      this.landingRateFpm = Math.round(this.lastVerticalSpeed);
      this.landingGForce = Math.round(this.lastGForce * 100) / 100; // 2 decimal places
    }

    // ON: touchdown (any phase → LANDING means wheels on ground)
    if (current === 'LANDING') {
      this.oooiOn = new Date().toISOString();
    }

    // IN: parked at destination
    if (current === 'PARKED' && (previous === 'TAXI_IN' || previous === 'LANDING')) {
      this.oooiIn = new Date().toISOString();
    }
  }

  /** Returns captured events for PIREP submission. */
  getEvents(): FlightEvents {
    return {
      landingRateFpm: this.landingRateFpm,
      landingGForce: this.landingGForce,
      takeoffFuelLbs: this.takeoffFuelLbs,
      takeoffTime: this.takeoffTime,
      oooiOut: this.oooiOut,
      oooiOff: this.oooiOff,
      oooiOn: this.oooiOn,
      oooiIn: this.oooiIn,
    };
  }

  /** Reset for next flight. */
  reset(): void {
    this.landingRateFpm = null;
    this.landingGForce = null;
    this.takeoffFuelLbs = null;
    this.takeoffTime = null;
    this.lastVerticalSpeed = 0;
    this.lastGForce = 1.0;
    this.oooiOut = null;
    this.oooiOff = null;
    this.oooiOn = null;
    this.oooiIn = null;
  }
}
