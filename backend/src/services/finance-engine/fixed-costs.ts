/**
 * Fixed Cost Allocation & Maintenance Alerts — Pure calculation module.
 *
 * Allocates monthly fixed costs (lease, insurance, maintenance reserve) to a
 * single flight, and detects upcoming maintenance checks.
 */

import type { FinanceAircraftProfile, FixedCostAllocation, MaintThreshold, MaintCheckAlert, FinanceCheckType } from '@acars/shared';

export interface FixedCostInput {
  /** Block hours for this flight */
  blockHours: number;
  /** Aircraft financial profile */
  profile: Pick<FinanceAircraftProfile, 'leaseMonthly' | 'maintReservePerFh' | 'insuranceHullValue' | 'insuranceHullPct' | 'insuranceLiability' | 'insuranceWarRisk'>;
  /** Flights this aircraft has completed this month (for pro-rata allocation) */
  monthlyFlights: number;
}

/** Allocate per-flight share of fixed costs. */
export function allocateFixedCosts(input: FixedCostInput): FixedCostAllocation {
  const { blockHours, profile, monthlyFlights } = input;
  const divisor = Math.max(monthlyFlights, 1);

  const maintReserve = round2(blockHours * profile.maintReservePerFh);

  const leaseAlloc = round2(profile.leaseMonthly / divisor);

  const monthlyHull = (profile.insuranceHullValue * profile.insuranceHullPct) / 12;
  const monthlyLiability = profile.insuranceLiability / 12;
  const monthlyWarRisk = profile.insuranceWarRisk / 12;
  const insuranceAlloc = round2((monthlyHull + monthlyLiability + monthlyWarRisk) / divisor);

  const totalFixedAlloc = round2(maintReserve + leaseAlloc + insuranceAlloc);

  return { maintReserve, leaseAlloc, insuranceAlloc, totalFixedAlloc };
}

export interface AircraftHoursInput {
  totalHours: number;
  hoursAtLastA: number;
  hoursAtLastC: number;
  lastDCheckDate: string | null;
}

/** Compute maintenance check alerts for an aircraft. */
export function computeMaintAlerts(hours: AircraftHoursInput, thresholds: MaintThreshold[]): MaintCheckAlert[] {
  const alerts: MaintCheckAlert[] = [];

  for (const t of thresholds) {
    let hoursSinceCheck = 0;
    let thresholdHours = t.intervalHours ?? 0;

    if (t.checkType === 'A') {
      hoursSinceCheck = hours.totalHours - hours.hoursAtLastA;
    } else if (t.checkType === 'C' || t.checkType === 'ESV') {
      hoursSinceCheck = hours.totalHours - hours.hoursAtLastC;
    } else if (t.checkType === 'D' && t.intervalYears && hours.lastDCheckDate) {
      // D check is year-based — convert to equivalent hours
      const lastD = new Date(hours.lastDCheckDate);
      const now = new Date();
      const yearsSince = (now.getTime() - lastD.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      // Approximate: assume 2000 flight hours per year for threshold comparison
      hoursSinceCheck = yearsSince * 2000;
      thresholdHours = t.intervalYears * 2000;
    } else if (t.checkType === 'D') {
      // No previous D check recorded — show as approaching
      hoursSinceCheck = hours.totalHours;
      thresholdHours = (t.intervalYears ?? 8) * 2000;
    }

    if (thresholdHours <= 0) continue;

    const hoursRemaining = thresholdHours - hoursSinceCheck;
    const pctUsed = round2((hoursSinceCheck / thresholdHours) * 100);

    let status: MaintCheckAlert['status'] = 'ok';
    if (hoursRemaining <= 0) status = 'overdue';
    else if (pctUsed >= 90) status = 'due';
    else if (pctUsed >= 75) status = 'approaching';

    alerts.push({
      checkType: t.checkType as FinanceCheckType,
      currentHours: hours.totalHours,
      thresholdHours,
      hoursSinceCheck: round2(hoursSinceCheck),
      hoursRemaining: round2(Math.max(hoursRemaining, 0)),
      pctUsed,
      costRange: { min: t.costMin, max: t.costMax },
      downtimeRange: { minDays: t.downtimeDaysMin, maxDays: t.downtimeDaysMax },
      status,
    });
  }

  return alerts;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
