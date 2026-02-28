import {
  AircraftLimits,
  DEFAULT_AIRCRAFT_LIMIT,
  ExceedanceThresholds,
} from '@acars/shared';
import type {
  ExceedanceEvent,
  ExceedanceSeverity,
  AircraftPosition,
} from '@acars/shared';

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
        message: `Hard landing: ${Math.round(this.lastAirborneVs)} fpm (limit: ${ExceedanceThresholds.HARD_LANDING_FPM} fpm)`,
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
        message: `Overweight landing: ${Math.round(this.lastAirborneTotalWeight).toLocaleString()} lbs (MLW: ${limits.mlwLbs.toLocaleString()} lbs)`,
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
