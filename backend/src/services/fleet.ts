import { getDb } from '../db/index.js';
import type {
  FleetAircraft,
  FleetStatus,
  CreateFleetAircraftRequest,
  UpdateFleetAircraftRequest,
} from '@acars/shared';

// ── Raw DB row type ─────────────────────────────────────────────

interface FleetRow {
  id: number;
  icao_type: string;
  name: string;
  registration: string;
  airline: string;
  range_nm: number;
  cruise_speed: number;
  pax_capacity: number;
  cargo_capacity_lbs: number;
  is_active: number;
  status: string;
  base_icao: string | null;
  location_icao: string | null;
  remarks: string | null;
  updated_at: string | null;
}

// ── Filters ─────────────────────────────────────────────────────

export interface FleetFilters {
  icaoType?: string;
  status?: FleetStatus;
  search?: string;
}

// ── Service ─────────────────────────────────────────────────────

const VALID_STATUSES = new Set<FleetStatus>(['active', 'stored', 'retired']);

export class FleetService {

  findAll(filters?: FleetFilters): FleetAircraft[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.icaoType) {
      conditions.push('icao_type = ?');
      params.push(filters.icaoType);
    }
    if (filters?.status && VALID_STATUSES.has(filters.status)) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters?.search) {
      conditions.push('(registration LIKE ? OR name LIKE ? OR icao_type LIKE ? OR base_icao LIKE ?)');
      const term = `%${filters.search}%`;
      params.push(term, term, term, term);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM fleet ${where} ORDER BY icao_type, registration`;

    const rows = getDb().prepare(sql).all(...params) as FleetRow[];
    return rows.map(this.toFleetAircraft);
  }

  findById(id: number): FleetAircraft | undefined {
    const row = getDb()
      .prepare('SELECT * FROM fleet WHERE id = ?')
      .get(id) as FleetRow | undefined;
    return row ? this.toFleetAircraft(row) : undefined;
  }

  findDistinctTypes(): string[] {
    const rows = getDb()
      .prepare('SELECT DISTINCT icao_type FROM fleet ORDER BY icao_type')
      .all() as { icao_type: string }[];
    return rows.map(r => r.icao_type);
  }

  create(data: CreateFleetAircraftRequest): FleetAircraft {
    const status = data.status && VALID_STATUSES.has(data.status) ? data.status : 'active';
    const isActive = status === 'active' || status === 'stored' ? 1 : 0;
    const now = new Date().toISOString();

    const result = getDb().prepare(`
      INSERT INTO fleet (icao_type, name, registration, airline, range_nm, cruise_speed, pax_capacity, cargo_capacity_lbs, is_active, status, base_icao, location_icao, remarks, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.icaoType,
      data.name,
      data.registration,
      data.airline ?? 'SMA',
      data.rangeNm,
      data.cruiseSpeed,
      data.paxCapacity,
      data.cargoCapacityLbs,
      isActive,
      status,
      data.baseIcao ?? null,
      data.locationIcao ?? null,
      data.remarks ?? null,
      now,
    );

    return this.findById(result.lastInsertRowid as number)!;
  }

  update(id: number, data: UpdateFleetAircraftRequest): FleetAircraft | undefined {
    const existing = getDb().prepare('SELECT id FROM fleet WHERE id = ?').get(id);
    if (!existing) return undefined;

    const sets: string[] = [];
    const params: unknown[] = [];

    if (data.icaoType !== undefined)        { sets.push('icao_type = ?');         params.push(data.icaoType); }
    if (data.name !== undefined)            { sets.push('name = ?');              params.push(data.name); }
    if (data.registration !== undefined)    { sets.push('registration = ?');      params.push(data.registration); }
    if (data.airline !== undefined)          { sets.push('airline = ?');           params.push(data.airline); }
    if (data.rangeNm !== undefined)         { sets.push('range_nm = ?');          params.push(data.rangeNm); }
    if (data.cruiseSpeed !== undefined)     { sets.push('cruise_speed = ?');      params.push(data.cruiseSpeed); }
    if (data.paxCapacity !== undefined)     { sets.push('pax_capacity = ?');      params.push(data.paxCapacity); }
    if (data.cargoCapacityLbs !== undefined){ sets.push('cargo_capacity_lbs = ?');params.push(data.cargoCapacityLbs); }
    if (data.baseIcao !== undefined)        { sets.push('base_icao = ?');         params.push(data.baseIcao); }
    if (data.locationIcao !== undefined)    { sets.push('location_icao = ?');     params.push(data.locationIcao); }
    if (data.remarks !== undefined)         { sets.push('remarks = ?');           params.push(data.remarks); }

    // Status syncs is_active
    if (data.status !== undefined && VALID_STATUSES.has(data.status)) {
      sets.push('status = ?');
      params.push(data.status);
      const isActive = data.status === 'active' || data.status === 'stored' ? 1 : 0;
      sets.push('is_active = ?');
      params.push(isActive);
    }

    if (sets.length === 0) return this.findById(id);

    sets.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    getDb().prepare(`UPDATE fleet SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return this.findById(id);
  }

  delete(id: number): boolean {
    const result = getDb().prepare('DELETE FROM fleet WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // ── Mapper ──────────────────────────────────────────────────

  private toFleetAircraft(row: FleetRow): FleetAircraft {
    return {
      id: row.id,
      icaoType: row.icao_type,
      name: row.name,
      registration: row.registration,
      airline: row.airline,
      rangeNm: row.range_nm,
      cruiseSpeed: row.cruise_speed,
      paxCapacity: row.pax_capacity,
      cargoCapacityLbs: row.cargo_capacity_lbs,
      isActive: row.is_active === 1,
      status: (row.status ?? 'active') as FleetStatus,
      baseIcao: row.base_icao,
      locationIcao: row.location_icao,
      remarks: row.remarks,
      updatedAt: row.updated_at,
    };
  }
}
