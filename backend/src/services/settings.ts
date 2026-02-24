import { getDb } from '../db/index.js';
import type { VaSetting } from '@acars/shared';

interface SettingRow {
  key: string;
  value: string;
  updated_by: number | null;
  updated_at: string;
}

const DEFAULTS: Record<string, string> = {
  'va.name': 'SMX Virtual',
  'va.icao': 'SMX',
  'pirep.auto_approve': 'false',
  'pirep.min_score': '0',
  'finance.pay_per_hour': '50',
  'finance.cargo_rate': '0.0005',
  'finance.pax_rate': '0.12',
  'bids.max_active': '5',
  'dev.enabled': 'false',
};

export class SettingsService {

  getAll(): VaSetting[] {
    const rows = getDb().prepare('SELECT * FROM va_settings ORDER BY key').all() as SettingRow[];
    return rows.map(this.toSetting);
  }

  get(key: string): string | null {
    const row = getDb().prepare('SELECT value FROM va_settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? DEFAULTS[key] ?? null;
  }

  set(key: string, value: string, updatedBy: number): void {
    getDb().prepare(`
      INSERT INTO va_settings (key, value, updated_by, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = datetime('now')
    `).run(key, value, updatedBy);
  }

  /** Allowed setting keys — reject any key not in this set */
  static ALLOWED_KEYS = new Set(Object.keys(DEFAULTS));

  bulkUpdate(settings: { key: string; value: string }[], updatedBy: number): void {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO va_settings (key, value, updated_by, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = datetime('now')
    `);

    const txn = db.transaction(() => {
      for (const s of settings) {
        // Only allow known setting keys
        if (!SettingsService.ALLOWED_KEYS.has(s.key)) continue;
        stmt.run(s.key, s.value, updatedBy);
      }
    });
    txn();
  }

  seedDefaults(): void {
    const existing = new Set(
      (getDb().prepare('SELECT key FROM va_settings').all() as { key: string }[]).map(r => r.key)
    );

    const stmt = getDb().prepare(
      'INSERT INTO va_settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))'
    );

    const txn = getDb().transaction(() => {
      for (const [key, value] of Object.entries(DEFAULTS)) {
        if (!existing.has(key)) {
          stmt.run(key, value);
        }
      }
    });
    txn();
  }

  private toSetting(row: SettingRow): VaSetting {
    return {
      key: row.key,
      value: row.value,
      updatedBy: row.updated_by,
      updatedAt: row.updated_at,
    };
  }
}
