import { Router } from 'express';
import { FleetService } from '../services/fleet.js';
import { SimBriefAircraftService } from '../services/simbrief-aircraft.js';
import { MaintenanceService } from '../services/maintenance.js';
import { SettingsService } from '../services/settings.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import type { FleetFilters } from '../services/fleet.js';
import type { FleetStatus, CreateFleetAircraftRequest, UpdateFleetAircraftRequest, ServerToClientEvents, ClientToServerEvents } from '@acars/shared';
import type { Server as SocketServer } from 'socket.io';
import { logger } from '../lib/logger.js';

const VALID_STATUSES = new Set<FleetStatus>(['active', 'stored', 'retired', 'maintenance']);

export function fleetManageRouter(io?: SocketServer<ClientToServerEvents, ServerToClientEvents>): Router {
  const router = Router();
  const service = new FleetService();
  const simbriefService = new SimBriefAircraftService();

  // GET /api/fleet/manage — all fleet with filters (auth required)
  router.get('/fleet/manage', authMiddleware, (req, res) => {
    try {
      const filters: FleetFilters = {
        icaoType: req.query.type as string | undefined,
        status: VALID_STATUSES.has(req.query.status as FleetStatus)
          ? (req.query.status as FleetStatus)
          : undefined,
        search: req.query.search as string | undefined,
      };

      const fleet = service.findAll(filters);
      res.json({ fleet, total: fleet.length });
    } catch (err) {
      logger.error('Fleet', 'List error', err);
      res.status(500).json({ error: 'Failed to fetch fleet' });
    }
  });

  // GET /api/fleet/manage/types — distinct ICAO types including inactive (auth required)
  router.get('/fleet/manage/types', authMiddleware, (_req, res) => {
    try {
      const types = service.findDistinctTypes();
      res.json(types);
    } catch (err) {
      logger.error('Fleet', 'Types error', err);
      res.status(500).json({ error: 'Failed to fetch aircraft types' });
    }
  });

  // POST /api/fleet/manage — create aircraft (admin only)
  router.post('/fleet/manage', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const body = req.body as Partial<CreateFleetAircraftRequest>;

      if (!body.icaoType || !body.name || !body.registration) {
        res.status(400).json({ error: 'icaoType, name, and registration are required' });
        return;
      }
      if (body.rangeNm == null || body.cruiseSpeed == null || body.paxCapacity == null || body.cargoCapacityLbs == null) {
        res.status(400).json({ error: 'rangeNm, cruiseSpeed, paxCapacity, and cargoCapacityLbs are required' });
        return;
      }

      const aircraft = service.create(body as CreateFleetAircraftRequest);
      io?.emit('fleet:updated');
      res.status(201).json(aircraft);
    } catch (err: any) {
      if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        res.status(409).json({ error: 'Registration already exists' });
        return;
      }
      logger.error('Fleet', 'Create error', err);
      res.status(500).json({ error: 'Failed to create aircraft' });
    }
  });

  // PATCH /api/fleet/manage/:id — update aircraft (admin only)
  router.patch('/fleet/manage/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid aircraft ID' });
        return;
      }

      const body = req.body as UpdateFleetAircraftRequest;
      const aircraft = service.update(id, body);
      if (!aircraft) {
        res.status(404).json({ error: 'Aircraft not found' });
        return;
      }

      io?.emit('fleet:updated');
      res.json(aircraft);
    } catch (err: any) {
      if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        res.status(409).json({ error: 'Registration already exists' });
        return;
      }
      logger.error('Fleet', 'Update error', err);
      res.status(500).json({ error: 'Failed to update aircraft' });
    }
  });

  // GET /api/fleet/simbrief/aircraft?q=<term> — search SimBrief airframes (auth required)
  router.get('/fleet/simbrief/aircraft', authMiddleware, async (req, res) => {
    try {
      const query = (req.query.q as string) ?? '';
      const aircraft = await simbriefService.search(query);
      res.json({ aircraft, cachedAt: simbriefService.cachedAt ?? new Date().toISOString() });
    } catch (err) {
      logger.error('Fleet', 'SimBrief search error', err);
      res.status(502).json({ error: 'Failed to fetch SimBrief aircraft data' });
    }
  });

  // POST /api/fleet/simbrief/parse-share — parse a SimBrief share link (auth required)
  router.post('/fleet/simbrief/parse-share', authMiddleware, async (req, res) => {
    try {
      const { url } = req.body as { url?: string };
      if (!url || typeof url !== 'string') {
        res.status(400).json({ error: 'Missing url field' });
        return;
      }

      // Extract the share data portion from the URL
      // Formats: dispatch.simbrief.com/airframes/share/{data} or just the {data} part
      let shareData = url.trim();
      const shareMatch = shareData.match(/airframes\/share\/(.+)$/);
      if (shareMatch) shareData = shareMatch[1];

      // Format 1: {userId}_{airframeId} (live link)
      // The v2 API requires Navigraph OAuth which we don't have, so we try
      // several fallback strategies to resolve the airframe data.
      if (/^\d+_\d+$/.test(shareData)) {
        const [userId, airframeId] = shareData.split('_');
        logger.info('Fleet', `Resolving SimBrief share link: user=${userId} airframe=${airframeId}`);

        // Attempt 1: v2 API direct fetch (requires Navigraph OAuth — usually returns 401)
        try {
          const apiRes = await fetch(`https://api.simbrief.com/v2/airframes/user/${userId}/${airframeId}`);
          if (apiRes.ok) {
            const data = await apiRes.json() as Record<string, any>;
            const opts = data.airframe_options ?? {};
            logger.info('Fleet', 'Resolved via v2 API');
            res.json({ source: 'api', aircraft: mapAirframeOptions(data, opts) });
            return;
          }
          logger.info('Fleet', `v2 API returned ${apiRes.status} (expected — requires Navigraph OAuth)`);
        } catch (e) { logger.warn('Fleet', 'v2 API fetch error', e); }

        // Attempt 2: Search v2 system airframes for a matching internal_id or numeric id
        try {
          const sysRes = await fetch('https://api.simbrief.com/v2/airframes');
          if (sysRes.ok) {
            const allTypes = await sysRes.json() as Array<Record<string, any>>;
            for (const type of allTypes) {
              if (!Array.isArray(type.airframes)) continue;
              for (const af of type.airframes) {
                // Match by full shareData, just the airframeId part, or numeric id
                if (af.airframe_internal_id === shareData ||
                    af.airframe_internal_id === airframeId ||
                    String(af.id) === airframeId) {
                  const opts = af.airframe_options ?? {};
                  logger.info('Fleet', `Resolved via system airframes: ${af.airframe_icao}`);
                  res.json({ source: 'system', aircraft: mapAirframeOptions(af, opts) });
                  return;
                }
              }
            }
          }
        } catch (e) { logger.warn('Fleet', 'System airframes search error', e); }

        // Attempt 3: Fetch latest OFP via stored pilot ID — check if it used this airframe
        const settingsService = new SettingsService();
        const pilotId = settingsService.get('simbrief.pilot_id');
        if (pilotId) {
          try {
            const ofpRes = await fetch(`https://www.simbrief.com/api/xml.fetcher.php?userid=${encodeURIComponent(pilotId)}&json=1`);
            if (ofpRes.ok) {
              const ofp = await ofpRes.json() as Record<string, any>;
              const acf = ofp?.aircraft ?? {};
              const ofpInternalId = acf.internal_id ?? '';
              if (ofpInternalId === shareData || ofpInternalId === airframeId) {
                logger.info('Fleet', `Resolved via OFP match: ${acf.icaocode}`);
                res.json({
                  source: 'ofp',
                  aircraft: mapOfpAircraft(acf),
                });
                return;
              }
              logger.info('Fleet', `Latest OFP uses different airframe: ${ofpInternalId} (wanted ${shareData})`);
            }
          } catch (e) { logger.warn('Fleet', 'OFP fetch error', e); }
        }

        // Attempt 4: Fetch latest OFP via the share link's userId (if different from stored pilot ID)
        if (userId !== pilotId) {
          try {
            const ofpRes = await fetch(`https://www.simbrief.com/api/xml.fetcher.php?userid=${encodeURIComponent(userId)}&json=1`);
            if (ofpRes.ok) {
              const ofp = await ofpRes.json() as Record<string, any>;
              const acf = ofp?.aircraft ?? {};
              const ofpInternalId = acf.internal_id ?? '';
              if (ofpInternalId === shareData || ofpInternalId === airframeId) {
                logger.info('Fleet', `Resolved via share owner OFP: ${acf.icaocode}`);
                res.json({
                  source: 'ofp',
                  aircraft: mapOfpAircraft(acf),
                });
                return;
              }
            }
          } catch { /* fall through */ }
        }

        logger.info('Fleet', `All resolution attempts failed for share: ${shareData}`);
        res.status(422).json({
          error: 'This is a "latest version" share link which requires Navigraph authentication. In SimBrief\'s Share Aircraft dialog, use the first link instead — the snapshot link that starts with a long encoded string.',
          shareId: shareData,
        });
        return;
      }

      // Format 2: base64-encoded JSON snapshot (>25 chars)
      if (shareData.length > 25) {
        try {
          // URL-safe base64: . → + , _ → / , - → =
          const b64 = shareData.replace(/\./g, '+').replace(/_/g, '/').replace(/-/g, '=');
          const json = Buffer.from(b64, 'base64').toString('utf-8');
          const opts = JSON.parse(json) as Record<string, any>;

          res.json({
            source: 'snapshot',
            aircraft: mapAirframeSnapshot(opts),
          });
          return;
        } catch {
          res.status(400).json({ error: 'Could not decode the share link. Please check the URL and try again.' });
          return;
        }
      }

      res.status(400).json({ error: 'Unrecognized share link format' });
    } catch (err) {
      logger.error('Fleet', 'SimBrief share parse error', err);
      res.status(500).json({ error: 'Failed to parse SimBrief share link' });
    }
  });

  // GET /api/fleet/manage/:id — single aircraft detail (auth required)
  router.get('/fleet/manage/:id', authMiddleware, (req, res) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) { res.status(400).json({ error: 'Invalid aircraft ID' }); return; }

      const aircraft = service.findById(id);
      if (!aircraft) { res.status(404).json({ error: 'Aircraft not found' }); return; }

      res.json(aircraft);
    } catch (err) {
      logger.error('Fleet', 'Detail error', err);
      res.status(500).json({ error: 'Failed to fetch aircraft' });
    }
  });

  // GET /api/fleet/manage/:id/flights — recent flights for aircraft (auth required)
  router.get('/fleet/manage/:id/flights', authMiddleware, (req, res) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) { res.status(400).json({ error: 'Invalid aircraft ID' }); return; }

      const aircraft = service.findById(id);
      if (!aircraft) { res.status(404).json({ error: 'Aircraft not found' }); return; }

      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      const db = getDb();
      const rows = db.prepare(`
        SELECT l.id, l.flight_number, l.dep_icao, l.arr_icao,
               u.callsign AS pilot_callsign,
               l.flight_time_min, l.fuel_used_lbs, l.landing_rate_fpm,
               l.status, l.created_at
        FROM logbook l
        JOIN users u ON u.id = l.user_id
        WHERE l.aircraft_registration = ? AND l.status = 'approved'
        ORDER BY l.created_at DESC
        LIMIT ?
      `).all(aircraft.registration, limit) as Array<{
        id: number; flight_number: string; dep_icao: string; arr_icao: string;
        pilot_callsign: string; flight_time_min: number; fuel_used_lbs: number | null;
        landing_rate_fpm: number | null; status: string; created_at: string;
      }>;

      res.json(rows.map(r => ({
        id: r.id,
        flightNumber: r.flight_number,
        depIcao: r.dep_icao,
        arrIcao: r.arr_icao,
        pilotCallsign: r.pilot_callsign,
        blockTimeMin: r.flight_time_min,
        fuelUsedLbs: r.fuel_used_lbs,
        landingRateFpm: r.landing_rate_fpm,
        status: r.status,
        createdAt: r.created_at,
      })));
    } catch (err) {
      logger.error('Fleet', 'Flights error', err);
      res.status(500).json({ error: 'Failed to fetch aircraft flights' });
    }
  });

  // GET /api/fleet/manage/:id/maintenance — maintenance status (auth required)
  router.get('/fleet/manage/:id/maintenance', authMiddleware, (req, res) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) { res.status(400).json({ error: 'Invalid aircraft ID' }); return; }

      const maintenanceService = new MaintenanceService();
      maintenanceService.ensureAircraftHours(id);
      const status = maintenanceService.getAircraftStatus(id);
      if (!status) { res.status(404).json({ error: 'Aircraft not found' }); return; }

      res.json(status);
    } catch (err) {
      logger.error('Fleet', 'Maintenance error', err);
      res.status(500).json({ error: 'Failed to fetch maintenance status' });
    }
  });

  // GET /api/fleet/manage/:id/stats — utilization stats from logbook
  router.get('/fleet/manage/:id/stats', authMiddleware, (req, res) => {
    try {
      const aircraft = service.findById(parseInt(req.params.id as string));
      if (!aircraft) { res.status(404).json({ error: 'Aircraft not found' }); return; }

      const stats = service.getUtilizationStats(aircraft.registration);
      res.json(stats);
    } catch (err) {
      logger.error('Fleet', 'Stats error', err);
      res.status(500).json({ error: 'Failed to get utilization stats' });
    }
  });

  // DELETE /api/fleet/manage/:id — remove aircraft (admin only)
  router.delete('/fleet/manage/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid aircraft ID' });
        return;
      }

      const deleted = service.delete(id);
      if (!deleted) {
        res.status(404).json({ error: 'Aircraft not found' });
        return;
      }

      io?.emit('fleet:updated');
      res.status(204).send();
    } catch (err) {
      logger.error('Fleet', 'Delete error', err);
      res.status(500).json({ error: 'Failed to delete aircraft' });
    }
  });

  return router;
}

/** Map a SimBrief API airframe response to our SimBriefAircraftType shape */
function mapAirframeOptions(data: Record<string, any>, opts: Record<string, any>) {
  const parseLbs = (v: unknown) => typeof v === 'number' ? Math.round(v) : (typeof v === 'string' ? parseInt(v, 10) || 0 : 0);
  const parseNum = parseLbs;

  return {
    aircraftIcao: String(opts.icao ?? data.airframe_icao ?? ''),
    aircraftName: String(opts.name ?? data.airframe_name ?? ''),
    engines: String(opts.engines ?? data.airframe_engines ?? ''),
    passengers: parseNum(opts.maxpax ?? data.airframe_passengers ?? 0),
    mtowLbs: parseLbs(opts.mtow),
    speed: 0,
    ceilingFt: parseNum(opts.ceiling ?? 0),
    fuelflowLbs: 0,
    isCargo: false,
    oewLbs: parseLbs(opts.oew),
    mzfwLbs: parseLbs(opts.mzfw),
    mlwLbs: parseLbs(opts.mlw),
    maxFuelLbs: parseLbs(opts.maxfuel),
    maxPax: parseNum(opts.maxpax ?? 0),
    cat: String(opts.cat ?? ''),
    equipCode: String(opts.equip ?? ''),
    transponderCode: String(opts.transponder ?? ''),
    pbn: String(opts.pbn ?? ''),
    registration: String(opts.reg ?? data.airframe_registration ?? ''),
    selcal: String(opts.selcal ?? ''),
    hexCode: String(opts.hexcode ?? ''),
    maxCargo: parseLbs(opts.maxcargo ?? 0),
  };
}

/** Map OFP aircraft data (from xml.fetcher.php) to our shape */
function mapOfpAircraft(acf: Record<string, any>) {
  const p = (v: unknown) => typeof v === 'number' ? Math.round(v) : (typeof v === 'string' ? parseInt(v, 10) || 0 : 0);
  return {
    aircraftIcao: String(acf.icaocode ?? ''),
    aircraftName: String(acf.name ?? ''),
    engines: String(acf.eng ?? ''),
    passengers: p(acf.maxpax ?? 0),
    mtowLbs: p(acf.mtow),
    speed: 0,
    ceilingFt: 0,
    fuelflowLbs: 0,
    isCargo: false,
    oewLbs: p(acf.oew),
    mzfwLbs: p(acf.mzfw),
    mlwLbs: p(acf.mlw),
    maxFuelLbs: p(acf.maxfuel),
    maxPax: p(acf.maxpax ?? 0),
    cat: String(acf.cat ?? ''),
    equipCode: String(acf.equip ?? ''),
    transponderCode: String(acf.transponder ?? ''),
    pbn: String(acf.pbn ?? ''),
    registration: String(acf.reg ?? ''),
    selcal: typeof acf.selcal === 'string' ? acf.selcal : '',
    hexCode: String(acf.hexcode ?? ''),
    maxCargo: 0,
  };
}

/** Map a base64-decoded snapshot (airframe_options JSON) to our shape */
function mapAirframeSnapshot(opts: Record<string, any>) {
  const parseLbs = (v: unknown) => typeof v === 'number' ? Math.round(v) : (typeof v === 'string' ? parseInt(v, 10) || 0 : 0);
  const parseNum = parseLbs;

  return {
    aircraftIcao: String(opts.icao ?? ''),
    aircraftName: String(opts.name ?? ''),
    engines: String(opts.engines ?? ''),
    passengers: parseNum(opts.maxpax ?? 0),
    mtowLbs: parseLbs(opts.mtow),
    speed: 0,
    ceilingFt: parseNum(opts.ceiling ?? 0),
    fuelflowLbs: 0,
    isCargo: false,
    oewLbs: parseLbs(opts.oew),
    mzfwLbs: parseLbs(opts.mzfw),
    mlwLbs: parseLbs(opts.mlw),
    maxFuelLbs: parseLbs(opts.maxfuel),
    maxPax: parseNum(opts.maxpax ?? 0),
    cat: String(opts.cat ?? ''),
    equipCode: String(opts.equip ?? ''),
    transponderCode: String(opts.transponder ?? ''),
    pbn: String(opts.pbn ?? ''),
    registration: String(opts.reg ?? ''),
    selcal: String(opts.selcal ?? ''),
    hexCode: String(opts.hexcode ?? ''),
    maxCargo: parseLbs(opts.maxcargo ?? 0),
  };
}
