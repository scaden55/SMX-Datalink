/**
 * Operational Events — Pure calculation module.
 *
 * Generates random operational events (~4% per flight) with financial impact.
 * AOG probability increases when maintenance checks are overdue.
 */

import type { OperationalEvent, OpEventType, MaintCheckAlert } from '@acars/shared';

interface EventTemplate {
  type: OpEventType;
  weight: number;
  title: string;
  impactMin: number;
  impactMax: number;
  descriptionFn: (impact: number) => string;
}

const EVENT_TEMPLATES: EventTemplate[] = [
  {
    type: 'crew_delay',
    weight: 30,
    title: 'Crew Scheduling Delay',
    impactMin: 2000,
    impactMax: 8000,
    descriptionFn: (impact) => `Flight crew rest requirements caused a ${Math.round(impact / 1000)}hr delay. Additional crew per diem and passenger rebooking costs incurred.`,
  },
  {
    type: 'customs_hold',
    weight: 20,
    title: 'Customs Documentation Hold',
    impactMin: 1500,
    impactMax: 5000,
    descriptionFn: (impact) => `Cargo held at customs due to incomplete documentation. Storage fees and expedited processing cost $${impact.toLocaleString()}.`,
  },
  {
    type: 'weather_divert',
    weight: 15,
    title: 'Weather Diversion',
    impactMin: 5000,
    impactMax: 15000,
    descriptionFn: (impact) => `Weather below minimums at destination required diversion to alternate. Extra fuel, landing fees, and ground handling totaled $${impact.toLocaleString()}.`,
  },
  {
    type: 'cargo_claim',
    weight: 15,
    title: 'Cargo Damage Claim',
    impactMin: 3000,
    impactMax: 12000,
    descriptionFn: (impact) => `Shipper filed damage claim for cargo mishandled during loading. Estimated payout: $${impact.toLocaleString()}.`,
  },
  {
    type: 'aog',
    weight: 10,
    title: 'Aircraft on Ground (AOG)',
    impactMin: 20000,
    impactMax: 80000,
    descriptionFn: (impact) => `Unscheduled maintenance event grounded aircraft. Parts, labor, and revenue loss totaled $${impact.toLocaleString()}.`,
  },
  {
    type: 'dgr_rejection',
    weight: 10,
    title: 'DGR Shipment Rejected',
    impactMin: 2000,
    impactMax: 6000,
    descriptionFn: (impact) => `Dangerous goods shipment rejected at acceptance due to packaging non-compliance. Rehandling and delay costs: $${impact.toLocaleString()}.`,
  },
];

export interface EventRollInput {
  /** Current maintenance alerts (overdue checks increase AOG probability) */
  maintAlerts: MaintCheckAlert[];
  /** Whether this flight carries dangerous goods */
  hasDgr: boolean;
  /** Injectable RNG for determinism in tests (default: Math.random) */
  rng?: () => number;
}

/** Roll for a random operational event. Returns null if no event occurs. */
export function rollOperationalEvent(input: EventRollInput): OperationalEvent | null {
  const rng = input.rng ?? Math.random;

  // Base event probability: 4%
  let eventChance = 0.04;

  // Increase AOG probability by 2% per overdue maintenance check
  const overdueCount = input.maintAlerts.filter(a => a.status === 'overdue').length;
  eventChance += overdueCount * 0.02;

  if (rng() > eventChance) return null;

  // Build weighted pool — filter DGR rejection if no DGR cargo
  const pool = EVENT_TEMPLATES.filter(t => {
    if (t.type === 'dgr_rejection' && !input.hasDgr) return false;
    return true;
  });

  // Adjust AOG weight if maintenance overdue
  const adjustedPool = pool.map(t => {
    if (t.type === 'aog' && overdueCount > 0) {
      return { ...t, weight: t.weight + overdueCount * 10 };
    }
    return t;
  });

  const totalWeight = adjustedPool.reduce((sum, t) => sum + t.weight, 0);
  let roll = rng() * totalWeight;

  let selected: EventTemplate = adjustedPool[0];
  for (const t of adjustedPool) {
    roll -= t.weight;
    if (roll <= 0) {
      selected = t;
      break;
    }
  }

  // Random impact within range
  const impact = round2(selected.impactMin + rng() * (selected.impactMax - selected.impactMin));

  return {
    eventType: selected.type,
    title: selected.title,
    description: selected.descriptionFn(impact),
    financialImpact: -impact, // negative = cost
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
