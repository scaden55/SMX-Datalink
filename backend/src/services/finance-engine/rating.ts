/**
 * Cargo Revenue Rating — Pure calculation module.
 *
 * Rates a cargo manifest's ULDs into per-shipment charges and a revenue total.
 * Each ULD's cargo_description is matched to a commodity code for its rate_per_lb.
 * Fallback chain: exact commodity match → category average → global default rate.
 */

import type { ULD } from '@acars/shared';
import type { CommodityCode, FinanceRateConfig, RatedShipment, RatedManifest } from '@acars/shared';

export interface RatingInput {
  cargoManifestId: number;
  logbookId?: number | null;
  /** ULDs from the cargo manifest (each has awb_number, weight, category_code) */
  ulds: ULD[];
  /** Per-commodity rates keyed by commodity code → rate_per_lb */
  commodityRates: Map<CommodityCode, number>;
  /** Per-category average rates as fallback */
  categoryRates: Map<string, number>;
  /** Global rate configuration */
  rateConfig: FinanceRateConfig;
  /** Aircraft cargo capacity in lbs (for load factor calc) */
  cargoCapacityLbs: number;
  /** Whether this is a charter flight (applies charter multiplier) */
  isCharter: boolean;
}

/** Rate a cargo manifest's ULDs into per-shipment revenue breakdown. */
export function rateManifest(input: RatingInput): RatedManifest {
  const { cargoManifestId, logbookId, ulds, commodityRates, categoryRates, rateConfig, cargoCapacityLbs, isCharter } = input;

  let totalWeight = 0;
  const shipments: RatedShipment[] = [];

  for (const uld of ulds) {
    // ULDs store weight in kg — convert to lbs for rating
    const actualWeightLbs = uld.weight * 2.20462;
    // No volumetric dimensions on ULDs — chargeable = actual
    const chargeableWeight = actualWeightLbs;
    totalWeight += chargeableWeight;

    // Resolve the rate for this ULD:
    // 1. Try exact commodity_code match (cargo_description mapped to commodity)
    // 2. Fall back to category average rate
    // 3. Fall back to global defaultLaneRate
    const categoryCode = uld.category_code;
    const commodityCode: CommodityCode = categoryCode;
    const ratePerLb = commodityRates.get(commodityCode)
      ?? categoryRates.get(categoryCode)
      ?? rateConfig.defaultLaneRate;

    // Calculate charges — rate_per_lb is the full base rate (no separate surcharge)
    const baseCharge = round2(chargeableWeight * ratePerLb);
    const commoditySurcharge = 0; // Surcharge is now baked into the per-commodity rate
    const subtotal = baseCharge;
    const fuelSurcharge = round2(subtotal * rateConfig.fuelSurchargePct);
    const securityFee = round2(rateConfig.securityFee);
    const valuationCharge = 0;

    let totalCharge = round2(subtotal + fuelSurcharge + securityFee + valuationCharge);
    if (isCharter) {
      totalCharge = round2(totalCharge * rateConfig.charterMultiplier);
    }

    shipments.push({
      awbNumber: uld.awb_number,
      uldId: uld.uld_id,
      commodityCode,
      actualWeight: round2(actualWeightLbs),
      chargeableWeight: round2(chargeableWeight),
      baseCharge,
      commoditySurcharge,
      fuelSurcharge,
      securityFee,
      valuationCharge,
      totalCharge,
    });
  }

  const totalRevenue = shipments.reduce((sum, s) => sum + s.totalCharge, 0);
  const totalBaseCharge = shipments.reduce((sum, s) => sum + s.baseCharge, 0);
  const totalSurcharges = shipments.reduce((sum, s) => sum + s.commoditySurcharge, 0);
  const totalFuelSurcharge = shipments.reduce((sum, s) => sum + s.fuelSurcharge, 0);
  const totalSecurityFees = shipments.reduce((sum, s) => sum + s.securityFee, 0);
  const yieldPerLb = totalWeight > 0 ? round2(totalRevenue / totalWeight) : 0;
  const loadFactor = cargoCapacityLbs > 0 ? round2((totalWeight / cargoCapacityLbs) * 100) : 0;

  return {
    cargoManifestId,
    logbookId: logbookId ?? null,
    shipments,
    totalRevenue: round2(totalRevenue),
    totalBaseCharge: round2(totalBaseCharge),
    totalSurcharges: round2(totalSurcharges),
    totalFuelSurcharge: round2(totalFuelSurcharge),
    totalSecurityFees: round2(totalSecurityFees),
    charterMultiplier: isCharter ? rateConfig.charterMultiplier : 1.0,
    yieldPerLb,
    loadFactor,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
