import { Router } from 'express';
import { authMiddleware, dispatcherMiddleware } from '../middleware/auth.js';
import { AuditService } from '../services/audit.js';
import { getDb } from '../db/index.js';
import { logger } from '../lib/logger.js';

// ── Lane rate row type ──────────────────────────────────────────

interface LaneRateRow {
  id: number;
  origin_icao: string;
  dest_icao: string;
  rate_per_lb: number;
}

// ── Helpers ──────────────────────────────────────────────────────

function timezoneFromIcao(icao: string): string {
  if (icao.startsWith('PA') || icao.startsWith('PF')) return 'America/Anchorage';
  if (icao.startsWith('PH')) return 'Pacific/Honolulu';
  if (icao.startsWith('CY')) return 'America/Toronto';
  if (icao.startsWith('ED')) return 'Europe/Berlin';
  if (icao.startsWith('HK')) return 'Africa/Nairobi';
  if (icao.startsWith('SB')) return 'America/Sao_Paulo';
  if (icao.startsWith('SP')) return 'America/Lima';
  if (icao.startsWith('SK')) return 'America/Bogota';
  if (icao.startsWith('SM')) return 'America/Paramaribo';
  if (icao.startsWith('MM')) return 'America/Mexico_City';
  if (icao.startsWith('MD')) return 'America/Santo_Domingo';
  if (icao.startsWith('MK')) return 'America/Jamaica';
  if (icao.startsWith('MT')) return 'America/Port-au-Prince';
  if (icao.startsWith('MU')) return 'America/Havana';
  if (icao.startsWith('MY')) return 'America/Nassau';
  if (icao.startsWith('RJ')) return 'Asia/Tokyo';
  if (icao.startsWith('TJ')) return 'America/Puerto_Rico';
  return 'America/New_York';
}

function countryFromIcao(icao: string): string {
  if (icao.startsWith('K') || icao.startsWith('PA') || icao.startsWith('PF') || icao.startsWith('PH') || icao.startsWith('TJ')) return 'US';
  if (icao.startsWith('CY')) return 'CA';
  if (icao.startsWith('ED')) return 'DE';
  if (icao.startsWith('HK')) return 'KE';
  if (icao.startsWith('SB')) return 'BR';
  if (icao.startsWith('SP')) return 'PE';
  if (icao.startsWith('SK')) return 'CO';
  if (icao.startsWith('SM')) return 'SR';
  if (icao.startsWith('MM')) return 'MX';
  if (icao.startsWith('MD')) return 'DO';
  if (icao.startsWith('MK')) return 'JM';
  if (icao.startsWith('MT')) return 'HT';
  if (icao.startsWith('MU')) return 'CU';
  if (icao.startsWith('MY')) return 'BS';
  if (icao.startsWith('RJ')) return 'JP';
  return 'XX';
}

// ── Row types ────────────────────────────────────────────────────

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

interface OaAirportRow {
  ident: string;
  name: string;
  municipality: string | null;
  iso_region: string | null;
  latitude_deg: number | null;
  longitude_deg: number | null;
  elevation_ft: number | null;
  iso_country: string | null;
}

// ── Router ───────────────────────────────────────────────────────

export function adminAirportsRouter(): Router {
  const router = Router();
  const auditService = new AuditService();

  // GET /api/admin/airports — list all approved airports (with lane rate summary)
  router.get('/admin/airports', authMiddleware, dispatcherMiddleware, (_req, res) => {
    try {
      const db = getDb();
      const rows = db.prepare(`
        SELECT id, icao, name, city, state, country, lat, lon, elevation, timezone, is_hub, handler
        FROM airports ORDER BY icao
      `).all() as AirportRow[];

      // Aggregate lane rate stats per airport (avg rate, lane count)
      const laneStats = db.prepare(`
        SELECT icao, AVG(rate_per_lb) as avg_rate, COUNT(*) as lane_count
        FROM (
          SELECT origin_icao AS icao, rate_per_lb FROM finance_lane_rates
          UNION ALL
          SELECT dest_icao AS icao, rate_per_lb FROM finance_lane_rates
        )
        GROUP BY icao
      `).all() as { icao: string; avg_rate: number; lane_count: number }[];

      const statsMap = new Map(laneStats.map(s => [s.icao, s]));

      const airports = rows.map(row => {
        const stats = statsMap.get(row.icao);
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
          avgRatePerLb: stats ? Math.round(stats.avg_rate * 10000) / 10000 : null,
          laneCount: stats?.lane_count ?? 0,
        };
      });

      res.json({ airports, total: airports.length });
    } catch (err) {
      logger.error('Admin', 'List airports error', err);
      res.status(500).json({ error: 'Failed to list airports' });
    }
  });

  // POST /api/admin/airports — add airport by ICAO (lookup from oa_airports)
  router.post('/admin/airports', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const { icao, isHub, handler, defaultRatePerLb } = req.body as {
        icao?: string;
        isHub?: boolean;
        handler?: string;
        defaultRatePerLb?: number;
      };

      if (!icao || typeof icao !== 'string') {
        res.status(400).json({ error: 'icao is required' });
        return;
      }

      const icaoUpper = icao.trim().toUpperCase();

      // Check if already exists
      const existing = getDb().prepare('SELECT id FROM airports WHERE icao = ?').get(icaoUpper);
      if (existing) {
        res.status(409).json({ error: `Airport ${icaoUpper} already exists` });
        return;
      }

      // Look up in oa_airports
      const oa = getDb().prepare(`
        SELECT ident, name, municipality, iso_region, latitude_deg, longitude_deg, elevation_ft, iso_country
        FROM oa_airports WHERE ident = ?
      `).get(icaoUpper) as OaAirportRow | undefined;

      if (!oa || oa.latitude_deg == null) {
        res.status(404).json({ error: `Airport ${icaoUpper} not found in OurAirports database` });
        return;
      }

      const country = oa.iso_country ?? countryFromIcao(icaoUpper);
      const timezone = timezoneFromIcao(icaoUpper);
      const state = oa.iso_region?.replace(/^[A-Z]{2}-/, '') ?? '';
      const hubValue = isHub ? 1 : 0;
      const handlerValue = handler?.trim() || null;

      const db = getDb();

      const result = db.prepare(`
        INSERT INTO airports (icao, name, city, state, country, lat, lon, elevation, timezone, is_hub, handler)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        icaoUpper,
        oa.name,
        oa.municipality ?? '',
        state,
        country,
        oa.latitude_deg,
        oa.longitude_deg ?? 0,
        oa.elevation_ft ?? 0,
        timezone,
        hubValue,
        handlerValue,
      );

      // Auto-create bidirectional lane rates with all existing approved airports
      let laneRateCount = 0;
      if (defaultRatePerLb != null && defaultRatePerLb > 0) {
        const otherAirports = db.prepare(
          'SELECT icao FROM airports WHERE icao != ?'
        ).all(icaoUpper) as { icao: string }[];

        const upsert = db.prepare(`
          INSERT INTO finance_lane_rates (origin_icao, dest_icao, rate_per_lb)
          VALUES (?, ?, ?)
          ON CONFLICT(origin_icao, dest_icao) DO UPDATE SET rate_per_lb = excluded.rate_per_lb
        `);

        const createLanes = db.transaction(() => {
          for (const other of otherAirports) {
            upsert.run(icaoUpper, other.icao, defaultRatePerLb);
            upsert.run(other.icao, icaoUpper, defaultRatePerLb);
            laneRateCount += 2;
          }
        });
        createLanes();
      }

      const airport = {
        id: result.lastInsertRowid as number,
        icao: icaoUpper,
        name: oa.name,
        city: oa.municipality ?? '',
        state,
        country,
        lat: oa.latitude_deg,
        lon: oa.longitude_deg ?? 0,
        elevation: oa.elevation_ft ?? 0,
        timezone,
        isHub: isHub ?? false,
        handler: handlerValue,
      };

      auditService.log({
        actorId: req.user!.userId,
        action: 'airport.create',
        targetType: 'airport',
        targetId: airport.id,
        after: { icao: icaoUpper, isHub: airport.isHub, handler: airport.handler, defaultRatePerLb, laneRateCount },
        ipAddress: req.ip ?? null,
      });

      logger.info('Admin', `Airport ${icaoUpper} added (${laneRateCount} lane rates created)`, { userId: req.user!.userId });
      res.status(201).json(airport);
    } catch (err) {
      logger.error('Admin', 'Add airport error', err);
      res.status(500).json({ error: 'Failed to add airport' });
    }
  });

  // DELETE /api/admin/airports/:icao — remove airport (cascade with ?force=true)
  router.delete('/admin/airports/:icao', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const icao = (req.params.icao as string).toUpperCase();
      const force = req.query.force === 'true';

      const existing = getDb().prepare('SELECT id FROM airports WHERE icao = ?').get(icao) as { id: number } | undefined;
      if (!existing) {
        res.status(404).json({ error: `Airport ${icao} not found` });
        return;
      }

      // Check if used by any schedules (active or inactive)
      const usedBy = getDb().prepare(`
        SELECT COUNT(*) as count FROM scheduled_flights
        WHERE dep_icao = ? OR arr_icao = ?
      `).get(icao, icao) as { count: number };

      if (usedBy.count > 0 && !force) {
        res.status(409).json({
          error: `${icao} is used by ${usedBy.count} schedule(s)`,
          scheduleCount: usedBy.count,
          icao,
        });
        return;
      }

      const db = getDb();

      const cascadeDelete = db.transaction(() => {
        // Delete schedules that use this airport
        let schedulesDeleted = 0;
        if (usedBy.count > 0) {
          const result = db.prepare(
            'DELETE FROM scheduled_flights WHERE dep_icao = ? OR arr_icao = ?'
          ).run(icao, icao);
          schedulesDeleted = result.changes;
        }

        // Clean up lane rates involving this airport
        const deletedLanes = db.prepare(
          'DELETE FROM finance_lane_rates WHERE origin_icao = ? OR dest_icao = ?'
        ).run(icao, icao);

        // Delete the airport
        db.prepare('DELETE FROM airports WHERE icao = ?').run(icao);

        return { schedulesDeleted, laneRatesRemoved: deletedLanes.changes };
      });

      const { schedulesDeleted, laneRatesRemoved } = cascadeDelete();

      auditService.log({
        actorId: req.user!.userId,
        action: 'airport.delete',
        targetType: 'airport',
        targetId: existing.id,
        before: { icao, schedulesDeleted, laneRatesRemoved },
        ipAddress: req.ip ?? null,
      });

      logger.info('Admin', `Airport ${icao} deleted (${schedulesDeleted} schedules, ${laneRatesRemoved} lane rates removed)`, { userId: req.user!.userId });
      res.status(204).end();
    } catch (err) {
      logger.error('Admin', 'Delete airport error', err);
      res.status(500).json({ error: 'Failed to delete airport' });
    }
  });

  // PATCH /api/admin/airports/:icao/hub — toggle hub status
  router.patch('/admin/airports/:icao/hub', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const icao = (req.params.icao as string).toUpperCase();

      const existing = getDb().prepare(
        'SELECT id, is_hub FROM airports WHERE icao = ?'
      ).get(icao) as { id: number; is_hub: number } | undefined;

      if (!existing) {
        res.status(404).json({ error: `Airport ${icao} not found` });
        return;
      }

      const newHub = existing.is_hub === 1 ? 0 : 1;
      getDb().prepare('UPDATE airports SET is_hub = ? WHERE icao = ?').run(newHub, icao);

      auditService.log({
        actorId: req.user!.userId,
        action: 'airport.toggleHub',
        targetType: 'airport',
        targetId: existing.id,
        before: { isHub: existing.is_hub === 1 },
        after: { isHub: newHub === 1 },
        ipAddress: req.ip ?? null,
      });

      logger.info('Admin', `Airport ${icao} hub toggled to ${newHub === 1}`, { userId: req.user!.userId });
      res.json({ icao, isHub: newHub === 1 });
    } catch (err) {
      logger.error('Admin', 'Toggle hub error', err);
      res.status(500).json({ error: 'Failed to toggle hub status' });
    }
  });

  // PATCH /api/admin/airports/:icao — update airport fields (handler, isHub)
  router.patch('/admin/airports/:icao', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const icao = (req.params.icao as string).toUpperCase();
      const { handler, isHub } = req.body as { handler?: string | null; isHub?: boolean };

      const existing = getDb().prepare(
        'SELECT id, is_hub, handler FROM airports WHERE icao = ?'
      ).get(icao) as { id: number; is_hub: number; handler: string | null } | undefined;

      if (!existing) {
        res.status(404).json({ error: `Airport ${icao} not found` });
        return;
      }

      const sets: string[] = [];
      const params: unknown[] = [];
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};

      if (handler !== undefined) {
        const handlerValue = handler?.trim() || null;
        sets.push('handler = ?');
        params.push(handlerValue);
        before.handler = existing.handler;
        after.handler = handlerValue;
      }

      if (isHub !== undefined) {
        const hubValue = isHub ? 1 : 0;
        sets.push('is_hub = ?');
        params.push(hubValue);
        before.isHub = existing.is_hub === 1;
        after.isHub = isHub;
      }

      if (sets.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      params.push(icao);
      getDb().prepare(`UPDATE airports SET ${sets.join(', ')} WHERE icao = ?`).run(...params);

      auditService.log({
        actorId: req.user!.userId,
        action: 'airport.update',
        targetType: 'airport',
        targetId: existing.id,
        before,
        after,
        ipAddress: req.ip ?? null,
      });

      // Return updated airport
      const updated = getDb().prepare(`
        SELECT id, icao, name, city, state, country, lat, lon, elevation, timezone, is_hub, handler
        FROM airports WHERE icao = ?
      `).get(icao) as AirportRow;

      logger.info('Admin', `Airport ${icao} updated`, { userId: req.user!.userId, fields: Object.keys(after) });
      res.json({
        id: updated.id,
        icao: updated.icao,
        name: updated.name,
        city: updated.city,
        state: updated.state,
        country: updated.country,
        lat: updated.lat,
        lon: updated.lon,
        elevation: updated.elevation,
        timezone: updated.timezone,
        isHub: updated.is_hub === 1,
        handler: updated.handler,
      });
    } catch (err) {
      logger.error('Admin', 'Update airport error', err);
      res.status(500).json({ error: 'Failed to update airport' });
    }
  });

  // GET /api/admin/airports/:icao/lane-rates — lane rates for a specific airport
  router.get('/admin/airports/:icao/lane-rates', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const icao = (req.params.icao as string).toUpperCase();
      const rows = getDb().prepare(`
        SELECT id, origin_icao, dest_icao, rate_per_lb
        FROM finance_lane_rates
        WHERE origin_icao = ? OR dest_icao = ?
        ORDER BY origin_icao, dest_icao
      `).all(icao, icao) as LaneRateRow[];

      const laneRates = rows.map(r => ({
        id: r.id,
        originIcao: r.origin_icao,
        destIcao: r.dest_icao,
        ratePerLb: r.rate_per_lb,
      }));

      res.json({ laneRates });
    } catch (err) {
      logger.error('Admin', 'Get airport lane rates error', err);
      res.status(500).json({ error: 'Failed to get lane rates' });
    }
  });

  // PUT /api/admin/airports/:icao/lane-rates — set default rate for all lanes involving this airport
  router.put('/admin/airports/:icao/lane-rates', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const icao = (req.params.icao as string).toUpperCase();
      const { ratePerLb } = req.body as { ratePerLb?: number };

      if (ratePerLb == null || ratePerLb < 0) {
        res.status(400).json({ error: 'ratePerLb is required and must be >= 0' });
        return;
      }

      const existing = getDb().prepare('SELECT id FROM airports WHERE icao = ?').get(icao) as { id: number } | undefined;
      if (!existing) {
        res.status(404).json({ error: `Airport ${icao} not found` });
        return;
      }

      const db = getDb();

      // Get all other approved airports
      const otherAirports = db.prepare(
        'SELECT icao FROM airports WHERE icao != ?'
      ).all(icao) as { icao: string }[];

      const upsert = db.prepare(`
        INSERT INTO finance_lane_rates (origin_icao, dest_icao, rate_per_lb)
        VALUES (?, ?, ?)
        ON CONFLICT(origin_icao, dest_icao) DO UPDATE SET rate_per_lb = excluded.rate_per_lb
      `);

      const updateLanes = db.transaction(() => {
        let count = 0;
        for (const other of otherAirports) {
          upsert.run(icao, other.icao, ratePerLb);
          upsert.run(other.icao, icao, ratePerLb);
          count += 2;
        }
        return count;
      });

      const laneCount = updateLanes();

      auditService.log({
        actorId: req.user!.userId,
        action: 'airport.updateLaneRates',
        targetType: 'airport',
        targetId: existing.id,
        after: { icao, ratePerLb, laneCount },
        ipAddress: req.ip ?? null,
      });

      logger.info('Admin', `Lane rates for ${icao} set to ${ratePerLb}/lb (${laneCount} lanes)`, { userId: req.user!.userId });
      res.json({ icao, ratePerLb, laneCount });
    } catch (err) {
      logger.error('Admin', 'Update airport lane rates error', err);
      res.status(500).json({ error: 'Failed to update lane rates' });
    }
  });

  return router;
}
