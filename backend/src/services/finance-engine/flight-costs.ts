/**
 * Variable Flight Costs — Pure calculation module.
 *
 * Computes fuel, landing, handling, nav, crew, and other per-flight costs.
 */

import type { FlightCostBreakdown, StationFees, FinanceAircraftProfile } from '@acars/shared';

export interface FlightCostInput {
  /** Block hours (gate-to-gate) */
  blockHours: number;
  /** Aircraft financial profile */
  profile: Pick<FinanceAircraftProfile, 'baseFuelGph' | 'payloadFuelSensitivity' | 'mtowLbs' | 'crewPerDiem' | 'crewHotelRate'>;
  /** Total payload in lbs */
  payloadLbs: number;
  /** Great-circle distance in nautical miles */
  distanceNm: number;
  /** Number of ULDs on this flight */
  uldCount: number;
  /** Departure station fees */
  depStation: StationFees;
  /** Arrival station fees */
  arrStation: StationFees;
  /** Whether de-icing is needed at departure */
  needsDeice: boolean;
  /** Whether crew needs overnight hotel (layover) */
  isOvernight: boolean;
}

/** Compute variable costs for a single flight. */
export function computeFlightCosts(input: FlightCostInput): FlightCostBreakdown {
  const { blockHours, profile, payloadLbs, distanceNm, uldCount, depStation, arrStation, needsDeice, isOvernight } = input;

  // Fuel: block hours × (base GPH + payload sensitivity per 1000 lbs) × price
  const fuelGallons = blockHours * (profile.baseFuelGph + profile.payloadFuelSensitivity * (payloadLbs / 1000));
  const fuelCost = round2(fuelGallons * depStation.fuelPriceGal);

  // Landing fee: MTOW/1000 × arrival station rate
  const landingFee = round2((profile.mtowLbs / 1000) * arrStation.landingRate);

  // Parking: flat at arrival
  const parkingFee = round2(arrStation.parkingRate);

  // Ground handling: flat at arrival
  const handlingFee = round2(arrStation.groundHandling);

  // Navigation/overflight fees: average of dep and arr nav rates × distance
  const avgNavRate = (depStation.navFeePerNm + arrStation.navFeePerNm) / 2;
  const navFee = round2(distanceNm * avgNavRate);

  // De-icing: at departure if needed
  const deiceFee = needsDeice ? round2(depStation.deiceFee) : 0;

  // ULD handling: per ULD at arrival
  const uldFee = round2(uldCount * arrStation.uldHandling);

  // Crew: per diem for block hours + hotel if overnight
  let crewCost = round2(blockHours * profile.crewPerDiem);
  if (isOvernight) {
    crewCost = round2(crewCost + profile.crewHotelRate);
  }

  const totalVariableCost = round2(fuelCost + landingFee + parkingFee + handlingFee + navFee + deiceFee + uldFee + crewCost);

  return {
    fuelCost,
    landingFee,
    parkingFee,
    handlingFee,
    navFee,
    deiceFee,
    uldFee,
    crewCost,
    totalVariableCost,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
