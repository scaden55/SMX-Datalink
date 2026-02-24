// ─── Cargo Distribution Engine ──────────────────────────────
// Core algorithm that takes aircraft + payload parameters and generates
// a complete CargoLoad with ULDs distributed across sections.

import type { CargoLoad, CargoMode, ULD, SectionWeight, NotocItem, CargoCategoryCode } from '@acars/shared';
import { getAircraftConfig, ULD_TYPES } from './aircraft-configs.js';
import type { AircraftConfig } from './aircraft-configs.js';
import { CARGO_CATEGORIES, getRandomDescription, getRandomWeight } from './cargo-categories.js';
import { getRandomCompany, generateAWBNumber } from './company-data.js';

export interface GenerateParams {
  aircraftType: string;
  totalPayload: number;
  payloadUnit: 'LBS' | 'KGS';
  cargoMode?: CargoMode;
  primaryCategory?: CargoCategoryCode;
  useRealWorldCompanies?: boolean;
}

// Distribution targets by section (fraction of total payload)
const SECTION_TARGETS: Record<string, number> = {
  mainDeck: 0.65,
  forwardHold: 0.18,
  aftHold: 0.12,
  bulk: 0.05,
};

/** Shuffle an array in-place (Fisher-Yates). */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Generate a unique ULD ID (e.g., PMC12345). */
function generateUldId(uldType: string): string {
  const num = String(Math.floor(Math.random() * 99999)).padStart(5, '0');
  return `${uldType}${num}`;
}

/** Generate a manifest number: CGO-YYYYMMDD-XXXX. */
function generateManifestNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const seq = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `CGO-${date}-${seq}`;
}

/** Pick a random category code for mixed mode. */
function pickRandomCategory(): CargoCategoryCode {
  const codes = Object.keys(CARGO_CATEGORIES) as CargoCategoryCode[];
  // Weighted: less likely to get dangerous_goods and live_animals in mixed mode
  const weighted = codes.filter(c => c !== 'dangerous_goods' && c !== 'live_animals');
  // 10% chance of DG/AVI in mixed mode
  if (Math.random() < 0.10) {
    return Math.random() < 0.5 ? 'dangerous_goods' : 'live_animals';
  }
  return weighted[Math.floor(Math.random() * weighted.length)];
}

/** Calculate simplified CG position as weighted average of section arm positions. */
function calculateCG(
  ulds: ULD[],
  sectionArms: Record<string, number>,
): number {
  let totalWeight = 0;
  let totalMoment = 0;

  for (const uld of ulds) {
    const arm = sectionArms[uld.section] ?? 0.5;
    totalWeight += uld.gross_weight;
    totalMoment += uld.gross_weight * arm;
  }

  if (totalWeight === 0) return 0;
  // Convert 0-1 range to %MAC (roughly 10-45%)
  const rawCG = totalMoment / totalWeight;
  return Math.round(rawCG * 70 + 5); // maps 0-1 -> 5-75% MAC range approximately
}

/** Generate dispatcher remarks based on cargo content. */
function generateRemarks(ulds: ULD[]): string[] {
  const remarks: string[] = [];
  const tempControlled = ulds.filter(u => u.temp_controlled);
  const hazmat = ulds.filter(u => u.hazmat);
  const lithium = ulds.filter(u => u.lithium_battery);
  const heavy = ulds.filter(u => u.gross_weight > 5000);

  if (tempControlled.length > 0) {
    remarks.push(`${tempControlled.length} ULD(s) require temperature monitoring`);
  }
  if (hazmat.length > 0) {
    remarks.push(`CAUTION: ${hazmat.length} ULD(s) contain dangerous goods — refer to NOTOC`);
  }
  if (lithium.length > 0) {
    remarks.push(`${lithium.length} ULD(s) may contain lithium batteries — CAO restrictions apply`);
  }
  if (heavy.length > 0) {
    remarks.push(`${heavy.length} ULD(s) exceed 5000kg — verify floor loading limits`);
  }
  remarks.push('SIMULATION ONLY — This cargo manifest is for flight simulation purposes');
  return remarks;
}

/** Generate NOTOC items from hazmat/special ULDs. */
function generateNotocItems(ulds: ULD[]): NotocItem[] {
  const items: NotocItem[] = [];
  const dgCategory = CARGO_CATEGORIES['dangerous_goods'];
  const dgClasses = dgCategory?.dgClasses ?? ['3', '9'];

  for (const uld of ulds) {
    if (uld.hazmat || uld.notoc_required) {
      const dgClass = dgClasses[Math.floor(Math.random() * dgClasses.length)];
      const unNumber = `UN${String(1000 + Math.floor(Math.random() * 3000)).padStart(4, '0')}`;

      items.push({
        uld_id: uld.uld_id,
        position: uld.position,
        proper_shipping_name: uld.cargo_description,
        un_number: unNumber,
        class: dgClass,
        packing_group: (['I', 'II', 'III'] as const)[Math.floor(Math.random() * 3)],
        quantity: `${Math.ceil(Math.random() * 20)} pcs`,
        net_weight: `${Math.round(uld.weight * 0.3)} kg`,
      });
    }
  }
  return items;
}

/**
 * Generate a complete cargo load distribution for an aircraft.
 */
export function generateCargoLoad(params: GenerateParams): CargoLoad {
  const {
    aircraftType,
    totalPayload,
    payloadUnit,
    cargoMode = 'mixed',
    primaryCategory,
    useRealWorldCompanies = false,
  } = params;

  // Convert payload to KG
  const payloadKg = payloadUnit === 'LBS' ? totalPayload * 0.453592 : totalPayload;

  // Get aircraft config (fallback to B763 if not found)
  const config = getAircraftConfig(aircraftType) ?? getAircraftConfig('B763')!;

  return generateWithConfig(
    config,
    payloadKg,
    payloadUnit,
    cargoMode,
    primaryCategory,
    useRealWorldCompanies,
  );
}

function generateWithConfig(
  config: AircraftConfig,
  payloadKg: number,
  payloadUnit: 'LBS' | 'KGS',
  cargoMode: CargoMode,
  primaryCategory: CargoCategoryCode | undefined,
  useRealWorldCompanies: boolean,
): CargoLoad {
  // Cap payload at aircraft max
  const effectivePayload = Math.min(payloadKg, config.maxPayload);

  const ulds: ULD[] = [];
  const sectionWeights: Record<string, SectionWeight> = {};
  const sectionArms: Record<string, number> = {};

  // Build section arm map
  for (const [key, section] of Object.entries(config.sections)) {
    sectionArms[key] = section.arm;
  }

  // Distribute payload across sections
  for (const [sectionKey, section] of Object.entries(config.sections)) {
    const targetWeight = effectivePayload * (SECTION_TARGETS[sectionKey] ?? 0.05);
    const maxSectionWeight = section.maxWeight;
    const sectionTarget = Math.min(targetWeight, maxSectionWeight);

    let sectionFilled = 0;
    const positions = shuffle([...section.positions]);

    for (const position of positions) {
      if (sectionFilled >= sectionTarget) break;

      // Pick category
      const catCode: CargoCategoryCode = cargoMode === 'single' && primaryCategory
        ? primaryCategory
        : pickRandomCategory();

      const cat = CARGO_CATEGORIES[catCode];
      if (!cat) continue;

      // Pick ULD type
      const uldTypeCode = section.uldTypes[Math.floor(Math.random() * section.uldTypes.length)];
      const uldType = ULD_TYPES[uldTypeCode];
      if (!uldType) continue;

      // Calculate cargo weight for this ULD
      let cargoWeight = getRandomWeight(catCode);
      const remaining = sectionTarget - sectionFilled;
      cargoWeight = Math.min(cargoWeight, remaining, uldType.maxGross - uldType.tare);

      // Skip if too little cargo
      if (cargoWeight < 100) continue;

      const grossWeight = cargoWeight + uldType.tare;

      // Generate shipper/consignee
      const shipper = getRandomCompany(catCode, 'shipper', useRealWorldCompanies);
      const consignee = getRandomCompany(catCode, 'consignee', useRealWorldCompanies);

      const uld: ULD = {
        uld_id: generateUldId(uldTypeCode),
        uld_type: uldTypeCode,
        uld_type_name: uldType.name,
        position,
        section: sectionKey,
        section_name: section.name,
        weight: Math.round(cargoWeight),
        gross_weight: Math.round(grossWeight),
        tare_weight: uldType.tare,
        cargo_description: getRandomDescription(catCode),
        category: cat.name,
        category_name: cat.name,
        category_code: catCode,
        shipper,
        consignee,
        awb_number: generateAWBNumber(),
        temp_controlled: cat.tempControlled,
        temp_requirement: cat.tempRange ? `${cat.tempRange.min}/${cat.tempRange.max}${cat.tempRange.unit}` : null,
        temp_advisory: cat.tempControlled ? `Maintain ${cat.tempRange?.min}-${cat.tempRange?.max}${cat.tempRange?.unit}` : null,
        hazmat: cat.hazmat,
        notoc_required: cat.notocRequired,
        lithium_battery: cat.lithiumBattery ?? false,
      };

      ulds.push(uld);
      sectionFilled += cargoWeight;
    }

    // Record section weight
    sectionWeights[sectionKey] = {
      name: section.name,
      weight: Math.round(sectionFilled),
      maxWeight: maxSectionWeight,
      utilization: maxSectionWeight > 0 ? Math.round((sectionFilled / maxSectionWeight) * 100) : 0,
    };
  }

  // Calculate totals
  const totalWeightKg = ulds.reduce((sum, u) => sum + u.weight, 0);
  const totalWeightDisplay = payloadUnit === 'LBS' ? totalWeightKg * 2.20462 : totalWeightKg;
  const payloadUtilization = config.maxPayload > 0
    ? Math.round((totalWeightKg / config.maxPayload) * 100)
    : 0;

  // CG calculation
  const cgPosition = calculateCG(ulds, sectionArms);

  // Special cargo
  const specialCargo = ulds.filter(u => u.temp_controlled || u.hazmat || u.notoc_required || u.lithium_battery);

  // NOTOC items
  const notocItems = generateNotocItems(ulds);
  const notocRequired = notocItems.length > 0 || ulds.some(u => u.notoc_required);

  // Remarks
  const remarks = generateRemarks(ulds);

  return {
    manifestNumber: generateManifestNumber(),
    aircraftIcao: config.icao,
    aircraftName: config.name,
    ulds,
    sectionWeights,
    totalWeightKg: Math.round(totalWeightKg),
    totalWeightDisplay: Math.round(totalWeightDisplay),
    totalWeightUnit: payloadUnit === 'LBS' ? 'LBS' : 'KGS',
    cgPosition,
    cgRange: config.cgRange,
    cgTarget: config.cgTarget,
    payloadUtilization,
    aircraftMaxPayloadKg: config.maxPayload,
    remarks,
    specialCargo,
    notocRequired,
    notocItems,
    cargoMode,
    primaryCategory: primaryCategory ?? null,
  };
}
