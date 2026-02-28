/** Per-type operating limits for exceedance detection */
export interface AircraftTypeLimit {
  vmoKts: number;       // max operating IAS (knots)
  mlwLbs: number;       // max landing weight (pounds)
  maxPitchDeg: number;  // tailstrike pitch limit (degrees nose up)
}

/**
 * Aircraft limits keyed by ICAO type code.
 * Used by ExceedanceDetector in Electron.
 * Extend as new types are added to the fleet.
 */
export const AircraftLimits: Record<string, AircraftTypeLimit> = {
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

/** Default limits when aircraft type is not in AircraftLimits */
export const DEFAULT_AIRCRAFT_LIMIT: AircraftTypeLimit = {
  vmoKts: 350,
  mlwLbs: 999999,  // effectively no limit
  maxPitchDeg: 12,
};

/** Universal exceedance thresholds (not aircraft-specific) */
export const ExceedanceThresholds = {
  HARD_LANDING_FPM: -600,
  HARD_LANDING_CRITICAL_FPM: -900,
  OVERSPEED_CRITICAL_MARGIN_KTS: 10,
  OVERWEIGHT_CRITICAL_MARGIN_PCT: 0.05,
  UNSTABLE_APPROACH_VS_FPM: -1000,
  UNSTABLE_APPROACH_ALT_AGL: 1000,
} as const;
