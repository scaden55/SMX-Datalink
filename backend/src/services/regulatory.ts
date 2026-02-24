import { getDb } from '../db/index.js';
import type {
  FlightClassification,
  ClassificationResult,
  EtopsAssessment,
  RvsmAssessment,
  OpSpec,
  OpSpecCategory,
  OpSpecEnforcement,
  AircraftStatusCheck,
  ComplianceItem,
  RegulatoryAssessment,
} from '@acars/shared';
import type { FleetStatusQueryRow, OpSpecRow } from '../types/db-rows.js';

// ─────────────────────────────────────────────────────────────
// ICAO prefix helpers — used for 14 CFR 110.2 classification
// ─────────────────────────────────────────────────────────────

/** 48 contiguous US states: K-prefix 4-letter codes */
function isConusIcao(icao: string): boolean {
  return icao.length === 4 && icao.startsWith('K');
}

/** Alaska: PA prefix (PANC, PAFA, PABE, etc.) */
function isAlaskaIcao(icao: string): boolean {
  return icao.length === 4 && icao.startsWith('PA');
}

/** Hawaii: PH prefix (PHNL, PHKO, PHOG, etc.) */
function isHawaiiIcao(icao: string): boolean {
  return icao.length === 4 && icao.startsWith('PH');
}

/** US territories: PG (Guam), PW (Wake), PM (Midway), TJ (Puerto Rico), TI (USVI) */
const US_TERRITORY_PREFIXES = ['PG', 'PW', 'PM', 'TJ', 'TI'];
function isUsTerritoryIcao(icao: string): boolean {
  return US_TERRITORY_PREFIXES.some((p) => icao.startsWith(p));
}

/** Any US ICAO (CONUS + Alaska + Hawaii + territories) */
function isUsIcao(icao: string): boolean {
  return isConusIcao(icao) || isAlaskaIcao(icao) || isHawaiiIcao(icao) || isUsTerritoryIcao(icao);
}

// ─────────────────────────────────────────────────────────────
// Haversine distance — great-circle in nautical miles
// ─────────────────────────────────────────────────────────────

function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065; // Earth radius in NM
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ─────────────────────────────────────────────────────────────
// DB row → OpSpec DTO mapper
// ─────────────────────────────────────────────────────────────

function toOpSpec(row: OpSpecRow): OpSpec {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    category: row.category as OpSpecCategory,
    enforcement: row.enforcement as OpSpecEnforcement,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─────────────────────────────────────────────────────────────
// RegulatoryService
// ─────────────────────────────────────────────────────────────

export class RegulatoryService {
  /**
   * Classify a flight per 14 CFR 110.2 definitions.
   *
   * - Charter / all-cargo-negotiated → 121_supplemental
   * - Both endpoints within 48 CONUS (K-prefix) → 121_domestic
   * - Anything touching Alaska, Hawaii, territories, or foreign → 121_flag
   */
  classifyFlight(
    origin: string,
    dest: string,
    charterType?: string,
  ): ClassificationResult {
    const o = origin.toUpperCase().trim();
    const d = dest.toUpperCase().trim();
    const reasoning: string[] = [];
    const appliedRules: string[] = [];

    // Supplemental: charter/negotiated operations
    if (charterType && charterType !== 'none') {
      reasoning.push(`Charter type "${charterType}" — negotiated departure/arrival`);
      appliedRules.push('14 CFR 110.2 supplemental');
      return {
        classification: '121_supplemental',
        reasoning,
        appliedRules,
        etopsRequired: false,
        rvsmRequired: false,
      };
    }

    // Domestic: both within 48 contiguous states
    if (isConusIcao(o) && isConusIcao(d)) {
      reasoning.push(`Both ${o} and ${d} are within 48 contiguous states (K-prefix)`);
      appliedRules.push('14 CFR 110.2 domestic');
      return {
        classification: '121_domestic',
        reasoning,
        appliedRules,
        etopsRequired: false,
        rvsmRequired: false,
      };
    }

    // Flag: everything else involving US carrier
    const flagReasons: string[] = [];
    if (isAlaskaIcao(o) || isAlaskaIcao(d)) flagReasons.push('route touches Alaska (PA*)');
    if (isHawaiiIcao(o) || isHawaiiIcao(d)) flagReasons.push('route touches Hawaii (PH*)');
    if (isUsTerritoryIcao(o) || isUsTerritoryIcao(d)) flagReasons.push('route touches US territory');
    if (!isUsIcao(o)) flagReasons.push(`${o} is a foreign point`);
    if (!isUsIcao(d)) flagReasons.push(`${d} is a foreign point`);

    if (flagReasons.length === 0) {
      // Fallback: non-K-prefix US points that aren't AK/HI/territory — still flag
      flagReasons.push('route extends beyond 48 contiguous states');
    }

    reasoning.push(...flagReasons);
    appliedRules.push('14 CFR 110.2 flag');

    // Flag routes over water may need ETOPS
    const overwater = isHawaiiIcao(o) || isHawaiiIcao(d) || !isUsIcao(o) || !isUsIcao(d);

    return {
      classification: '121_flag',
      reasoning,
      appliedRules,
      etopsRequired: overwater,
      rvsmRequired: false,
    };
  }

  /**
   * Assess ETOPS applicability per 14 CFR 121.7.
   * Twin-engine aircraft > 60 min from adequate airport.
   * Simplified heuristic: >750nm great-circle AND cross-water indicators.
   */
  assessEtops(
    origin: string,
    dest: string,
    originLat?: number,
    originLon?: number,
    destLat?: number,
    destLon?: number,
  ): EtopsAssessment {
    const o = origin.toUpperCase().trim();
    const d = dest.toUpperCase().trim();

    // Cross-water indicators
    const crossWater =
      isHawaiiIcao(o) || isHawaiiIcao(d) ||
      isAlaskaIcao(o) || isAlaskaIcao(d) ||
      (!isUsIcao(o) && isUsIcao(d)) ||
      (isUsIcao(o) && !isUsIcao(d)) ||
      (!isUsIcao(o) && !isUsIcao(d));

    let distanceNm: number | null = null;
    if (originLat != null && originLon != null && destLat != null && destLon != null) {
      distanceNm = Math.round(haversineNm(originLat, originLon, destLat, destLon));
    }

    const longRange = distanceNm != null ? distanceNm > 750 : crossWater;

    if (crossWater && longRange) {
      return {
        applicable: true,
        reason: `Overwater route (${distanceNm ? distanceNm + ' nm' : 'estimated >750 nm'}) — ETOPS authorization required per 14 CFR 121.7`,
        greatCircleNm: distanceNm,
        estimatedOverwaterNm: distanceNm ? Math.round(distanceNm * 0.6) : null,
      };
    }

    return {
      applicable: false,
      reason: distanceNm
        ? `Domestic/overland route (${distanceNm} nm) — ETOPS not required`
        : 'Domestic/overland route — ETOPS not required',
      greatCircleNm: distanceNm,
      estimatedOverwaterNm: null,
    };
  }

  /**
   * Assess RVSM applicability per 14 CFR 91.706 + Appendix G.
   * Applicable when planned cruise is FL290 (29000 ft) through FL410 (41000 ft).
   */
  assessRvsm(cruiseAltFt: number): RvsmAssessment {
    const inRvsmBand = cruiseAltFt >= 29000 && cruiseAltFt <= 41000;

    return {
      applicable: inRvsmBand,
      reason: inRvsmBand
        ? `FL${Math.round(cruiseAltFt / 100)} is within RVSM airspace (FL290–FL410) — requires aircraft & operator authorization per 14 CFR 91.706`
        : `FL${Math.round(cruiseAltFt / 100)} is outside RVSM airspace (FL290–FL410)`,
      plannedAltitudeFt: cruiseAltFt,
    };
  }

  /**
   * Check aircraft airworthiness per 14 CFR 21.197 logic.
   * This is the ONLY hard block — non-active aircraft require a Special Flight Permit.
   */
  checkAircraftStatus(aircraftId?: number): AircraftStatusCheck {
    if (!aircraftId) {
      return {
        aircraftId: null,
        registration: null,
        status: null,
        canDispatch: true,
        blockReason: null,
      };
    }

    const db = getDb();
    const row = db.prepare('SELECT id, registration, status FROM fleet WHERE id = ?').get(aircraftId) as FleetStatusQueryRow | undefined;

    if (!row) {
      return {
        aircraftId,
        registration: null,
        status: null,
        canDispatch: false,
        blockReason: 'Aircraft not found in fleet registry',
      };
    }

    const canDispatch = row.status === 'active';
    return {
      aircraftId: row.id,
      registration: row.registration,
      status: row.status,
      canDispatch,
      blockReason: canDispatch
        ? null
        : `Aircraft ${row.registration} status is "${row.status}" — requires Special Flight Permit per 14 CFR 21.197`,
    };
  }

  /**
   * Get active OpSpecs applicable to the flight context.
   */
  getApplicableOpSpecs(
    classification: FlightClassification,
    etopsApplicable: boolean,
    rvsmApplicable: boolean,
  ): OpSpec[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM opspecs WHERE is_active = 1 ORDER BY code').all() as OpSpecRow[];
    const all = rows.map(toOpSpec);

    return all.filter((op) => {
      // Always include: A001 (areas), A003 (types), B031 (MEL), E115 (emergency), F100 (airworthiness)
      if (['A001', 'A003', 'B031', 'E115', 'F100'].includes(op.code)) return true;
      // A002 (flag authority) only for flag operations
      if (op.code === 'A002') return classification === '121_flag';
      // A008 (ETOPS) only when applicable
      if (op.code === 'A008') return etopsApplicable;
      // D085 (RVSM) only when in RVSM band
      if (op.code === 'D085') return rvsmApplicable;
      // D088 (data link) and D095 (MNPS) for flag operations
      if (['D088', 'D095'].includes(op.code)) return classification === '121_flag';
      // Everything else: include
      return true;
    });
  }

  /**
   * Run compliance checks — returns pass/fail items.
   */
  runComplianceChecks(params: {
    aircraftStatus: AircraftStatusCheck;
    rvsmApplicable: boolean;
    etopsApplicable: boolean;
  }): ComplianceItem[] {
    const items: ComplianceItem[] = [];

    // Aircraft airworthiness (hard block)
    items.push({
      code: 'F100',
      title: 'Aircraft Airworthiness',
      detail: params.aircraftStatus.canDispatch
        ? params.aircraftStatus.registration
          ? `${params.aircraftStatus.registration} is airworthy`
          : 'No aircraft specified — airworthiness not checked'
        : params.aircraftStatus.blockReason ?? 'Aircraft is not airworthy',
      severity: params.aircraftStatus.canDispatch ? 'info' : 'block',
      passed: params.aircraftStatus.canDispatch,
    });

    // RVSM authorization
    if (params.rvsmApplicable) {
      items.push({
        code: 'D085',
        title: 'RVSM Authorization',
        detail: 'Flight planned in RVSM airspace — operator & aircraft RVSM authorization assumed per OpSpec D085',
        severity: 'warning',
        passed: true,
      });
    }

    // ETOPS authorization
    if (params.etopsApplicable) {
      items.push({
        code: 'A008',
        title: 'ETOPS Authorization',
        detail: 'Overwater/extended range route — ETOPS authorization assumed per OpSpec A008',
        severity: 'warning',
        passed: true,
      });
    }

    return items;
  }

  /**
   * Build rule chips for the ScenarioBar display.
   */
  private buildRuleChips(
    classification: FlightClassification,
    etops: EtopsAssessment,
    rvsm: RvsmAssessment,
    opspecs: OpSpec[],
  ): string[] {
    const chips: string[] = [];

    // Classification chip
    switch (classification) {
      case '121_domestic':
        chips.push('R-121 DOM');
        break;
      case '121_flag':
        chips.push('R-121 FLAG');
        break;
      case '121_supplemental':
        chips.push('R-121 SUPP');
        break;
    }

    // ETOPS chip
    if (etops.applicable) {
      chips.push('ETOPS');
    }

    // RVSM chip
    if (rvsm.applicable) {
      chips.push('D-RVSM');
    }

    // Add select OpSpec chips
    const chipCodes = new Set(['A008', 'D085', 'D088', 'D095']);
    for (const op of opspecs) {
      if (chipCodes.has(op.code) && !chips.includes(op.code)) {
        // Already represented by ETOPS/RVSM chips above
        continue;
      }
    }

    // Flight rules chip (always IFR for Part 121)
    chips.push('RTE-FAA');

    // Add a few relevant OpSpec codes as info chips
    const infoCodes = opspecs
      .filter((op) => !['A001', 'A003', 'E115', 'F100', 'A008', 'D085'].includes(op.code))
      .slice(0, 2)
      .map((op) => op.code);
    chips.push(...infoCodes);

    return chips;
  }

  /**
   * Generate a plain-text dispatch release per 14 CFR 121.687 format.
   */
  private generateDispatchRelease(params: {
    origin: string;
    dest: string;
    classification: ClassificationResult;
    etops: EtopsAssessment;
    rvsm: RvsmAssessment;
    aircraftStatus: AircraftStatusCheck;
    cruiseAlt: number;
  }): string {
    const now = new Date().toISOString();
    const lines: string[] = [
      '═══════════════════════════════════════════════',
      '  SMA VIRTUAL — DISPATCH RELEASE (14 CFR 121.687)',
      '═══════════════════════════════════════════════',
      '',
      `Date/Time:       ${now}`,
      `Aircraft:        ${params.aircraftStatus.registration ?? 'N/A'}`,
      `Origin:          ${params.origin}`,
      `Destination:     ${params.dest}`,
      `Cruise Altitude: FL${Math.round(params.cruiseAlt / 100)}`,
      `Flight Rules:    IFR`,
      '',
      `Classification:  ${params.classification.classification.replace('_', ' ').toUpperCase()}`,
      `  Rules: ${params.classification.appliedRules.join(', ')}`,
    ];

    if (params.etops.applicable) {
      lines.push('');
      lines.push(`ETOPS:           REQUIRED`);
      lines.push(`  ${params.etops.reason}`);
      if (params.etops.greatCircleNm) {
        lines.push(`  Great-circle:  ${params.etops.greatCircleNm} nm`);
      }
    }

    if (params.rvsm.applicable) {
      lines.push('');
      lines.push(`RVSM:            APPLICABLE`);
      lines.push(`  ${params.rvsm.reason}`);
    }

    lines.push('');
    lines.push('───────────────────────────────────────────────');
    lines.push('PIC and Dispatcher both certify this flight can');
    lines.push('be conducted safely per 14 CFR 121.663.');
    lines.push('───────────────────────────────────────────────');

    return lines.join('\n');
  }

  /**
   * Full assessment — orchestrator method.
   * Calls all sub-assessments and builds the aggregate response.
   */
  assess(params: {
    origin: string;
    dest: string;
    cruiseAlt?: number;
    aircraftId?: number;
    charterType?: string;
    includeRelease?: boolean;
    originLat?: number;
    originLon?: number;
    destLat?: number;
    destLon?: number;
  }): RegulatoryAssessment {
    const cruiseAlt = params.cruiseAlt ?? 0;

    // 1. Classify flight
    const classification = this.classifyFlight(params.origin, params.dest, params.charterType);

    // 2. Assess ETOPS
    const etops = this.assessEtops(
      params.origin, params.dest,
      params.originLat, params.originLon,
      params.destLat, params.destLon,
    );

    // Merge ETOPS flag into classification
    classification.etopsRequired = etops.applicable;

    // 3. Assess RVSM
    const rvsm = this.assessRvsm(cruiseAlt);
    classification.rvsmRequired = rvsm.applicable;

    // 4. Check aircraft status
    const aircraftStatus = this.checkAircraftStatus(params.aircraftId);

    // 5. Get applicable OpSpecs
    const applicableOpSpecs = this.getApplicableOpSpecs(
      classification.classification,
      etops.applicable,
      rvsm.applicable,
    );

    // 6. Run compliance checks
    const compliance = this.runComplianceChecks({
      aircraftStatus,
      rvsmApplicable: rvsm.applicable,
      etopsApplicable: etops.applicable,
    });

    // 7. Build rule chips
    const ruleChips = this.buildRuleChips(
      classification.classification,
      etops,
      rvsm,
      applicableOpSpecs,
    );

    // 8. Optional dispatch release
    let dispatchRelease: string | null = null;
    if (params.includeRelease) {
      dispatchRelease = this.generateDispatchRelease({
        origin: params.origin,
        dest: params.dest,
        classification,
        etops,
        rvsm,
        aircraftStatus,
        cruiseAlt,
      });
    }

    return {
      classification,
      etops,
      rvsm,
      aircraftStatus,
      applicableOpSpecs,
      compliance,
      ruleChips,
      dispatchRelease,
    };
  }

  // ─────────────────────────────────────────────────
  // Admin CRUD
  // ─────────────────────────────────────────────────

  findAllOpSpecs(): OpSpec[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM opspecs ORDER BY code').all() as OpSpecRow[];
    return rows.map(toOpSpec);
  }

  updateOpSpec(id: number, data: { isActive?: boolean; enforcement?: string; description?: string }): OpSpec | null {
    const db = getDb();

    const existing = db.prepare('SELECT * FROM opspecs WHERE id = ?').get(id) as OpSpecRow | undefined;
    if (!existing) return null;

    const sets: string[] = [];
    const values: unknown[] = [];

    if (data.isActive !== undefined) {
      sets.push('is_active = ?');
      values.push(data.isActive ? 1 : 0);
    }
    if (data.enforcement !== undefined) {
      sets.push('enforcement = ?');
      values.push(data.enforcement);
    }
    if (data.description !== undefined) {
      sets.push('description = ?');
      values.push(data.description);
    }

    if (sets.length === 0) return toOpSpec(existing);

    values.push(id);
    db.prepare(`UPDATE opspecs SET ${sets.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM opspecs WHERE id = ?').get(id) as OpSpecRow;
    return toOpSpec(updated);
  }
}
