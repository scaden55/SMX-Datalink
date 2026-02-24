import { getDb } from '../db/index.js';
import type {
  FleetAircraft,
  FleetStatus,
  CreateFleetAircraftRequest,
  UpdateFleetAircraftRequest,
} from '@acars/shared';
import type { FleetUtilizationQueryRow } from '../types/db-rows.js';

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
  // Extended specs (from migration 007)
  oew_lbs: number | null;
  mzfw_lbs: number | null;
  mtow_lbs: number | null;
  mlw_lbs: number | null;
  max_fuel_lbs: number | null;
  engines: string | null;
  ceiling_ft: number | null;
  iata_type: string | null;
  configuration: string | null;
  is_cargo: number | null;
  equip_code: string | null;
  transponder_code: string | null;
  pbn: string | null;
  cat: string | null;
  selcal: string | null;
  hex_code: string | null;
}

// ── Filters ─────────────────────────────────────────────────────

export interface FleetFilters {
  icaoType?: string;
  status?: FleetStatus;
  search?: string;
}

// ── Service ─────────────────────────────────────────────────────

const VALID_STATUSES = new Set<FleetStatus>(['active', 'stored', 'retired', 'maintenance']);

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
      INSERT INTO fleet (
        icao_type, name, registration, airline, range_nm, cruise_speed, pax_capacity, cargo_capacity_lbs,
        is_active, status, base_icao, location_icao, remarks, updated_at,
        oew_lbs, mzfw_lbs, mtow_lbs, mlw_lbs, max_fuel_lbs,
        engines, ceiling_ft, iata_type, configuration, is_cargo,
        equip_code, transponder_code, pbn, cat, selcal, hex_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      data.oewLbs ?? null,
      data.mzfwLbs ?? null,
      data.mtowLbs ?? null,
      data.mlwLbs ?? null,
      data.maxFuelLbs ?? null,
      data.engines ?? null,
      data.ceilingFt ?? null,
      data.iataType ?? null,
      data.configuration ?? null,
      data.isCargo ? 1 : 0,
      data.equipCode ?? null,
      data.transponderCode ?? null,
      data.pbn ?? null,
      data.cat ?? null,
      data.selcal ?? null,
      data.hexCode ?? null,
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

    // Extended specs
    if (data.oewLbs !== undefined)          { sets.push('oew_lbs = ?');           params.push(data.oewLbs); }
    if (data.mzfwLbs !== undefined)         { sets.push('mzfw_lbs = ?');          params.push(data.mzfwLbs); }
    if (data.mtowLbs !== undefined)         { sets.push('mtow_lbs = ?');          params.push(data.mtowLbs); }
    if (data.mlwLbs !== undefined)          { sets.push('mlw_lbs = ?');           params.push(data.mlwLbs); }
    if (data.maxFuelLbs !== undefined)      { sets.push('max_fuel_lbs = ?');      params.push(data.maxFuelLbs); }
    if (data.engines !== undefined)         { sets.push('engines = ?');           params.push(data.engines); }
    if (data.ceilingFt !== undefined)       { sets.push('ceiling_ft = ?');        params.push(data.ceilingFt); }
    if (data.iataType !== undefined)        { sets.push('iata_type = ?');         params.push(data.iataType); }
    if (data.configuration !== undefined)   { sets.push('configuration = ?');     params.push(data.configuration); }
    if (data.isCargo !== undefined)         { sets.push('is_cargo = ?');          params.push(data.isCargo ? 1 : 0); }
    if (data.equipCode !== undefined)       { sets.push('equip_code = ?');        params.push(data.equipCode); }
    if (data.transponderCode !== undefined) { sets.push('transponder_code = ?');  params.push(data.transponderCode); }
    if (data.pbn !== undefined)             { sets.push('pbn = ?');               params.push(data.pbn); }
    if (data.cat !== undefined)             { sets.push('cat = ?');               params.push(data.cat); }
    if (data.selcal !== undefined)          { sets.push('selcal = ?');            params.push(data.selcal); }
    if (data.hexCode !== undefined)         { sets.push('hex_code = ?');          params.push(data.hexCode); }

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

  getUtilizationStats(registration: string): {
    totalFlights: number;
    totalHours: number;
    lastFlightDate: string | null;
    avgScore: number | null;
    avgLandingRate: number | null;
  } {
    const row = getDb().prepare(`
      SELECT
        COUNT(*) AS total_flights,
        COALESCE(SUM(flight_time_min), 0) AS total_hours_min,
        MAX(actual_arr) AS last_flight,
        AVG(score) AS avg_score,
        AVG(landing_rate_fpm) AS avg_landing_rate
      FROM logbook
      WHERE aircraft_registration = ? AND status IN ('approved')
    `).get(registration) as FleetUtilizationQueryRow;

    return {
      totalFlights: row.total_flights,
      totalHours: Math.round((row.total_hours_min / 60) * 10) / 10,
      lastFlightDate: row.last_flight,
      avgScore: row.avg_score != null ? Math.round(row.avg_score) : null,
      avgLandingRate: row.avg_landing_rate != null ? Math.round(row.avg_landing_rate) : null,
    };
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
      // Extended specs
      oewLbs: row.oew_lbs,
      mzfwLbs: row.mzfw_lbs,
      mtowLbs: row.mtow_lbs,
      mlwLbs: row.mlw_lbs,
      maxFuelLbs: row.max_fuel_lbs,
      engines: row.engines,
      ceilingFt: row.ceiling_ft,
      iataType: row.iata_type,
      configuration: row.configuration,
      isCargo: (row.is_cargo ?? 0) === 1,
      equipCode: row.equip_code,
      transponderCode: row.transponder_code,
      pbn: row.pbn,
      cat: row.cat,
      selcal: row.selcal,
      hexCode: row.hex_code,
    };
  }
}
