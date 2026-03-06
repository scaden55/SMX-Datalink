/**
 * P&L Aggregation — Pure calculation module.
 *
 * Produces per-flight and per-period profit & loss summaries.
 */

import type { FlightCostBreakdown, FixedCostAllocation, OperationalEvent, FlightPnL, PeriodPnL, PeriodType } from '@acars/shared';

export interface FlightPnLInput {
  logbookId: number;
  flightNumber?: string;
  depIcao?: string;
  arrIcao?: string;
  ratedManifestId: number | null;
  cargoRevenue: number;
  variableCosts: FlightCostBreakdown;
  fixedCosts: FixedCostAllocation;
  blockHours: number;
  payloadLbs: number;
  cargoCapacityLbs: number;
  event?: OperationalEvent | null;
}

/** Compute per-flight P&L from rated revenue, costs, and optional event. */
export function computeFlightPnL(input: FlightPnLInput): FlightPnL {
  const { logbookId, flightNumber, depIcao, arrIcao, ratedManifestId, cargoRevenue, variableCosts, fixedCosts, blockHours, payloadLbs, cargoCapacityLbs, event } = input;

  const eventImpact = event?.financialImpact ?? 0;
  const totalCost = variableCosts.totalVariableCost + fixedCosts.totalFixedAlloc + Math.abs(eventImpact);
  const grossProfit = round2(cargoRevenue - totalCost);
  const marginPct = cargoRevenue > 0 ? round2((grossProfit / cargoRevenue) * 100) : 0;
  const loadFactor = cargoCapacityLbs > 0 ? round2((payloadLbs / cargoCapacityLbs) * 100) : 0;

  // Break-even load factor: what LF would make profit = 0
  // revenue_at_be = totalCost → LF_be = (totalCost / cargoRevenue) * loadFactor
  const breakEvenLf = cargoRevenue > 0 && loadFactor > 0
    ? round2((totalCost / cargoRevenue) * loadFactor)
    : 0;

  const revenuePerBh = blockHours > 0 ? round2(cargoRevenue / blockHours) : 0;
  const costPerBh = blockHours > 0 ? round2(totalCost / blockHours) : 0;

  return {
    logbookId,
    flightNumber,
    depIcao,
    arrIcao,
    ratedManifestId,
    cargoRevenue: round2(cargoRevenue),
    fuelCost: variableCosts.fuelCost,
    landingFee: variableCosts.landingFee,
    parkingFee: variableCosts.parkingFee,
    handlingFee: variableCosts.handlingFee,
    navFee: variableCosts.navFee,
    deiceFee: variableCosts.deiceFee,
    uldFee: variableCosts.uldFee,
    crewCost: variableCosts.crewCost,
    totalVariableCost: variableCosts.totalVariableCost,
    maintReserve: fixedCosts.maintReserve,
    leaseAlloc: fixedCosts.leaseAlloc,
    insuranceAlloc: fixedCosts.insuranceAlloc,
    totalFixedAlloc: fixedCosts.totalFixedAlloc,
    grossProfit,
    marginPct,
    loadFactor,
    breakEvenLf,
    revenuePerBh,
    costPerBh,
    blockHours,
    payloadLbs,
    event: event ?? null,
  };
}

/** Aggregate multiple flight P&Ls into a period summary. */
export function computePeriodPnL(flights: FlightPnL[], periodType: PeriodType, periodKey: string): PeriodPnL {
  let totalRevenue = 0;
  let totalVariableCost = 0;
  let totalFixedCost = 0;
  let totalBlockHours = 0;
  let totalLeaseBack = 0;
  let totalPayloadLbs = 0;

  for (const f of flights) {
    totalRevenue += f.cargoRevenue;
    totalVariableCost += f.totalVariableCost;
    totalFixedCost += f.totalFixedAlloc;
    totalBlockHours += f.blockHours;
    totalLeaseBack += f.leaseAlloc;
    totalPayloadLbs += f.payloadLbs;
  }

  const ebitda = round2(totalRevenue - totalVariableCost - totalFixedCost);
  const ebitdar = round2(ebitda + totalLeaseBack);

  // CASM/RASM: cost/revenue per available seat mile (use payload-mile as proxy)
  const payloadMiles = totalPayloadLbs * totalBlockHours; // rough proxy
  const casm = payloadMiles > 0 ? round2((totalVariableCost + totalFixedCost) / payloadMiles * 1000) : 0;
  const rasm = payloadMiles > 0 ? round2(totalRevenue / payloadMiles * 1000) : 0;
  const avgYield = totalPayloadLbs > 0 ? round2(totalRevenue / totalPayloadLbs) : 0;

  return {
    periodType,
    periodKey,
    totalRevenue: round2(totalRevenue),
    totalVariableCost: round2(totalVariableCost),
    totalFixedCost: round2(totalFixedCost),
    ebitda,
    ebitdar,
    casm,
    rasm,
    avgYield,
    totalFlights: flights.length,
    totalBlockHours: round2(totalBlockHours),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
