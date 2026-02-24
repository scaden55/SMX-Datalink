// ─── Cargo Validation Engine ────────────────────────────────
// 6-rule safety validator for cargo load distributions.

import type { ULD } from '@acars/shared';
import type { AircraftConfig } from './aircraft-configs.js';

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  infos: string[];
}

/**
 * Validate a cargo load against safety rules.
 *
 * Rules:
 *  1. DG in Bulk — prevent hazmat in bulk compartment
 *  2. AVI/DG Separation — live animals away from dangerous goods
 *  3. Cold Chain — temperature-controlled cargo placement
 *  4. Heavy Cargo — flag ULDs exceeding 5000kg gross
 *  5. CG Position — validate within aircraft CG envelope
 *  6. Section Overweight — prevent exceeding compartment limits
 */
export function validateCargoLoad(
  ulds: ULD[],
  config: AircraftConfig,
  cgPosition: number,
  sectionWeights: Record<string, { weight: number; maxWeight: number }>,
): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const infos: string[] = [];

  // Rule 1: DG in Bulk Hold — prevent hazmat in bulk compartment
  const dgInBulk = ulds.filter(u => u.hazmat && u.section === 'bulk');
  if (dgInBulk.length > 0) {
    errors.push(
      `Dangerous goods cannot be loaded in bulk cargo hold (${dgInBulk.length} ULD(s) affected)`,
    );
  }

  // Rule 2: AVI/DG Separation — live animals away from dangerous goods
  const hasLiveAnimals = ulds.some(u => u.category_code === 'live_animals');
  const hasDG = ulds.some(u => u.hazmat);
  if (hasLiveAnimals && hasDG) {
    const aviSections = new Set(
      ulds.filter(u => u.category_code === 'live_animals').map(u => u.section),
    );
    const dgSections = new Set(
      ulds.filter(u => u.hazmat).map(u => u.section),
    );
    const overlap = [...aviSections].filter(s => dgSections.has(s));
    if (overlap.length > 0) {
      errors.push(
        `Live animals and dangerous goods must not share the same section: ${overlap.join(', ')}`,
      );
    } else {
      warnings.push(
        'Live animals and dangerous goods on same flight — ensure adequate separation',
      );
    }
  }

  // Rule 3: Cold Chain Proximity — temp-controlled cargo placement
  const tempControlled = ulds.filter(u => u.temp_controlled);
  if (tempControlled.length > 0) {
    infos.push(
      `${tempControlled.length} temperature-controlled ULD(s) — verify thermal containers are available`,
    );
    // Warn if temp cargo in bulk (no cooling)
    const tempInBulk = tempControlled.filter(u => u.section === 'bulk');
    if (tempInBulk.length > 0) {
      warnings.push('Temperature-controlled cargo in bulk hold — no active cooling available');
    }
  }

  // Rule 4: Heavy Cargo Floor Loading — flag ULDs exceeding 5000kg
  const heavyUlds = ulds.filter(u => u.gross_weight > 5000);
  if (heavyUlds.length > 0) {
    warnings.push(
      `${heavyUlds.length} ULD(s) exceed 5000kg — verify floor loading limits: ${heavyUlds.map(u => `${u.uld_id} (${u.position})`).join(', ')}`,
    );
  }

  // Rule 5: CG Position — validate within aircraft CG envelope
  if (cgPosition < config.cgRange.forward) {
    errors.push(
      `CG position ${cgPosition}% MAC is forward of limit (${config.cgRange.forward}% MAC)`,
    );
  } else if (cgPosition > config.cgRange.aft) {
    errors.push(
      `CG position ${cgPosition}% MAC is aft of limit (${config.cgRange.aft}% MAC)`,
    );
  } else {
    infos.push(
      `CG position ${cgPosition}% MAC is within envelope (${config.cgRange.forward}-${config.cgRange.aft}% MAC)`,
    );
  }

  // Rule 6: Section Overweight — prevent exceeding compartment limits
  for (const [sectionKey, sw] of Object.entries(sectionWeights)) {
    if (sw.weight > sw.maxWeight) {
      errors.push(
        `Section "${sectionKey}" overweight: ${Math.round(sw.weight)}kg exceeds limit of ${sw.maxWeight}kg`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
    infos,
  };
}
