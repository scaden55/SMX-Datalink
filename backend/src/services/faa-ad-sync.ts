import { getDb } from '../db/index.js';
import { logger } from '../lib/logger.js';

const TAG = 'FaaAdSync';
const FR_API = 'https://www.federalregister.gov/api/v1/documents.json';

interface FrDocument {
  document_number: string;
  title: string;
  abstract: string;
  publication_date: string;
  effective_on: string;
  html_url: string;
  type: string;
}

interface FrResponse {
  count: number;
  results: FrDocument[];
  next_page_url?: string;
}

const TYPE_SEARCH_TERMS: Record<string, string> = {
  'A30F': 'Airbus A300',
  'A306': 'Airbus A300-600',
  'A320': 'Airbus A320',
  'A321': 'Airbus A321',
  'AT72': 'ATR 72',
  'AT75': 'ATR 72',
  'AT76': 'ATR 72-600',
  'B733': 'Boeing 737-300',
  'B734': 'Boeing 737-400',
  'B737': 'Boeing 737',
  'B738': 'Boeing 737-800',
  'B739': 'Boeing 737-900',
  'B752': 'Boeing 757-200',
  'B753': 'Boeing 757-300',
  'B77F': 'Boeing 777',
  'B77L': 'Boeing 777',
  'DHC6': 'de Havilland DHC-6',
  'MD1F': 'McDonnell Douglas MD-11',
  'MD11': 'McDonnell Douglas MD-11',
};

// ── AD Classification ────────────────────────────────────────
//
// FAA AD abstracts use standardized regulatory language.
// We classify into: recurring, one-time (complied), or needs_review.

interface AdClassification {
  complianceStatus: 'open' | 'recurring';
  needsReview: boolean;
  reason: string;
  recurringIntervalHours: number | null;
}

// Patterns that strongly indicate recurring inspections
const RECURRING_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /repetitive\s+inspections?/i, label: 'repetitive inspection' },
  { re: /recurring\s+inspections?/i, label: 'recurring inspection' },
  { re: /repeat(ed)?\s+inspections?/i, label: 'repeated inspection' },
  { re: /at\s+intervals?\s+not\s+to\s+exceed/i, label: 'interval-based inspection' },
  { re: /repetitive\s+(detailed|ultrasonic|eddy.?current|visual|borescope|high.?frequency)\s+inspections?/i, label: 'repetitive NDT inspection' },
  { re: /thereafter\s+at\s+intervals/i, label: 'thereafter at intervals' },
  { re: /and\s+repetitive\s+thereafter/i, label: 'repetitive thereafter' },
];

// Patterns that strongly indicate one-time actions
const ONE_TIME_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /one-time\s+inspection/i, label: 'one-time inspection' },
  { re: /one\s+time\s+inspection/i, label: 'one-time inspection' },
  { re: /terminating\s+action/i, label: 'terminating action' },
  { re: /requires?\s+replacing/i, label: 'requires replacement' },
  { re: /requires?\s+(?:a\s+)?replacement\s+of/i, label: 'requires replacement' },
  { re: /requires?\s+(?:a\s+)?modification\s+of/i, label: 'requires modification' },
  { re: /requires?\s+installing/i, label: 'requires installation' },
  { re: /revising\s+the\s+(?:existing\s+)?(?:airplane\s+)?flight\s+manual/i, label: 'AFM revision' },
  { re: /requires?\s+revising/i, label: 'requires revision' },
];

// Try to extract a recurring interval in flight hours
const INTERVAL_HOURS_PATTERNS: RegExp[] = [
  /at\s+intervals?\s+not\s+to\s+exceed\s+([\d,]+)\s+flight\s+hours/i,
  /every\s+([\d,]+)\s+flight\s+hours/i,
  /(?:recurring|repetitive)\s+.*?([\d,]+)\s+flight.?hours/i,
  /intervals?\s+of\s+([\d,]+)\s+(?:flight\s+)?hours/i,
];

function classifyAd(abstract: string): AdClassification {
  if (!abstract || abstract.trim().length === 0) {
    return { complianceStatus: 'open', needsReview: true, reason: 'No abstract available', recurringIntervalHours: null };
  }

  const text = abstract.toLowerCase();

  // Check for NPRM corrections or errata — not actionable ADs
  if (/correcting\s+a\s+notice\s+of\s+proposed\s+rulemaking/i.test(text) ||
      /nprm.*correction/i.test(text)) {
    return { complianceStatus: 'open', needsReview: true, reason: 'NPRM correction — verify if AD was finalized', recurringIntervalHours: null };
  }

  // Check for proposed (not yet final) ADs
  const isProposed = /proposes?\s+to\s+(adopt|supersede|issue)/i.test(text) ||
                     /proposed\s+ad\s+would/i.test(text);

  // Check recurring patterns first (higher priority — a recurring AD with a
  // terminating action is still recurring until the termination is done)
  for (const { re, label } of RECURRING_PATTERNS) {
    if (re.test(text)) {
      const hours = extractIntervalHours(text);
      return {
        complianceStatus: 'recurring',
        needsReview: isProposed,
        reason: isProposed ? `Proposed — ${label} (verify final rule)` : label,
        recurringIntervalHours: hours,
      };
    }
  }

  // Check one-time patterns
  for (const { re, label } of ONE_TIME_PATTERNS) {
    if (re.test(text)) {
      return {
        complianceStatus: 'open',
        needsReview: isProposed,
        reason: isProposed ? `Proposed — ${label} (verify final rule)` : `One-time: ${label}`,
        recurringIntervalHours: null,
      };
    }
  }

  // Heuristic: if it mentions "inspection" without recurring/one-time qualifiers,
  // it's ambiguous — flag for review
  if (/\binspection\b/i.test(text)) {
    return {
      complianceStatus: 'open',
      needsReview: true,
      reason: 'Mentions inspection but type unclear — verify recurring vs one-time',
      recurringIntervalHours: null,
    };
  }

  // If proposed, always flag
  if (isProposed) {
    return {
      complianceStatus: 'open',
      needsReview: true,
      reason: 'Proposed AD — not yet finalized',
      recurringIntervalHours: null,
    };
  }

  // Fallback: couldn't classify
  return {
    complianceStatus: 'open',
    needsReview: true,
    reason: 'Could not classify from abstract — manual review required',
    recurringIntervalHours: null,
  };
}

function extractIntervalHours(text: string): number | null {
  for (const re of INTERVAL_HOURS_PATTERNS) {
    const m = re.exec(text);
    if (m) {
      const hours = parseInt(m[1].replace(/,/g, ''), 10);
      if (!isNaN(hours) && hours > 0) return hours;
    }
  }
  return null;
}

// ── Sync Service ─────────────────────────────────────────────

export class FaaAdSyncService {
  async syncAll(): Promise<{ synced: number; classified: { recurring: number; oneTime: number; needsReview: number }; errors: string[] }> {
    const db = getDb();
    const types = db.prepare('SELECT DISTINCT icao_type FROM fleet').all() as { icao_type: string }[];

    let totalSynced = 0;
    const classified = { recurring: 0, oneTime: 0, needsReview: 0 };
    const errors: string[] = [];

    for (const { icao_type } of types) {
      try {
        const result = await this.syncForType(icao_type);
        totalSynced += result.inserted;
        classified.recurring += result.recurring;
        classified.oneTime += result.oneTime;
        classified.needsReview += result.needsReview;
      } catch (err) {
        const msg = `Failed to sync ADs for ${icao_type}: ${err}`;
        logger.error(TAG, msg);
        errors.push(msg);
      }
    }

    logger.info(TAG, `AD sync complete: ${totalSynced} new ADs (${classified.recurring} recurring, ${classified.oneTime} one-time, ${classified.needsReview} need review) across ${types.length} types`);
    return { synced: totalSynced, classified, errors };
  }

  private async syncForType(icaoType: string): Promise<{ inserted: number; recurring: number; oneTime: number; needsReview: number }> {
    const searchTerm = TYPE_SEARCH_TERMS[icaoType];
    if (!searchTerm) {
      logger.info(TAG, `No FAA search term mapped for ICAO type ${icaoType}, skipping`);
      return { inserted: 0, recurring: 0, oneTime: 0, needsReview: 0 };
    }

    const params = new URLSearchParams();
    params.set('conditions[cfr][title]', '14');
    params.set('conditions[cfr][part]', '39');
    params.set('conditions[term]', searchTerm);
    params.set('per_page', '50');
    params.set('order', 'newest');
    for (const f of ['document_number', 'title', 'abstract', 'publication_date', 'effective_on', 'html_url', 'type']) {
      params.append('fields[]', f);
    }

    const url = `${FR_API}?${params}`;
    logger.info(TAG, `Fetching ADs for ${icaoType} (${searchTerm})`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Federal Register API returned ${response.status}`);
    }

    const data = await response.json() as FrResponse;
    const db = getDb();

    const aircraftIds = db.prepare('SELECT id FROM fleet WHERE icao_type = ?').all(icaoType) as { id: number }[];

    let inserted = 0;
    let recurring = 0;
    let oneTime = 0;
    let needsReview = 0;

    for (const doc of data.results) {
      if (!doc.title.toLowerCase().includes('airworthiness directive')) continue;

      const classification = classifyAd(doc.abstract);

      for (const { id: aircraftId } of aircraftIds) {
        const exists = db.prepare(
          'SELECT id FROM airworthiness_directives WHERE aircraft_id = ? AND ad_number = ?'
        ).get(aircraftId, doc.document_number);

        if (!exists) {
          db.prepare(`
            INSERT INTO airworthiness_directives (
              aircraft_id, ad_number, title, description, compliance_status,
              federal_register_url, source, applicability, compliance_summary,
              needs_review, classification_reason, recurring_interval_hours,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'faa_sync', ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          `).run(
            aircraftId,
            doc.document_number,
            doc.title,
            doc.abstract || '',
            classification.complianceStatus,
            doc.html_url,
            searchTerm,
            doc.abstract || '',
            classification.needsReview ? 1 : 0,
            classification.reason,
            classification.recurringIntervalHours,
          );
          inserted++;

          // Count only once per doc (not per aircraft)
          if (aircraftIds[0].id === aircraftId) {
            if (classification.complianceStatus === 'recurring') recurring++;
            else oneTime++;
            if (classification.needsReview) needsReview++;
          }
        }
      }
    }

    logger.info(TAG, `Synced ${inserted} new ADs for ${icaoType} (${recurring} recurring, ${oneTime} one-time, ${needsReview} need review)`);
    return { inserted, recurring, oneTime, needsReview };
  }
}
