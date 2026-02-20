import { getDb } from '../db/index.js';
import type {
  Airport,
  FleetAircraft,
  FleetStatus,
  ScheduleListItem,
  BidWithDetails,
  ActiveBidEntry,
  DashboardStats,
  CharterType,
  CreateCharterRequest,
  CreateCharterResponse,
} from '@acars/shared';

// ── Raw DB row types ─────────────────────────────────────────────

interface AirportRow {
  id: number;
  icao: string;
  name: string;
  city: string;
  state: string;
  country: string;
  lat: number;
  lon: number;
  elevation: number;
  timezone: string;
}

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

interface ScheduleRow {
  id: number;
  flight_number: string;
  dep_icao: string;
  arr_icao: string;
  aircraft_type: string;
  dep_time: string;
  arr_time: string;
  distance_nm: number;
  flight_time_min: number;
  days_of_week: string;
  is_active: number;
  charter_type: string | null;
  dep_name: string;
  arr_name: string;
  bid_count: number;
  has_bid: number;
}

interface BidRow {
  id: number;
  user_id: number;
  schedule_id: number;
  created_at: string;
  flight_number: string;
  dep_icao: string;
  arr_icao: string;
  dep_name: string;
  arr_name: string;
  aircraft_type: string;
  dep_time: string;
  arr_time: string;
  distance_nm: number;
  flight_time_min: number;
  days_of_week: string;
  charter_type: string | null;
}

interface AllBidRow extends BidRow {
  pilot_callsign: string;
  pilot_first_name: string;
  pilot_last_name: string;
}

// ── Filters ──────────────────────────────────────────────────────

export interface ScheduleFilters {
  depIcao?: string;
  arrIcao?: string;
  aircraftType?: string;
  search?: string;
}

// ── Service ──────────────────────────────────────────────────────

export class ScheduleService {

  // ── Airports ─────────────────────────────────────────────────

  findAllAirports(): Airport[] {
    const rows = getDb()
      .prepare('SELECT * FROM airports ORDER BY icao')
      .all() as AirportRow[];
    return rows.map(this.toAirport);
  }

  // ── Fleet ────────────────────────────────────────────────────

  findAllFleet(): FleetAircraft[] {
    const rows = getDb()
      .prepare('SELECT * FROM fleet WHERE is_active = 1 ORDER BY icao_type, registration')
      .all() as FleetRow[];
    return rows.map(this.toFleetAircraft);
  }

  findDistinctAircraftTypes(): string[] {
    const rows = getDb()
      .prepare('SELECT DISTINCT icao_type FROM fleet WHERE is_active = 1 ORDER BY icao_type')
      .all() as { icao_type: string }[];
    return rows.map(r => r.icao_type);
  }

  // ── Stats ─────────────────────────────────────────────────────

  getDashboardStats(): DashboardStats {
    const db = getDb();
    const totalSchedules = (db.prepare('SELECT COUNT(*) as c FROM scheduled_flights WHERE is_active = 1').get() as { c: number }).c;
    const totalPilots = (db.prepare('SELECT COUNT(*) as c FROM users WHERE is_active = 1').get() as { c: number }).c;
    const totalFleet = (db.prepare('SELECT COUNT(*) as c FROM fleet WHERE is_active = 1').get() as { c: number }).c;
    const totalHubs = (db.prepare('SELECT COUNT(DISTINCT dep_icao) as c FROM scheduled_flights WHERE is_active = 1').get() as { c: number }).c;
    return { totalSchedules, totalPilots, totalFleet, totalHubs };
  }

  // ── Schedules ────────────────────────────────────────────────

  findSchedules(filters: ScheduleFilters, userId?: number): ScheduleListItem[] {
    const conditions: string[] = ['sf.is_active = 1'];
    const params: unknown[] = [];

    if (filters.depIcao) {
      conditions.push('sf.dep_icao = ?');
      params.push(filters.depIcao);
    }
    if (filters.arrIcao) {
      conditions.push('sf.arr_icao = ?');
      params.push(filters.arrIcao);
    }
    if (filters.aircraftType) {
      conditions.push('sf.aircraft_type = ?');
      params.push(filters.aircraftType);
    }
    if (filters.search) {
      conditions.push('(sf.flight_number LIKE ? OR dep.icao LIKE ? OR arr.icao LIKE ? OR dep.city LIKE ? OR arr.city LIKE ?)');
      const term = `%${filters.search}%`;
      params.push(term, term, term, term, term);
    }

    const userIdParam = userId ?? 0;

    const sql = `
      SELECT
        sf.*,
        dep.name  AS dep_name,
        arr.name  AS arr_name,
        (SELECT COUNT(*) FROM active_bids ab WHERE ab.schedule_id = sf.id) AS bid_count,
        (SELECT COUNT(*) FROM active_bids ab WHERE ab.schedule_id = sf.id AND ab.user_id = ?) AS has_bid
      FROM scheduled_flights sf
      JOIN airports dep ON dep.icao = sf.dep_icao
      JOIN airports arr ON arr.icao = sf.arr_icao
      WHERE ${conditions.join(' AND ')}
      ORDER BY sf.flight_number
    `;

    const rows = getDb()
      .prepare(sql)
      .all(userIdParam, ...params) as ScheduleRow[];

    return rows.map(this.toScheduleListItem);
  }

  findScheduleById(id: number, userId?: number): ScheduleListItem | undefined {
    const userIdParam = userId ?? 0;

    const row = getDb().prepare(`
      SELECT
        sf.*,
        dep.name  AS dep_name,
        arr.name  AS arr_name,
        (SELECT COUNT(*) FROM active_bids ab WHERE ab.schedule_id = sf.id) AS bid_count,
        (SELECT COUNT(*) FROM active_bids ab WHERE ab.schedule_id = sf.id AND ab.user_id = ?) AS has_bid
      FROM scheduled_flights sf
      JOIN airports dep ON dep.icao = sf.dep_icao
      JOIN airports arr ON arr.icao = sf.arr_icao
      WHERE sf.id = ?
    `).get(userIdParam, id) as ScheduleRow | undefined;

    return row ? this.toScheduleListItem(row) : undefined;
  }

  // ── Bids ─────────────────────────────────────────────────────

  placeBid(userId: number, scheduleId: number): BidWithDetails | null {
    const schedule = getDb()
      .prepare('SELECT id FROM scheduled_flights WHERE id = ? AND is_active = 1')
      .get(scheduleId);
    if (!schedule) return null;

    try {
      getDb().prepare(`
        INSERT INTO active_bids (user_id, schedule_id) VALUES (?, ?)
      `).run(userId, scheduleId);
    } catch (err: any) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return null;
      throw err;
    }

    return this.findBidByUserAndSchedule(userId, scheduleId);
  }

  removeBid(bidId: number, userId: number): boolean {
    const db = getDb();

    // Check if this bid is for a charter — if so, delete the schedule too
    const bid = db.prepare(
      'SELECT ab.schedule_id, sf.charter_type FROM active_bids ab JOIN scheduled_flights sf ON sf.id = ab.schedule_id WHERE ab.id = ? AND ab.user_id = ?'
    ).get(bidId, userId) as { schedule_id: number; charter_type: string | null } | undefined;

    if (!bid) return false;

    const result = db.prepare('DELETE FROM active_bids WHERE id = ? AND user_id = ?').run(bidId, userId);
    if (result.changes === 0) return false;

    // Charter flights are one-off — delete the schedule when the bid is removed
    if (bid.charter_type) {
      db.prepare('DELETE FROM scheduled_flights WHERE id = ?').run(bid.schedule_id);
    }

    return true;
  }

  findMyBids(userId: number): BidWithDetails[] {
    const rows = getDb().prepare(`
      SELECT
        ab.id, ab.user_id, ab.schedule_id, ab.created_at,
        sf.flight_number, sf.dep_icao, sf.arr_icao, sf.aircraft_type,
        sf.dep_time, sf.arr_time, sf.distance_nm, sf.flight_time_min, sf.days_of_week,
        sf.charter_type,
        dep.name AS dep_name,
        arr.name AS arr_name
      FROM active_bids ab
      JOIN scheduled_flights sf ON sf.id = ab.schedule_id
      JOIN airports dep ON dep.icao = sf.dep_icao
      JOIN airports arr ON arr.icao = sf.arr_icao
      WHERE ab.user_id = ?
      ORDER BY sf.flight_number
    `).all(userId) as BidRow[];

    return rows.map(this.toBidWithDetails);
  }

  findAllBids(): ActiveBidEntry[] {
    const rows = getDb().prepare(`
      SELECT
        ab.id, ab.user_id, ab.schedule_id, ab.created_at,
        sf.flight_number, sf.dep_icao, sf.arr_icao, sf.aircraft_type,
        sf.dep_time, sf.arr_time, sf.distance_nm, sf.flight_time_min, sf.days_of_week,
        sf.charter_type,
        dep.name AS dep_name,
        arr.name AS arr_name,
        u.callsign AS pilot_callsign,
        u.first_name AS pilot_first_name,
        u.last_name AS pilot_last_name
      FROM active_bids ab
      JOIN scheduled_flights sf ON sf.id = ab.schedule_id
      JOIN airports dep ON dep.icao = sf.dep_icao
      JOIN airports arr ON arr.icao = sf.arr_icao
      JOIN users u ON u.id = ab.user_id
      ORDER BY ab.created_at DESC
    `).all() as AllBidRow[];

    return rows.map(this.toActiveBidEntry);
  }

  // ── Charters ────────────────────────────────────────────────

  createCharter(userId: number, req: CreateCharterRequest): CreateCharterResponse | null {
    const db = getDb();

    // Validate airports exist
    const depAirport = db.prepare('SELECT * FROM airports WHERE icao = ?').get(req.depIcao) as AirportRow | undefined;
    const arrAirport = db.prepare('SELECT * FROM airports WHERE icao = ?').get(req.arrIcao) as AirportRow | undefined;
    if (!depAirport || !arrAirport) return null;
    if (req.depIcao === req.arrIcao) return null;

    // Get cruise speed for flight time estimation
    const fleetRow = db.prepare('SELECT cruise_speed FROM fleet WHERE icao_type = ? AND is_active = 1 LIMIT 1').get(req.aircraftType) as { cruise_speed: number } | undefined;
    if (!fleetRow) return null;

    // Calculate distance and flight time
    const distanceNm = haversineNm(depAirport.lat, depAirport.lon, arrAirport.lat, arrAirport.lon);
    const flightTimeMin = Math.round((distanceNm / fleetRow.cruise_speed) * 60);

    // Calculate arrival time from departure + duration
    const [depH, depM] = req.depTime.split(':').map(Number);
    const depTotalMin = depH * 60 + depM;
    const arrTotalMin = depTotalMin + flightTimeMin;
    const arrH = Math.floor(arrTotalMin / 60) % 24;
    const arrM = arrTotalMin % 60;
    const arrTime = `${String(arrH).padStart(2, '0')}:${String(arrM).padStart(2, '0')}`;

    // Insert schedule + bid in a transaction (charter number generated inside for atomicity)
    const insertSchedule = db.prepare(`
      INSERT INTO scheduled_flights (flight_number, dep_icao, arr_icao, aircraft_type, dep_time, arr_time, distance_nm, flight_time_min, days_of_week, is_active, charter_type, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, '1234567', 1, ?, ?)
    `);
    const insertBid = db.prepare('INSERT INTO active_bids (user_id, schedule_id) VALUES (?, ?)');

    const txn = db.transaction(() => {
      // Generate charter flight number inside transaction to prevent race conditions
      // Use CAST to numeric sort so SMC10 sorts after SMC9
      const lastCharter = db.prepare(
        "SELECT flight_number FROM scheduled_flights WHERE flight_number LIKE 'SMC%' ORDER BY CAST(SUBSTR(flight_number, 4) AS INTEGER) DESC LIMIT 1"
      ).get() as { flight_number: string } | undefined;
      const nextNum = lastCharter ? parseInt(lastCharter.flight_number.slice(3), 10) + 1 : 1;
      const flightNumber = `SMC${String(nextNum).padStart(3, '0')}`;

      const result = insertSchedule.run(
        flightNumber, req.depIcao, req.arrIcao, req.aircraftType,
        req.depTime, arrTime, distanceNm, flightTimeMin,
        req.charterType, userId
      );
      const scheduleId = result.lastInsertRowid as number;
      insertBid.run(userId, scheduleId);
      return scheduleId;
    });

    const scheduleId = txn();

    const schedule = this.findScheduleById(scheduleId, userId);
    const bid = this.findBidByUserAndSchedule(userId, scheduleId);
    if (!schedule || !bid) return null;

    return { schedule, bid };
  }

  // ── Private helpers ──────────────────────────────────────────

  private findBidByUserAndSchedule(userId: number, scheduleId: number): BidWithDetails | null {
    const row = getDb().prepare(`
      SELECT
        ab.id, ab.user_id, ab.schedule_id, ab.created_at,
        sf.flight_number, sf.dep_icao, sf.arr_icao, sf.aircraft_type,
        sf.dep_time, sf.arr_time, sf.distance_nm, sf.flight_time_min, sf.days_of_week,
        sf.charter_type,
        dep.name AS dep_name,
        arr.name AS arr_name
      FROM active_bids ab
      JOIN scheduled_flights sf ON sf.id = ab.schedule_id
      JOIN airports dep ON dep.icao = sf.dep_icao
      JOIN airports arr ON arr.icao = sf.arr_icao
      WHERE ab.user_id = ? AND ab.schedule_id = ?
    `).get(userId, scheduleId) as BidRow | undefined;

    return row ? this.toBidWithDetails(row) : null;
  }

  // ── Mappers ──────────────────────────────────────────────────

  private toAirport(row: AirportRow): Airport {
    return {
      id: row.id,
      icao: row.icao,
      name: row.name,
      city: row.city,
      state: row.state,
      country: row.country,
      lat: row.lat,
      lon: row.lon,
      elevation: row.elevation,
      timezone: row.timezone,
    };
  }

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

  private toScheduleListItem(row: ScheduleRow): ScheduleListItem {
    return {
      id: row.id,
      flightNumber: row.flight_number,
      depIcao: row.dep_icao,
      arrIcao: row.arr_icao,
      aircraftType: row.aircraft_type,
      depTime: row.dep_time,
      arrTime: row.arr_time,
      distanceNm: row.distance_nm,
      flightTimeMin: row.flight_time_min,
      daysOfWeek: row.days_of_week,
      isActive: row.is_active === 1,
      charterType: row.charter_type as CharterType | null,
      depName: row.dep_name,
      arrName: row.arr_name,
      bidCount: row.bid_count,
      hasBid: row.has_bid > 0,
    };
  }

  private toBidWithDetails(row: BidRow): BidWithDetails {
    return {
      id: row.id,
      userId: row.user_id,
      scheduleId: row.schedule_id,
      createdAt: row.created_at,
      flightNumber: row.flight_number,
      depIcao: row.dep_icao,
      arrIcao: row.arr_icao,
      depName: row.dep_name,
      arrName: row.arr_name,
      aircraftType: row.aircraft_type,
      depTime: row.dep_time,
      arrTime: row.arr_time,
      distanceNm: row.distance_nm,
      flightTimeMin: row.flight_time_min,
      daysOfWeek: row.days_of_week,
      charterType: row.charter_type as CharterType | null,
    };
  }

  private toActiveBidEntry(row: AllBidRow): ActiveBidEntry {
    return {
      id: row.id,
      userId: row.user_id,
      scheduleId: row.schedule_id,
      createdAt: row.created_at,
      flightNumber: row.flight_number,
      depIcao: row.dep_icao,
      arrIcao: row.arr_icao,
      depName: row.dep_name,
      arrName: row.arr_name,
      aircraftType: row.aircraft_type,
      depTime: row.dep_time,
      arrTime: row.arr_time,
      distanceNm: row.distance_nm,
      flightTimeMin: row.flight_time_min,
      daysOfWeek: row.days_of_week,
      charterType: row.charter_type as CharterType | null,
      pilotCallsign: row.pilot_callsign,
      pilotName: `${row.pilot_first_name} ${row.pilot_last_name}`,
    };
  }
}

// ── Haversine distance (nautical miles) ──────────────────────

function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065; // Earth radius in nautical miles
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}
