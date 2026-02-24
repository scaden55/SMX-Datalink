import { getDb } from '../db/index.js';
import { generateCargoLoad } from './cargo/index.js';
import type { CargoLoad, CargoManifest, GenerateCargoRequest } from '@acars/shared';

export class CargoService {
  /** Generate a new cargo manifest and persist it. */
  generate(req: GenerateCargoRequest, userId: number): CargoManifest {
    const db = getDb();

    // Delete any existing manifest for this flight (regeneration)
    db.prepare('DELETE FROM cargo_manifests WHERE flight_id = ? AND user_id = ?')
      .run(req.flightId, userId);

    const load: CargoLoad = generateCargoLoad({
      aircraftType: req.aircraftIcao,
      totalPayload: req.payloadKg,
      payloadUnit: req.payloadUnit,
      cargoMode: req.cargoMode,
      primaryCategory: req.primaryCategory,
      useRealWorldCompanies: req.useRealWorldCompanies ?? false,
    });

    const stmt = db.prepare(`
      INSERT INTO cargo_manifests
        (flight_id, user_id, manifest_number, aircraft_icao, payload_kg,
         cargo_mode, primary_category, total_weight_kg, cg_position,
         payload_utilization, ulds_json, section_weights_json, remarks_json,
         notoc_required, notoc_items_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      req.flightId,
      userId,
      load.manifestNumber,
      req.aircraftIcao,
      req.payloadKg,
      req.cargoMode,
      req.primaryCategory ?? null,
      load.totalWeightKg,
      load.cgPosition,
      load.payloadUtilization,
      JSON.stringify(load.ulds),
      JSON.stringify(load.sectionWeights),
      JSON.stringify(load.remarks),
      load.notocRequired ? 1 : 0,
      load.notocItems.length > 0 ? JSON.stringify(load.notocItems) : null,
    );

    return {
      ...load,
      id: result.lastInsertRowid as number,
      flightId: req.flightId,
      userId,
      createdAt: new Date().toISOString(),
    };
  }

  /** Get manifest for a flight. */
  getByFlightId(flightId: number): CargoManifest | null {
    const db = getDb();
    const row = db.prepare(
      'SELECT * FROM cargo_manifests WHERE flight_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(flightId) as Record<string, unknown> | undefined;

    if (!row) return null;
    return this.rowToManifest(row);
  }

  /** Delete a manifest (for regeneration). */
  delete(manifestId: number, userId: number): boolean {
    const db = getDb();
    const result = db.prepare(
      'DELETE FROM cargo_manifests WHERE id = ? AND user_id = ?'
    ).run(manifestId, userId);
    return result.changes > 0;
  }

  /** Link a manifest to a logbook entry. */
  linkToLogbook(logbookId: number, manifestId: number): void {
    const db = getDb();
    db.prepare('UPDATE logbook SET cargo_manifest_id = ? WHERE id = ?')
      .run(manifestId, logbookId);
  }

  private rowToManifest(row: Record<string, unknown>): CargoManifest {
    return {
      id: row.id as number,
      flightId: row.flight_id as number,
      userId: row.user_id as number,
      manifestNumber: row.manifest_number as string,
      aircraftIcao: row.aircraft_icao as string,
      aircraftName: '',
      ulds: JSON.parse(row.ulds_json as string),
      sectionWeights: JSON.parse(row.section_weights_json as string),
      totalWeightKg: row.total_weight_kg as number,
      totalWeightDisplay: row.total_weight_kg as number,
      totalWeightUnit: 'KG',
      cgPosition: row.cg_position as number,
      cgRange: { forward: 0, aft: 0 },
      cgTarget: 0,
      payloadUtilization: row.payload_utilization as number,
      aircraftMaxPayloadKg: 0,
      remarks: row.remarks_json ? JSON.parse(row.remarks_json as string) : [],
      specialCargo: [],
      notocRequired: row.notoc_required === 1,
      notocItems: row.notoc_items_json ? JSON.parse(row.notoc_items_json as string) : [],
      cargoMode: row.cargo_mode as CargoManifest['cargoMode'],
      primaryCategory: row.primary_category as CargoManifest['primaryCategory'],
      createdAt: row.created_at as string,
    };
  }
}
