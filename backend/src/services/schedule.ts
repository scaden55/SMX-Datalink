import { getDb } from '../db/index.js';
import { haversineNm } from '../lib/geo.js';
import { randomFlightNumber, minRunwayForCategory } from './charter-generator.js';
import type {
  Airport,
  FleetAircraft,
  FleetForBidItem,
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
  is_hub: number;
  handler: string | null;
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
  aircraft_type: string | null;
  dep_time: string;
  arr_time: string;
  distance_nm: number;
  flight_time_min: number;
  days_of_week: string;
  is_active: number;
  charter_type: string | null;
  event_tag: string | null;
  expires_at: string | null;
  dep_name: string;
  arr_name: string;
  dep_lat: number | null;
  dep_lon: number | null;
  arr_lat: number | null;
  arr_lon: number | null;
  bid_count: number;
  has_bid: number;
  is_reserved: number;
  reserved_by_callsign: string | null;
  event_name: string | null;
  origin_handler: string | null;
  dest_handler: string | null;
  fare_code: string | null;
  cargo_remarks: string | null;
  group_class: string | null;
}

interface BidRow {
  id: number;
  user_id: number;
  schedule_id: number;
  aircraft_id: number | null;
  created_at: string;
  expires_at: string | null;
  flight_number: string;
  dep_icao: string;
  arr_icao: string;
  dep_name: string;
  arr_name: string;
  aircraft_type: string | null;
  dep_time: string;
  arr_time: string;
  distance_nm: number;
  flight_time_min: number;
  days_of_week: string;
  charter_type: string | null;
  event_tag: string | null;
  aircraft_registration: string | null;
  aircraft_name: string | null;
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
  charterType?: string;
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

  findFleetForBid(depIcao: string, userId: number): FleetForBidItem[] {
    const rows = getDb()
      .prepare(`
        SELECT f.* FROM fleet f
        WHERE f.status = 'active'
          AND NOT EXISTS (
            SELECT 1 FROM active_bids ab
            WHERE ab.aircraft_id = f.id
              AND ab.user_id != ?
              AND (ab.expires_at IS NULL OR ab.expires_at > datetime('now'))
          )
        ORDER BY f.icao_type, f.registration
      `)
      .all(userId) as FleetRow[];

    return rows.map(row => {
      const aircraft = this.toFleetAircraft(row);
      const effectiveLocation = row.location_icao ?? row.base_icao;
      const atDeparture = effectiveLocation === depIcao;
      return { ...aircraft, atDeparture };
    });
  }

  // ── Stats ─────────────────────────────────────────────────────

  getDashboardStats(): DashboardStats {
    const db = getDb();
    const totalSchedules = (db.prepare('SELECT COUNT(*) as c FROM scheduled_flights WHERE is_active = 1').get() as { c: number }).c;
    const totalPilots = (db.prepare('SELECT COUNT(*) as c FROM users WHERE is_active = 1').get() as { c: number }).c;
    const totalFleet = (db.prepare('SELECT COUNT(*) as c FROM fleet WHERE is_active = 1').get() as { c: number }).c;
    const totalHubs = (db.prepare('SELECT COUNT(DISTINCT dep_icao) as c FROM scheduled_flights WHERE is_active = 1').get() as { c: number }).c;

    const activeFlights = (db.prepare('SELECT COUNT(*) as c FROM active_bids').get() as { c: number }).c;
    const pilotsOnline = (db.prepare('SELECT COUNT(DISTINCT user_id) as c FROM active_bids').get() as { c: number }).c;

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const flightsThisMonth = (db.prepare('SELECT COUNT(*) as c FROM logbook WHERE created_at >= ?').get(monthStart) as { c: number }).c;

    const totalHoursRow = (db.prepare('SELECT COALESCE(SUM(flight_time_min), 0) as m FROM logbook').get() as { m: number });
    const totalHours = Math.round(totalHoursRow.m / 60);

    return { totalSchedules, totalPilots, totalFleet, totalHubs, activeFlights, pilotsOnline, flightsThisMonth, totalHours };
  }

  // ── Schedules ────────────────────────────────────────────────

  findSchedules(filters: ScheduleFilters, userId?: number): ScheduleListItem[] {
    const conditions: string[] = ['sf.is_active = 1'];
    const params: unknown[] = [];

    // Exclude expired generated/event charters
    conditions.push("(sf.expires_at IS NULL OR sf.expires_at > datetime('now'))");

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
    if (filters.charterType) {
      if (filters.charterType === 'custom') {
        conditions.push("(sf.charter_type IN ('reposition','cargo','passenger'))");
      } else {
        conditions.push('sf.charter_type = ?');
        params.push(filters.charterType);
      }
    }
    if (filters.search) {
      conditions.push('(sf.flight_number LIKE ? OR sf.dep_icao LIKE ? OR sf.arr_icao LIKE ? OR dep.city LIKE ? OR arr.city LIKE ? OR oa_dep.municipality LIKE ? OR oa_arr.municipality LIKE ?)');
      const term = `%${filters.search}%`;
      params.push(term, term, term, term, term, term, term);
    }

    const userIdParam = userId ?? 0;

    const sql = `
      SELECT
        sf.*,
        COALESCE(dep.name, oa_dep.name) AS dep_name,
        COALESCE(arr.name, oa_arr.name) AS arr_name,
        COALESCE(dep.lat, oa_dep.latitude_deg) AS dep_lat,
        COALESCE(dep.lon, oa_dep.longitude_deg) AS dep_lon,
        COALESCE(arr.lat, oa_arr.latitude_deg) AS arr_lat,
        COALESCE(arr.lon, oa_arr.longitude_deg) AS arr_lon,
        (SELECT COUNT(*) FROM active_bids ab WHERE ab.schedule_id = sf.id AND (ab.expires_at IS NULL OR ab.expires_at > datetime('now'))) AS bid_count,
        (SELECT COUNT(*) FROM active_bids ab WHERE ab.schedule_id = sf.id AND ab.user_id = ? AND (ab.expires_at IS NULL OR ab.expires_at > datetime('now'))) AS has_bid,
        (SELECT COUNT(*) FROM active_bids ab WHERE ab.schedule_id = sf.id AND ab.user_id != ? AND (ab.expires_at IS NULL OR ab.expires_at > datetime('now'))) AS is_reserved,
        (SELECT u.callsign FROM active_bids ab JOIN users u ON u.id = ab.user_id WHERE ab.schedule_id = sf.id AND ab.user_id != ? AND (ab.expires_at IS NULL OR ab.expires_at > datetime('now')) LIMIT 1) AS reserved_by_callsign,
        ve.name AS event_name
      FROM scheduled_flights sf
      LEFT JOIN airports dep ON dep.icao = sf.dep_icao
      LEFT JOIN airports arr ON arr.icao = sf.arr_icao
      LEFT JOIN oa_airports oa_dep ON oa_dep.ident = sf.dep_icao
      LEFT JOIN oa_airports oa_arr ON oa_arr.ident = sf.arr_icao
      LEFT JOIN vatsim_events ve ON ve.id = sf.vatsim_event_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY sf.flight_number
    `;

    const rows = getDb()
      .prepare(sql)
      .all(userIdParam, userIdParam, userIdParam, ...params) as ScheduleRow[];

    return rows.map(this.toScheduleListItem);
  }

  findScheduleById(id: number, userId?: number): ScheduleListItem | undefined {
    const userIdParam = userId ?? 0;

    const row = getDb().prepare(`
      SELECT
        sf.*,
        COALESCE(dep.name, oa_dep.name) AS dep_name,
        COALESCE(arr.name, oa_arr.name) AS arr_name,
        COALESCE(dep.lat, oa_dep.latitude_deg) AS dep_lat,
        COALESCE(dep.lon, oa_dep.longitude_deg) AS dep_lon,
        COALESCE(arr.lat, oa_arr.latitude_deg) AS arr_lat,
        COALESCE(arr.lon, oa_arr.longitude_deg) AS arr_lon,
        (SELECT COUNT(*) FROM active_bids ab WHERE ab.schedule_id = sf.id AND (ab.expires_at IS NULL OR ab.expires_at > datetime('now'))) AS bid_count,
        (SELECT COUNT(*) FROM active_bids ab WHERE ab.schedule_id = sf.id AND ab.user_id = ? AND (ab.expires_at IS NULL OR ab.expires_at > datetime('now'))) AS has_bid,
        (SELECT COUNT(*) FROM active_bids ab WHERE ab.schedule_id = sf.id AND ab.user_id != ? AND (ab.expires_at IS NULL OR ab.expires_at > datetime('now'))) AS is_reserved,
        (SELECT u.callsign FROM active_bids ab JOIN users u ON u.id = ab.user_id WHERE ab.schedule_id = sf.id AND ab.user_id != ? AND (ab.expires_at IS NULL OR ab.expires_at > datetime('now')) LIMIT 1) AS reserved_by_callsign,
        ve.name AS event_name
      FROM scheduled_flights sf
      LEFT JOIN airports dep ON dep.icao = sf.dep_icao
      LEFT JOIN airports arr ON arr.icao = sf.arr_icao
      LEFT JOIN oa_airports oa_dep ON oa_dep.ident = sf.dep_icao
      LEFT JOIN oa_airports oa_arr ON oa_arr.ident = sf.arr_icao
      LEFT JOIN vatsim_events ve ON ve.id = sf.vatsim_event_id
      WHERE sf.id = ?
    `).get(userIdParam, userIdParam, userIdParam, id) as ScheduleRow | undefined;

    return row ? this.toScheduleListItem(row) : undefined;
  }

  // ── Bids ─────────────────────────────────────────────────────

  placeBid(userId: number, scheduleId: number, aircraftId: number): { bid: BidWithDetails; warnings: string[] } | { error: string } {
    const db = getDb();

    // 1. Validate schedule exists
    const schedule = db.prepare(`
      SELECT sf.id, sf.dep_icao, sf.arr_icao, sf.distance_nm, sf.charter_type
      FROM scheduled_flights sf WHERE sf.id = ? AND sf.is_active = 1
    `).get(scheduleId) as { id: number; dep_icao: string; arr_icao: string; distance_nm: number; charter_type: string | null } | undefined;
    if (!schedule) return { error: 'Schedule not found or inactive' };

    // 2. Validate aircraft exists and is active
    const aircraft = db.prepare(`
      SELECT id, icao_type, registration, name, range_nm, is_cargo, cat,
             COALESCE(location_icao, base_icao) AS effective_location
      FROM fleet WHERE id = ? AND status = 'active'
    `).get(aircraftId) as {
      id: number; icao_type: string; registration: string; name: string;
      range_nm: number; is_cargo: number; cat: string | null; effective_location: string | null;
    } | undefined;
    if (!aircraft) return { error: 'Aircraft is not active' };

    // 3. Check schedule exclusivity — only one pilot per flight
    const existingScheduleBid = db.prepare(`
      SELECT ab.id, u.callsign FROM active_bids ab
      JOIN users u ON u.id = ab.user_id
      WHERE ab.schedule_id = ? AND ab.user_id != ?
        AND (ab.expires_at IS NULL OR ab.expires_at > datetime('now'))
    `).get(scheduleId, userId) as { id: number; callsign: string } | undefined;
    if (existingScheduleBid) {
      return { error: `This flight is already reserved by ${existingScheduleBid.callsign}` };
    }

    // 4. Check aircraft exclusivity — only one pilot per aircraft
    const existingAircraftBid = db.prepare(`
      SELECT ab.id, u.callsign, sf.flight_number FROM active_bids ab
      JOIN users u ON u.id = ab.user_id
      JOIN scheduled_flights sf ON sf.id = ab.schedule_id
      WHERE ab.aircraft_id = ? AND ab.user_id != ?
        AND (ab.expires_at IS NULL OR ab.expires_at > datetime('now'))
    `).get(aircraftId, userId) as { id: number; callsign: string; flight_number: string } | undefined;
    if (existingAircraftBid) {
      return { error: `Aircraft is reserved by ${existingAircraftBid.callsign} for flight ${existingAircraftBid.flight_number}` };
    }

    // 5. Soft warnings (location mismatch is a warning, not a block — enforced at flight start)
    const warnings: string[] = [];

    if (aircraft.effective_location && aircraft.effective_location !== schedule.dep_icao) {
      warnings.push(`Aircraft ${aircraft.registration} is at ${aircraft.effective_location}, not ${schedule.dep_icao} — must be repositioned before starting flight`);
    }

    // Range warning: aircraft range * 0.9 < route distance
    if (aircraft.range_nm > 0 && aircraft.range_nm * 0.9 < schedule.distance_nm) {
      warnings.push(`Range warning: ${aircraft.registration} range (${aircraft.range_nm} nm) may be insufficient for ${schedule.distance_nm} nm route`);
    }

    // Runway warning: check destination longest runway vs aircraft category
    const minRwy = minRunwayForCategory(aircraft.cat);
    const longestRunway = db.prepare(`
      SELECT MAX(rw.length_ft) as max_len
      FROM oa_runways rw
      WHERE rw.airport_ident = ? AND rw.closed = 0
    `).get(schedule.arr_icao) as { max_len: number | null } | undefined;

    if (longestRunway?.max_len != null && longestRunway.max_len < minRwy) {
      warnings.push(`Runway warning: ${schedule.arr_icao} longest runway (${longestRunway.max_len} ft) may be short for ${aircraft.icao_type} (needs ${minRwy} ft)`);
    }

    // Type mismatch: cargo aircraft on pax charter, or pax aircraft on cargo charter (skip for reposition)
    if (schedule.charter_type && schedule.charter_type !== 'reposition') {
      const isCargo = aircraft.is_cargo === 1;
      if (schedule.charter_type === 'cargo' && !isCargo) {
        warnings.push(`Type mismatch: ${aircraft.registration} is a passenger aircraft on a cargo charter`);
      }
      if (schedule.charter_type === 'passenger' && isCargo) {
        warnings.push(`Type mismatch: ${aircraft.registration} is a cargo aircraft on a passenger charter`);
      }
    }

    // 6. Insert bid
    try {
      db.prepare("INSERT INTO active_bids (user_id, schedule_id, aircraft_id, expires_at) VALUES (?, ?, ?, datetime('now', '+24 hours'))").run(userId, scheduleId, aircraftId);
    } catch (err: any) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return { error: 'Bid already exists for this schedule' };
      throw err;
    }

    const bid = this.findBidByUserAndSchedule(userId, scheduleId);
    if (!bid) return { error: 'Failed to retrieve bid after insertion' };

    return { bid, warnings };
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

    // User-created charters are one-off — delete the schedule when the bid is removed.
    // Generated and event charters persist for other pilots to bid on.
    const userCreatedTypes = ['reposition', 'cargo', 'passenger'];
    if (bid.charter_type && userCreatedTypes.includes(bid.charter_type)) {
      db.prepare('DELETE FROM scheduled_flights WHERE id = ?').run(bid.schedule_id);
    }

    return true;
  }

  forceRemoveBid(bidId: number): { userId: number; flightNumber: string } | null {
    const db = getDb();

    const bid = db.prepare(
      'SELECT ab.user_id, ab.schedule_id, sf.flight_number, sf.charter_type FROM active_bids ab JOIN scheduled_flights sf ON sf.id = ab.schedule_id WHERE ab.id = ?'
    ).get(bidId) as { user_id: number; schedule_id: number; flight_number: string; charter_type: string | null } | undefined;

    if (!bid) return null;

    db.prepare('DELETE FROM active_bids WHERE id = ?').run(bidId);

    // User-created charters are one-off — delete the schedule when bid is removed
    const userCreatedTypes = ['reposition', 'cargo', 'passenger'];
    if (bid.charter_type && userCreatedTypes.includes(bid.charter_type)) {
      db.prepare('DELETE FROM scheduled_flights WHERE id = ?').run(bid.schedule_id);
    }

    return { userId: bid.user_id, flightNumber: bid.flight_number };
  }

  findMyBids(userId: number): BidWithDetails[] {
    const rows = getDb().prepare(`
      SELECT
        ab.id, ab.user_id, ab.schedule_id, ab.aircraft_id, ab.created_at, ab.expires_at,
        sf.flight_number, sf.dep_icao, sf.arr_icao, sf.aircraft_type,
        sf.dep_time, sf.arr_time, sf.distance_nm, sf.flight_time_min, sf.days_of_week,
        sf.charter_type, sf.event_tag,
        COALESCE(dep.name, oa_dep.name) AS dep_name,
        COALESCE(arr.name, oa_arr.name) AS arr_name,
        f.registration AS aircraft_registration,
        f.name AS aircraft_name
      FROM active_bids ab
      JOIN scheduled_flights sf ON sf.id = ab.schedule_id
      LEFT JOIN airports dep ON dep.icao = sf.dep_icao
      LEFT JOIN airports arr ON arr.icao = sf.arr_icao
      LEFT JOIN oa_airports oa_dep ON oa_dep.ident = sf.dep_icao
      LEFT JOIN oa_airports oa_arr ON oa_arr.ident = sf.arr_icao
      LEFT JOIN fleet f ON f.id = ab.aircraft_id
      WHERE ab.user_id = ?
      ORDER BY sf.flight_number
    `).all(userId) as BidRow[];

    return rows.map(this.toBidWithDetails);
  }

  findAllBids(): ActiveBidEntry[] {
    const rows = getDb().prepare(`
      SELECT
        ab.id, ab.user_id, ab.schedule_id, ab.aircraft_id, ab.created_at, ab.expires_at,
        sf.flight_number, sf.dep_icao, sf.arr_icao, sf.aircraft_type,
        sf.dep_time, sf.arr_time, sf.distance_nm, sf.flight_time_min, sf.days_of_week,
        sf.charter_type, sf.event_tag,
        COALESCE(dep.name, oa_dep.name) AS dep_name,
        COALESCE(arr.name, oa_arr.name) AS arr_name,
        f.registration AS aircraft_registration,
        f.name AS aircraft_name,
        u.callsign AS pilot_callsign,
        u.first_name AS pilot_first_name,
        u.last_name AS pilot_last_name
      FROM active_bids ab
      JOIN scheduled_flights sf ON sf.id = ab.schedule_id
      LEFT JOIN airports dep ON dep.icao = sf.dep_icao
      LEFT JOIN airports arr ON arr.icao = sf.arr_icao
      LEFT JOIN oa_airports oa_dep ON oa_dep.ident = sf.dep_icao
      LEFT JOIN oa_airports oa_arr ON oa_arr.ident = sf.arr_icao
      LEFT JOIN fleet f ON f.id = ab.aircraft_id
      JOIN users u ON u.id = ab.user_id
      ORDER BY ab.created_at DESC
    `).all() as AllBidRow[];

    return rows.map(this.toActiveBidEntry);
  }

  // ── Charters ────────────────────────────────────────────────

  createCharter(userId: number, req: CreateCharterRequest): CreateCharterResponse | null {
    const db = getDb();

    // Validate airports exist (check both legacy hubs and global oa_airports)
    const lookupCoords = (icao: string): { lat: number; lon: number } | null => {
      const legacy = db.prepare('SELECT lat, lon FROM airports WHERE icao = ?').get(icao) as { lat: number; lon: number } | undefined;
      if (legacy) return legacy;
      const oa = db.prepare('SELECT latitude_deg AS lat, longitude_deg AS lon FROM oa_airports WHERE ident = ? AND latitude_deg IS NOT NULL').get(icao) as { lat: number; lon: number } | undefined;
      return oa ?? null;
    };

    const depCoords = lookupCoords(req.depIcao);
    const arrCoords = lookupCoords(req.arrIcao);
    if (!depCoords || !arrCoords) return null;
    if (req.depIcao === req.arrIcao) return null;

    // Default 450 kts cruise for charters without a specific aircraft
    const defaultCruiseKts = 450;
    const distanceNm = haversineNm(depCoords.lat, depCoords.lon, arrCoords.lat, arrCoords.lon);
    const flightTimeMin = Math.round((distanceNm / defaultCruiseKts) * 60);

    // Calculate arrival time from departure + duration
    const [depH, depM] = req.depTime.split(':').map(Number);
    const depTotalMin = depH * 60 + depM;
    const arrTotalMin = depTotalMin + flightTimeMin;
    const arrH = Math.floor(arrTotalMin / 60) % 24;
    const arrM = arrTotalMin % 60;
    const arrTime = `${String(arrH).padStart(2, '0')}:${String(arrM).padStart(2, '0')}`;

    // Insert schedule (no auto-bid — pilot bids separately with aircraft selection)
    const insertSchedule = db.prepare(`
      INSERT INTO scheduled_flights (flight_number, dep_icao, arr_icao, aircraft_type, dep_time, arr_time, distance_nm, flight_time_min, days_of_week, is_active, charter_type, created_by)
      VALUES (?, ?, ?, NULL, ?, ?, ?, ?, '1234567', 1, ?, ?)
    `);

    const txn = db.transaction(() => {
      const flightNumber = randomFlightNumber(db);
      const result = insertSchedule.run(
        flightNumber, req.depIcao, req.arrIcao,
        req.depTime, arrTime, distanceNm, flightTimeMin,
        req.charterType, userId
      );
      return result.lastInsertRowid as number;
    });

    const scheduleId = txn();
    const schedule = this.findScheduleById(scheduleId, userId);
    if (!schedule) return null;

    return { schedule };
  }

  // ── Private helpers ──────────────────────────────────────────

  private findBidByUserAndSchedule(userId: number, scheduleId: number): BidWithDetails | null {
    const row = getDb().prepare(`
      SELECT
        ab.id, ab.user_id, ab.schedule_id, ab.aircraft_id, ab.created_at, ab.expires_at,
        sf.flight_number, sf.dep_icao, sf.arr_icao, sf.aircraft_type,
        sf.dep_time, sf.arr_time, sf.distance_nm, sf.flight_time_min, sf.days_of_week,
        sf.charter_type, sf.event_tag,
        COALESCE(dep.name, oa_dep.name) AS dep_name,
        COALESCE(arr.name, oa_arr.name) AS arr_name,
        f.registration AS aircraft_registration,
        f.name AS aircraft_name
      FROM active_bids ab
      JOIN scheduled_flights sf ON sf.id = ab.schedule_id
      LEFT JOIN airports dep ON dep.icao = sf.dep_icao
      LEFT JOIN airports arr ON arr.icao = sf.arr_icao
      LEFT JOIN oa_airports oa_dep ON oa_dep.ident = sf.dep_icao
      LEFT JOIN oa_airports oa_arr ON oa_arr.ident = sf.arr_icao
      LEFT JOIN fleet f ON f.id = ab.aircraft_id
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
      isHub: row.is_hub === 1,
      handler: row.handler,
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
      // Bid reservation info (null — schedule service doesn't join bid data for fleet)
      reservedByPilot: null,
      bidFlightPhase: null,
    };
  }

  private toScheduleListItem(row: ScheduleRow): ScheduleListItem {
    return {
      id: row.id,
      flightNumber: row.flight_number,
      depIcao: row.dep_icao,
      arrIcao: row.arr_icao,
      aircraftType: row.aircraft_type ?? null,
      depTime: row.dep_time,
      arrTime: row.arr_time,
      distanceNm: row.distance_nm,
      flightTimeMin: row.flight_time_min,
      daysOfWeek: row.days_of_week,
      isActive: row.is_active === 1,
      charterType: row.charter_type as CharterType | null,
      eventTag: row.event_tag,
      expiresAt: row.expires_at,
      depLat: row.dep_lat,
      depLon: row.dep_lon,
      arrLat: row.arr_lat,
      arrLon: row.arr_lon,
      depName: row.dep_name,
      arrName: row.arr_name,
      bidCount: row.bid_count,
      hasBid: row.has_bid > 0,
      isReserved: row.is_reserved > 0,
      reservedByCallsign: row.reserved_by_callsign ?? null,
      eventName: row.event_name ?? null,
      originHandler: row.origin_handler ?? null,
      destHandler: row.dest_handler ?? null,
      fareCode: row.fare_code ?? null,
      cargoRemarks: row.cargo_remarks ?? null,
      groupClass: row.group_class ?? null,
    };
  }

  private toBidWithDetails(row: BidRow): BidWithDetails {
    return {
      id: row.id,
      userId: row.user_id,
      scheduleId: row.schedule_id,
      aircraftId: row.aircraft_id,
      createdAt: row.created_at,
      expiresAt: row.expires_at ?? null,
      flightNumber: row.flight_number,
      depIcao: row.dep_icao,
      arrIcao: row.arr_icao,
      depName: row.dep_name,
      arrName: row.arr_name,
      aircraftType: row.aircraft_type ?? null,
      depTime: row.dep_time,
      arrTime: row.arr_time,
      distanceNm: row.distance_nm,
      flightTimeMin: row.flight_time_min,
      daysOfWeek: row.days_of_week,
      charterType: row.charter_type as CharterType | null,
      eventTag: row.event_tag,
      aircraftRegistration: row.aircraft_registration ?? null,
      aircraftName: row.aircraft_name ?? null,
    };
  }

  private toActiveBidEntry(row: AllBidRow): ActiveBidEntry {
    return {
      id: row.id,
      userId: row.user_id,
      scheduleId: row.schedule_id,
      aircraftId: row.aircraft_id,
      createdAt: row.created_at,
      expiresAt: row.expires_at ?? null,
      flightNumber: row.flight_number,
      depIcao: row.dep_icao,
      arrIcao: row.arr_icao,
      depName: row.dep_name,
      arrName: row.arr_name,
      aircraftType: row.aircraft_type ?? null,
      depTime: row.dep_time,
      arrTime: row.arr_time,
      distanceNm: row.distance_nm,
      flightTimeMin: row.flight_time_min,
      daysOfWeek: row.days_of_week,
      charterType: row.charter_type as CharterType | null,
      eventTag: row.event_tag,
      aircraftRegistration: row.aircraft_registration ?? null,
      aircraftName: row.aircraft_name ?? null,
      pilotCallsign: row.pilot_callsign,
      pilotName: `${row.pilot_first_name} ${row.pilot_last_name}`,
    };
  }
}

