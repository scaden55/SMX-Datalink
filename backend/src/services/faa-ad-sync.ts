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
  'B733': 'Boeing 737-300',
  'B734': 'Boeing 737-400',
  'B738': 'Boeing 737-800',
  'B739': 'Boeing 737-900',
  'AT75': 'ATR 72',
  'AT76': 'ATR 72-600',
  'AT72': 'ATR 72',
  'B752': 'Boeing 757-200',
  'B753': 'Boeing 757-300',
  'A320': 'Airbus A320',
  'A321': 'Airbus A321',
};

export class FaaAdSyncService {
  async syncAll(): Promise<{ synced: number; errors: string[] }> {
    const db = getDb();
    const types = db.prepare('SELECT DISTINCT icao_type FROM fleet').all() as { icao_type: string }[];

    let totalSynced = 0;
    const errors: string[] = [];

    for (const { icao_type } of types) {
      try {
        const count = await this.syncForType(icao_type);
        totalSynced += count;
      } catch (err) {
        const msg = `Failed to sync ADs for ${icao_type}: ${err}`;
        logger.error(TAG, msg);
        errors.push(msg);
      }
    }

    logger.info(TAG, `AD sync complete: ${totalSynced} new ADs across ${types.length} types`);
    return { synced: totalSynced, errors };
  }

  private async syncForType(icaoType: string): Promise<number> {
    const searchTerm = TYPE_SEARCH_TERMS[icaoType];
    if (!searchTerm) {
      logger.info(TAG, `No FAA search term mapped for ICAO type ${icaoType}, skipping`);
      return 0;
    }

    const params = new URLSearchParams({
      'conditions[cfr][title]': '14',
      'conditions[cfr][part]': '39',
      'conditions[term]': searchTerm,
      'per_page': '50',
      'order': 'newest',
      'fields[]': 'document_number,title,abstract,publication_date,effective_on,html_url,type',
    });

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

    for (const doc of data.results) {
      if (!doc.title.toLowerCase().includes('airworthiness directive')) continue;

      for (const { id: aircraftId } of aircraftIds) {
        const exists = db.prepare(
          'SELECT id FROM airworthiness_directives WHERE aircraft_id = ? AND ad_number = ?'
        ).get(aircraftId, doc.document_number);

        if (!exists) {
          db.prepare(`
            INSERT INTO airworthiness_directives (
              aircraft_id, ad_number, title, description, compliance_status,
              federal_register_url, source, applicability, compliance_summary,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, 'open', ?, 'faa_sync', ?, ?, datetime('now'), datetime('now'))
          `).run(
            aircraftId,
            doc.document_number,
            doc.title,
            doc.abstract || '',
            doc.html_url,
            searchTerm,
            doc.abstract || ''
          );
          inserted++;
        }
      }
    }

    logger.info(TAG, `Synced ${inserted} new ADs for ${icaoType}`);
    return inserted;
  }
}
