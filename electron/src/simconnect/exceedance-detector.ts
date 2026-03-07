import type {
  ExceedanceEvent,
  ExceedanceSeverity,
  AircraftPosition,
} from '@acars/shared';

/**
 * Constants are inlined here to avoid importing @acars/shared values
 * at runtime (shared compiles to ESM, Electron main process is CJS).
 *
 * Keep in sync with shared/src/constants/aircraft-limits.ts
 */
interface AircraftTypeLimit {
  vmoKts: number;
  mlwLbs: number;
  maxPitchDeg: number;
}

const AircraftLimits: Record<string, AircraftTypeLimit> = {
  B738: { vmoKts: 340, mlwLbs: 144500, maxPitchDeg: 11 },
  B739: { vmoKts: 340, mlwLbs: 146300, maxPitchDeg: 11 },
  B744: { vmoKts: 365, mlwLbs: 630000, maxPitchDeg: 11.5 },
  B748: { vmoKts: 365, mlwLbs: 654000, maxPitchDeg: 11.5 },
  B752: { vmoKts: 350, mlwLbs: 210000, maxPitchDeg: 12 },
  B763: { vmoKts: 360, mlwLbs: 350000, maxPitchDeg: 11 },
  B77W: { vmoKts: 360, mlwLbs: 554000, maxPitchDeg: 11.5 },
  B788: { vmoKts: 360, mlwLbs: 380000, maxPitchDeg: 11 },
  A320: { vmoKts: 350, mlwLbs: 145505, maxPitchDeg: 12 },
  A332: { vmoKts: 350, mlwLbs: 396830, maxPitchDeg: 12 },
  A333: { vmoKts: 350, mlwLbs: 412264, maxPitchDeg: 12 },
  MD11: { vmoKts: 375, mlwLbs: 491500, maxPitchDeg: 10 },
  DC10: { vmoKts: 375, mlwLbs: 403000, maxPitchDeg: 10 },
  C208: { vmoKts: 175, mlwLbs: 8000, maxPitchDeg: 15 },
  C172: { vmoKts: 163, mlwLbs: 2550, maxPitchDeg: 15 },
};

const DEFAULT_AIRCRAFT_LIMIT: AircraftTypeLimit = {
  vmoKts: 350,
  mlwLbs: 999999,
  maxPitchDeg: 12,
};

const ExceedanceThresholds = {
  HARD_LANDING_FPM: -600,
  HARD_LANDING_CRITICAL_FPM: -900,
  OVERSPEED_CRITICAL_MARGIN_KTS: 10,
  OVERWEIGHT_CRITICAL_MARGIN_PCT: 0.05,
  UNSTABLE_APPROACH_VS_FPM: -1000,
  UNSTABLE_APPROACH_ALT_AGL: 1000,
} as const;

/**
 * Detects flight exceedances from real-time SimConnect telemetry.
 * Runs in the Electron main process at 200ms polling frequency.
 *
 * Detection rules:
 * - Hard landing: VS < -600 fpm at touchdown
 * - Overspeed: IAS > aircraft Vmo while airborne
 * - Overweight landing: TOTAL WEIGHT > aircraft MLW at touchdown
 * - Unstable approach: VS < -1000 fpm below 1000' AGL
 * - Tailstrike: pitch > aircraft maxPitchDeg at touchdown
 *
 * Each exceedance emits at most once per flight phase (dedup via emitted set).
 */
export class ExceedanceDetector {
  private aircraftType = '';
  private emitted = new Set<string>();
  private lastAirborneVs = 0;
  private lastAirbornePitch = 0;
  private lastAirborneTotalWeight = 0;
  private lastAirborneGForce = 1;

  /** G-force and VS at the moment of touchdown (exposed for UI display) */
  public touchdownGForce = 0;
  public touchdownVs = 0;

  /** Set the aircraft ICAO type for limit lookups. Call when aircraft info arrives. */
  setAircraftType(icaoType: string): void {
    this.aircraftType = icaoType.toUpperCase();
  }

  /**
   * Continuous tick check — called every 200ms with current telemetry.
   * Returns detected exceedances (usually 0 or 1 per tick).
   */
  check(
    position: AircraftPosition,
    phase: string,
    simOnGround: boolean,
  ): ExceedanceEvent[] {
    const events: ExceedanceEvent[] = [];
    const limits = AircraftLimits[this.aircraftType] ?? DEFAULT_AIRCRAFT_LIMIT;

    // Track last airborne values for landing-triggered checks
    if (!simOnGround) {
      this.lastAirborneVs = position.verticalSpeed;
      this.lastAirbornePitch = position.pitch;
      this.lastAirborneTotalWeight = position.totalWeight;
      this.lastAirborneGForce = position.gForce;
    }

    // Overspeed: continuous check while airborne
    if (!simOnGround && position.airspeedIndicated > limits.vmoKts) {
      const key = `OVERSPEED:${phase}`;
      if (!this.emitted.has(key)) {
        this.emitted.add(key);
        const margin = position.airspeedIndicated - limits.vmoKts;
        const severity: ExceedanceSeverity =
          margin >= ExceedanceThresholds.OVERSPEED_CRITICAL_MARGIN_KTS
            ? 'critical'
            : 'warning';
        events.push({
          type: 'OVERSPEED',
          severity,
          value: Math.round(position.airspeedIndicated),
          threshold: limits.vmoKts,
          unit: 'kts',
          phase,
          message: `Overspeed: ${Math.round(position.airspeedIndicated)} kts IAS (Vmo: ${limits.vmoKts} kts)`,
          detectedAt: new Date().toISOString(),
        });
      }
    }

    // Unstable approach: VS < -1000 fpm below 1000' AGL during APPROACH
    if (phase === 'APPROACH' && !simOnGround) {
      const agl = position.altitudeAgl;
      if (
        agl < ExceedanceThresholds.UNSTABLE_APPROACH_ALT_AGL &&
        position.verticalSpeed < ExceedanceThresholds.UNSTABLE_APPROACH_VS_FPM
      ) {
        const key = `UNSTABLE_APPROACH:${phase}`;
        if (!this.emitted.has(key)) {
          this.emitted.add(key);
          events.push({
            type: 'UNSTABLE_APPROACH',
            severity: 'warning',
            value: Math.round(position.verticalSpeed),
            threshold: ExceedanceThresholds.UNSTABLE_APPROACH_VS_FPM,
            unit: 'fpm',
            phase,
            message: `Unstable approach: ${Math.round(position.verticalSpeed)} fpm descent at ${Math.round(agl)}' AGL (limit: ${ExceedanceThresholds.UNSTABLE_APPROACH_VS_FPM} fpm below ${ExceedanceThresholds.UNSTABLE_APPROACH_ALT_AGL}' AGL)`,
            detectedAt: new Date().toISOString(),
          });
        }
      }
    }

    return events;
  }

  /**
   * Phase transition check — called when flight phase changes.
   * Landing-triggered exceedances (hard landing, overweight, tailstrike) fire here.
   */
  onPhaseChange(
    previous: string,
    current: string,
  ): ExceedanceEvent[] {
    const events: ExceedanceEvent[] = [];

    // Only check on touchdown (transition to LANDING)
    if (current !== 'LANDING') return events;

    // Snapshot touchdown values for UI display
    this.touchdownVs = Math.round(this.lastAirborneVs);
    this.touchdownGForce = Math.round(this.lastAirborneGForce * 100) / 100;

    const limits = AircraftLimits[this.aircraftType] ?? DEFAULT_AIRCRAFT_LIMIT;
    const now = new Date().toISOString();

    // Hard landing
    if (this.lastAirborneVs < ExceedanceThresholds.HARD_LANDING_FPM) {
      const severity: ExceedanceSeverity =
        this.lastAirborneVs < ExceedanceThresholds.HARD_LANDING_CRITICAL_FPM
          ? 'critical'
          : 'warning';
      events.push({
        type: 'HARD_LANDING',
        severity,
        value: Math.round(this.lastAirborneVs),
        threshold: ExceedanceThresholds.HARD_LANDING_FPM,
        unit: 'fpm',
        phase: current,
        message: `Hard landing: ${Math.round(this.lastAirborneVs)} fpm / ${this.touchdownGForce}G (limit: ${ExceedanceThresholds.HARD_LANDING_FPM} fpm)`,
        detectedAt: now,
      });
    }

    // Overweight landing
    if (this.lastAirborneTotalWeight > limits.mlwLbs) {
      const overPct =
        (this.lastAirborneTotalWeight - limits.mlwLbs) / limits.mlwLbs;
      const severity: ExceedanceSeverity =
        overPct >= ExceedanceThresholds.OVERWEIGHT_CRITICAL_MARGIN_PCT
          ? 'critical'
          : 'warning';
      events.push({
        type: 'OVERWEIGHT_LANDING',
        severity,
        value: Math.round(this.lastAirborneTotalWeight),
        threshold: limits.mlwLbs,
        unit: 'lbs',
        phase: current,
        message: `Overweight landing: ${Math.round(this.lastAirborneTotalWeight).toLocaleString('en-US')} lbs (MLW: ${limits.mlwLbs.toLocaleString('en-US')} lbs)`,
        detectedAt: now,
      });
    }

    // Tailstrike
    if (this.lastAirbornePitch > limits.maxPitchDeg) {
      events.push({
        type: 'TAILSTRIKE',
        severity: 'critical',
        value: Math.round(this.lastAirbornePitch * 10) / 10,
        threshold: limits.maxPitchDeg,
        unit: 'deg',
        phase: current,
        message: `Tailstrike risk: ${Math.round(this.lastAirbornePitch * 10) / 10}° pitch (limit: ${limits.maxPitchDeg}°)`,
        detectedAt: now,
      });
    }

    return events;
  }

  /** Reset for next flight. */
  reset(): void {
    this.emitted.clear();
    this.lastAirborneVs = 0;
    this.lastAirbornePitch = 0;
    this.lastAirborneTotalWeight = 0;
    this.aircraftType = '';
  }
}
