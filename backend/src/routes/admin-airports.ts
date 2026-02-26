import { Router } from 'express';
import { authMiddleware, dispatcherMiddleware } from '../middleware/auth.js';
import { AuditService } from '../services/audit.js';
import { getDb } from '../db/index.js';
import { logger } from '../lib/logger.js';

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

  // GET /api/admin/airports — list all approved airports
  router.get('/admin/airports', authMiddleware, dispatcherMiddleware, (_req, res) => {
    try {
      const rows = getDb().prepare(`
        SELECT id, icao, name, city, state, country, lat, lon, elevation, timezone, is_hub, handler
        FROM airports ORDER BY icao
      `).all() as AirportRow[];

      const airports = rows.map(row => ({
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
      }));

      res.json({ airports, total: airports.length });
    } catch (err) {
      logger.error('Admin', 'List airports error', err);
      res.status(500).json({ error: 'Failed to list airports' });
    }
  });

  // POST /api/admin/airports — add airport by ICAO (lookup from oa_airports)
  router.post('/admin/airports', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const { icao, isHub, handler } = req.body as { icao?: string; isHub?: boolean; handler?: string };

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

      const result = getDb().prepare(`
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
        after: { icao: icaoUpper, isHub: airport.isHub, handler: airport.handler },
        ipAddress: req.ip ?? null,
      });

      logger.info('Admin', `Airport ${icaoUpper} added`, { userId: req.user!.userId });
      res.status(201).json(airport);
    } catch (err) {
      logger.error('Admin', 'Add airport error', err);
      res.status(500).json({ error: 'Failed to add airport' });
    }
  });

  // DELETE /api/admin/airports/:icao — remove airport (blocked if used by active schedules)
  router.delete('/admin/airports/:icao', authMiddleware, dispatcherMiddleware, (req, res) => {
    try {
      const icao = (req.params.icao as string).toUpperCase();

      const existing = getDb().prepare('SELECT id FROM airports WHERE icao = ?').get(icao) as { id: number } | undefined;
      if (!existing) {
        res.status(404).json({ error: `Airport ${icao} not found` });
        return;
      }

      // Check if used by any active schedules
      const usedBy = getDb().prepare(`
        SELECT COUNT(*) as count FROM scheduled_flights
        WHERE (dep_icao = ? OR arr_icao = ?) AND is_active = 1
      `).get(icao, icao) as { count: number };

      if (usedBy.count > 0) {
        res.status(409).json({ error: `Cannot delete ${icao} — used by ${usedBy.count} active schedule(s)` });
        return;
      }

      getDb().prepare('DELETE FROM airports WHERE icao = ?').run(icao);

      auditService.log({
        actorId: req.user!.userId,
        action: 'airport.delete',
        targetType: 'airport',
        targetId: existing.id,
        before: { icao },
        ipAddress: req.ip ?? null,
      });

      logger.info('Admin', `Airport ${icao} deleted`, { userId: req.user!.userId });
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

  return router;
}
