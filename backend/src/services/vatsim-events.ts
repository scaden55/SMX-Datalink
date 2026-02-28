import { getDb } from '../db/index.js';
import { haversineNm } from '../lib/geo.js';
import { currentMonth, minRunwayForCategory, randomFlightNumber } from './charter-generator.js';
import { logger } from '../lib/logger.js';
import type { CharterGenerationStatus, VatsimEventInfo } from '@acars/shared';

// ── VATSIM API types ──────────────────────────────────────────

interface VatsimApiEvent {
  id: number;
  type: string;
  name: string;
  link: string;
  organisers: { division: string; organisation: string }[];
  airports: { icao: string }[];
  routes: { departure: string; arrival: string; route: string }[];
  start_time: string;
  end_time: string;
  short_description: string;
  description: string;
}

interface VatsimApiResponse {
  data: VatsimApiEvent[];
}

// ── DB row types ──────────────────────────────────────────────

interface VatsimEventRow {
  id: number;
  name: string;
  event_type: string;
  start_time: string;
  end_time: string;
  airports: string;
  tag: string | null;
  description: string | null;
}

interface FleetTypeRow {
  icao_type: string;
  range_nm: number;
  cruise_speed: number;
  cat: string | null;
}

interface AirportRow {
  icao: string;
  lat: number;
  lon: number;
}

interface OaAirportRow {
  ident: string;
  latitude_deg: number;
  longitude_deg: number;
}

// ── Event tag mapping ─────────────────────────────────────────

const EVENT_TAGS: Record<string, string> = {
  'worldflight': 'WF',
  'friday night ops': 'FNO',
  'cross the pond': 'CTP',
  'real world ops': 'RWO',
  'fly-in': 'FI',
};

function deriveTag(eventName: string): string | null {
  const lower = eventName.toLowerCase();
  for (const [pattern, tag] of Object.entries(EVENT_TAGS)) {
    if (lower.includes(pattern)) return tag;
  }
  return null;
}

// ── Service ───────────────────────────────────────────────────

const VATSIM_EVENTS_URL = 'https://my.vatsim.net/api/v2/events/latest';

export class VatsimEventsService {

  /** Fetch events from VATSIM API and cache in local DB. */
  async pollEvents(): Promise<number> {
    try {
      const resp = await fetch(VATSIM_EVENTS_URL, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'SMX-ACARS/1.0' },
        signal: AbortSignal.timeout(15000),
      });

      if (!resp.ok) {
        logger.warn('VatsimEvents', `VATSIM events API returned ${resp.status}`);
        return 0;
      }

      const data = await resp.json() as VatsimApiResponse;
      if (!data.data || !Array.isArray(data.data)) {
        logger.warn('VatsimEvents', 'Unexpected VATSIM events API response shape');
        return 0;
      }

      const db = getDb();
      const upsert = db.prepare(`
        INSERT OR REPLACE INTO vatsim_events (id, name, event_type, start_time, end_time, airports, tag, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const txn = db.transaction(() => {
        let count = 0;
        for (const evt of data.data) {
          // Extract airport ICAOs from airports array + routes
          const icaos = new Set<string>();
          for (const a of (evt.airports ?? [])) {
            if (a.icao) icaos.add(a.icao.toUpperCase());
          }
          for (const r of (evt.routes ?? [])) {
            if (r.departure) icaos.add(r.departure.toUpperCase());
            if (r.arrival) icaos.add(r.arrival.toUpperCase());
          }

          const tag = deriveTag(evt.name);

          upsert.run(
            evt.id,
            evt.name,
            evt.type ?? 'event',
            evt.start_time,
            evt.end_time,
            JSON.stringify([...icaos]),
            tag,
            evt.short_description || evt.description || null,
          );
          count++;
        }
        return count;
      });

      const count = txn();
      logger.info('VatsimEvents', `Cached ${count} VATSIM events`);
      return count;
    } catch (err) {
      logger.error('VatsimEvents', 'Failed to poll VATSIM events', err);
      return 0;
    }
  }

  /** Create charter flights for upcoming VATSIM events that link to our fleet. */
  generateEventCharters(): number {
    const db = getDb();

    // Clean up old event charters (without active bids) before generating fresh ones
    db.prepare(`
      DELETE FROM scheduled_flights
      WHERE vatsim_event_id IS NOT NULL
        AND expires_at IS NOT NULL
        AND expires_at < datetime('now')
        AND id NOT IN (SELECT schedule_id FROM active_bids)
    `).run();

    // Get currently-active events: started by end of today, not yet ended
    // This covers single-day events (today) and multi-day events in progress
    const events = db.prepare(`
      SELECT id, name, event_type, start_time, end_time, airports, tag, description
      FROM vatsim_events
      WHERE date(start_time) <= date('now')
        AND end_time >= datetime('now')
    `).all() as VatsimEventRow[];

    if (events.length === 0) return 0;

    // Get fleet types for matching
    const fleetTypes = db.prepare(`
      SELECT DISTINCT icao_type, range_nm, cruise_speed, cat
      FROM fleet WHERE is_active = 1
    `).all() as FleetTypeRow[];

    if (fleetTypes.length === 0) return 0;

    // Load US hub airports
    const usHubs = db.prepare('SELECT icao, lat, lon FROM airports').all() as AirportRow[];

    const insertStmt = db.prepare(`
      INSERT INTO scheduled_flights
        (flight_number, dep_icao, arr_icao, aircraft_type, dep_time, arr_time, distance_nm, flight_time_min, days_of_week, is_active, flight_type, event_tag, vatsim_event_id, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, '1234567', 1, 'J', ?, ?, ?)
    `);

    // Check for existing event charters to avoid duplicates
    const existingCheck = db.prepare(
      'SELECT COUNT(*) as c FROM scheduled_flights WHERE vatsim_event_id = ?'
    );

    let totalCreated = 0;

    const txn = db.transaction(() => {
      for (const evt of events) {
        // Skip if we already have charters for this event
        const existing = existingCheck.get(evt.id) as { c: number };
        if (existing.c > 0) continue;

        const eventIcaos: string[] = JSON.parse(evt.airports);
        if (eventIcaos.length === 0) continue;

        // expires_at = event end_time (charters persist for the event's duration)
        const expiresAt = evt.end_time;

        // For each event airport, find reachable US hubs and create route pairs
        for (const eventIcao of eventIcaos) {
          // Look up event airport coordinates
          const eventApt = db.prepare(
            'SELECT ident, latitude_deg, longitude_deg FROM oa_airports WHERE ident = ? LIMIT 1'
          ).get(eventIcao) as OaAirportRow | undefined;

          if (!eventApt) continue;

          // Find fleet types that can reach this airport from a US hub
          for (const aircraft of fleetTypes) {
            const maxRange = Math.floor((aircraft.range_nm || 2000) * 0.9);
            const minRunway = minRunwayForCategory(aircraft.cat);

            // Verify event airport has a suitable runway for this aircraft
            const suitableRunway = db.prepare(
              "SELECT 1 FROM oa_runways WHERE airport_ident = ? AND length_ft >= ? AND closed = 0 AND surface IN ('ASP','CON','ASPH','PEM','BIT','ASPH-G','CONC','Asphalt','Concrete') LIMIT 1"
            ).get(eventIcao, minRunway);
            if (!suitableRunway) continue;

            // Find nearest US hub within range
            const reachableHubs = usHubs.filter(hub => {
              const dist = haversineNm(hub.lat, hub.lon, eventApt.latitude_deg, eventApt.longitude_deg);
              return dist <= maxRange && dist >= 50;
            });

            if (reachableHubs.length === 0) continue;

            // Pick a random reachable hub and create outbound route
            const hub = reachableHubs[Math.floor(Math.random() * reachableHubs.length)];
            const distanceNm = haversineNm(hub.lat, hub.lon, eventApt.latitude_deg, eventApt.longitude_deg);
            const flightTimeMin = Math.round((distanceNm / aircraft.cruise_speed) * 60);

            // Parse event start for departure time (2 hours before)
            const evtStart = new Date(evt.start_time);
            const depHour = (evtStart.getUTCHours() + 22) % 24; // 2h before start
            const depTime = `${String(depHour).padStart(2, '0')}:00`;
            const arrTotalMin = depHour * 60 + flightTimeMin;
            const arrH = Math.floor(arrTotalMin / 60) % 24;
            const arrM = arrTotalMin % 60;
            const arrTime = `${String(arrH).padStart(2, '0')}:${String(arrM).padStart(2, '0')}`;

            // Outbound: hub → event airport
            const outboundFN = randomFlightNumber(db, hub.icao, eventIcao);
            insertStmt.run(
              outboundFN, hub.icao, eventIcao, aircraft.icao_type,
              depTime, arrTime, distanceNm, flightTimeMin,
              evt.tag, evt.id, expiresAt,
            );
            totalCreated++;

            // Return: event airport → hub (departs after event end)
            const returnFN = randomFlightNumber(db, eventIcao, hub.icao);
            const endHour = (new Date(evt.end_time)).getUTCHours();
            const retDepTime = `${String((endHour + 1) % 24).padStart(2, '0')}:00`;
            const retArrTotalMin = ((endHour + 1) % 24) * 60 + flightTimeMin;
            const retArrH = Math.floor(retArrTotalMin / 60) % 24;
            const retArrM = retArrTotalMin % 60;
            const retArrTime = `${String(retArrH).padStart(2, '0')}:${String(retArrM).padStart(2, '0')}`;

            insertStmt.run(
              returnFN, eventIcao, hub.icao, aircraft.icao_type,
              retDepTime, retArrTime, distanceNm, flightTimeMin,
              evt.tag, evt.id, expiresAt,
            );
            totalCreated++;

            // Limit: one aircraft type per event airport to prevent flooding
            break;
          }
        }
      }
    });

    txn();

    if (totalCreated > 0) {
      // Upsert the generation log event count for current month
      const month = currentMonth();
      db.prepare(`
        INSERT INTO charter_generation_log (month, charter_count, event_count)
        VALUES (?, 0, ?)
        ON CONFLICT(month) DO UPDATE SET event_count = event_count + excluded.event_count
      `).run(month, totalCreated);

      logger.info('VatsimEvents', `Created ${totalCreated} event charters from ${events.length} events`);
    }

    return totalCreated;
  }

  /** Get currently-active cached events (started today or earlier, not yet ended). */
  getUpcomingEvents(): VatsimEventInfo[] {
    const rows = getDb().prepare(`
      SELECT id, name, event_type, start_time, end_time, airports, tag
      FROM vatsim_events
      WHERE date(start_time) <= date('now')
        AND end_time >= datetime('now')
      ORDER BY start_time ASC
    `).all() as VatsimEventRow[];

    return rows.map(r => ({
      id: r.id,
      name: r.name,
      eventType: r.event_type,
      startTime: r.start_time,
      endTime: r.end_time,
      airports: JSON.parse(r.airports) as string[],
      tag: r.tag,
    }));
  }

  /** Get generation status for a given month. */
  getGenerationStatus(month: string): CharterGenerationStatus | null {
    const row = getDb().prepare(`
      SELECT month, generated_at, charter_count, event_count
      FROM charter_generation_log
      WHERE month = ?
    `).get(month) as { month: string; generated_at: string; charter_count: number; event_count: number } | undefined;

    if (!row) return null;

    return {
      month: row.month,
      generatedAt: row.generated_at,
      charterCount: row.charter_count,
      eventCount: row.event_count,
    };
  }
}

