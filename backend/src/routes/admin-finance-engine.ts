import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import {
  FinanceEngineStore,
  rateManifest,
  computeFlightCosts,
  allocateFixedCosts,
  computeMaintAlerts,
  computeFlightPnL,
  computePeriodPnL,
  rollOperationalEvent,
} from '../services/finance-engine/index.js';
import { getDb } from '../db/index.js';
import { logger } from '../lib/logger.js';
import type { ULD, PeriodType } from '@acars/shared';

export function adminFinanceEngineRouter(): Router {
  const router = Router();
  const store = new FinanceEngineStore();

  const auth = [authMiddleware, adminMiddleware] as const;

  // ── Rate Config ────────────────────────────────────────────

  router.get('/admin/finance-engine/rate-config', ...auth, (_req, res) => {
    try {
      res.json(store.getRateConfig());
    } catch (err) {
      logger.error('FinanceEngine', 'Get rate config error', err);
      res.status(500).json({ error: 'Failed to get rate config' });
    }
  });

  router.put('/admin/finance-engine/rate-config', ...auth, (req, res) => {
    try {
      store.updateRateConfig(req.body);
      res.json(store.getRateConfig());
    } catch (err) {
      logger.error('FinanceEngine', 'Update rate config error', err);
      res.status(500).json({ error: 'Failed to update rate config' });
    }
  });

  // ── Lane Rates ─────────────────────────────────────────────

  router.get('/admin/finance-engine/lane-rates', ...auth, (_req, res) => {
    try {
      res.json(store.getLaneRates());
    } catch (err) {
      logger.error('FinanceEngine', 'List lane rates error', err);
      res.status(500).json({ error: 'Failed to list lane rates' });
    }
  });

  router.post('/admin/finance-engine/lane-rates', ...auth, (req, res) => {
    try {
      const { originIcao, destIcao, ratePerLb } = req.body;
      if (!originIcao || !destIcao || ratePerLb === undefined) {
        res.status(400).json({ error: 'originIcao, destIcao, and ratePerLb are required' });
        return;
      }
      const id = store.createLaneRate(originIcao, destIcao, ratePerLb);
      res.status(201).json({ id });
    } catch (err) {
      logger.error('FinanceEngine', 'Create lane rate error', err);
      res.status(500).json({ error: 'Failed to create lane rate' });
    }
  });

  router.patch('/admin/finance-engine/lane-rates/:id', ...auth, (req, res) => {
    try {
      store.updateLaneRate(parseInt(req.params.id as string), req.body.ratePerLb);
      res.json({ ok: true });
    } catch (err) {
      logger.error('FinanceEngine', 'Update lane rate error', err);
      res.status(500).json({ error: 'Failed to update lane rate' });
    }
  });

  router.delete('/admin/finance-engine/lane-rates/:id', ...auth, (req, res) => {
    try {
      store.deleteLaneRate(parseInt(req.params.id as string));
      res.json({ ok: true });
    } catch (err) {
      logger.error('FinanceEngine', 'Delete lane rate error', err);
      res.status(500).json({ error: 'Failed to delete lane rate' });
    }
  });

  // ── Commodity Rates ────────────────────────────────────────

  router.get('/admin/finance-engine/commodity-rates', ...auth, (req, res) => {
    try {
      const category = req.query.category as string | undefined;
      res.json(store.getCommodityRates(category));
    } catch (err) {
      logger.error('FinanceEngine', 'List commodity rates error', err);
      res.status(500).json({ error: 'Failed to list commodity rates' });
    }
  });

  router.post('/admin/finance-engine/commodity-rates', ...auth, (req, res) => {
    try {
      const { category, commodityCode, commodityName, ratePerLb, hazmat, tempControlled } = req.body;
      if (!category || !commodityCode || !commodityName) {
        res.status(400).json({ error: 'category, commodityCode, and commodityName are required' });
        return;
      }
      const id = store.createCommodityRate({
        category, commodityCode, commodityName,
        ratePerLb: ratePerLb ?? 0.45,
        hazmat: !!hazmat,
        tempControlled: !!tempControlled,
      });
      res.status(201).json({ id });
    } catch (err) {
      logger.error('FinanceEngine', 'Create commodity rate error', err);
      res.status(500).json({ error: 'Failed to create commodity rate' });
    }
  });

  router.patch('/admin/finance-engine/commodity-rates/:code', ...auth, (req, res) => {
    try {
      store.updateCommodityRate(req.params.code as string, req.body.ratePerLb);
      res.json({ ok: true });
    } catch (err) {
      logger.error('FinanceEngine', 'Update commodity rate error', err);
      res.status(500).json({ error: 'Failed to update commodity rate' });
    }
  });

  router.delete('/admin/finance-engine/commodity-rates/:id', ...auth, (req, res) => {
    try {
      store.deleteCommodityRate(parseInt(req.params.id as string));
      res.json({ ok: true });
    } catch (err) {
      logger.error('FinanceEngine', 'Delete commodity rate error', err);
      res.status(500).json({ error: 'Failed to delete commodity rate' });
    }
  });

  // ── Aircraft Profiles ──────────────────────────────────────

  router.get('/admin/finance-engine/aircraft-profiles', ...auth, (_req, res) => {
    try {
      res.json(store.getAircraftProfiles());
    } catch (err) {
      logger.error('FinanceEngine', 'List aircraft profiles error', err);
      res.status(500).json({ error: 'Failed to list aircraft profiles' });
    }
  });

  router.get('/admin/finance-engine/aircraft-profiles/:id', ...auth, (req, res) => {
    try {
      const profile = store.getAircraftProfileById(parseInt(req.params.id as string));
      if (!profile) { res.status(404).json({ error: 'Profile not found' }); return; }
      res.json(profile);
    } catch (err) {
      logger.error('FinanceEngine', 'Get aircraft profile error', err);
      res.status(500).json({ error: 'Failed to get aircraft profile' });
    }
  });

  router.post('/admin/finance-engine/aircraft-profiles', ...auth, (req, res) => {
    try {
      const { aircraftId } = req.body;
      if (!aircraftId) { res.status(400).json({ error: 'aircraftId is required' }); return; }
      const id = store.createAircraftProfile(req.body);
      res.status(201).json({ id });
    } catch (err) {
      logger.error('FinanceEngine', 'Create aircraft profile error', err);
      res.status(500).json({ error: 'Failed to create aircraft profile' });
    }
  });

  router.patch('/admin/finance-engine/aircraft-profiles/:id', ...auth, (req, res) => {
    try {
      store.updateAircraftProfile(parseInt(req.params.id as string), req.body);
      res.json({ ok: true });
    } catch (err) {
      logger.error('FinanceEngine', 'Update aircraft profile error', err);
      res.status(500).json({ error: 'Failed to update aircraft profile' });
    }
  });

  router.delete('/admin/finance-engine/aircraft-profiles/:id', ...auth, (req, res) => {
    try {
      store.deleteAircraftProfile(parseInt(req.params.id as string));
      res.json({ ok: true });
    } catch (err) {
      logger.error('FinanceEngine', 'Delete aircraft profile error', err);
      res.status(500).json({ error: 'Failed to delete aircraft profile' });
    }
  });

  // ── Station Fees ───────────────────────────────────────────

  router.get('/admin/finance-engine/station-fees', ...auth, (_req, res) => {
    try {
      res.json(store.getStationFees());
    } catch (err) {
      logger.error('FinanceEngine', 'List station fees error', err);
      res.status(500).json({ error: 'Failed to list station fees' });
    }
  });

  router.post('/admin/finance-engine/station-fees', ...auth, (req, res) => {
    try {
      const { icao } = req.body;
      if (!icao) { res.status(400).json({ error: 'icao is required' }); return; }
      const id = store.createStationFee(req.body);
      res.status(201).json({ id });
    } catch (err) {
      logger.error('FinanceEngine', 'Create station fee error', err);
      res.status(500).json({ error: 'Failed to create station fee' });
    }
  });

  router.patch('/admin/finance-engine/station-fees/:id', ...auth, (req, res) => {
    try {
      store.updateStationFee(parseInt(req.params.id as string), req.body);
      res.json({ ok: true });
    } catch (err) {
      logger.error('FinanceEngine', 'Update station fee error', err);
      res.status(500).json({ error: 'Failed to update station fee' });
    }
  });

  router.delete('/admin/finance-engine/station-fees/:id', ...auth, (req, res) => {
    try {
      store.deleteStationFee(parseInt(req.params.id as string));
      res.json({ ok: true });
    } catch (err) {
      logger.error('FinanceEngine', 'Delete station fee error', err);
      res.status(500).json({ error: 'Failed to delete station fee' });
    }
  });

  // ── Maintenance Thresholds ─────────────────────────────────

  router.get('/admin/finance-engine/maint-thresholds', ...auth, (_req, res) => {
    try {
      res.json(store.getMaintThresholds());
    } catch (err) {
      logger.error('FinanceEngine', 'List maint thresholds error', err);
      res.status(500).json({ error: 'Failed to list maint thresholds' });
    }
  });

  router.patch('/admin/finance-engine/maint-thresholds/:id', ...auth, (req, res) => {
    try {
      store.updateMaintThreshold(parseInt(req.params.id as string), req.body);
      res.json({ ok: true });
    } catch (err) {
      logger.error('FinanceEngine', 'Update maint threshold error', err);
      res.status(500).json({ error: 'Failed to update maint threshold' });
    }
  });

  // ── Rate a Cargo Manifest ──────────────────────────────────

  router.post('/admin/finance-engine/rate-manifest', ...auth, (req, res) => {
    try {
      const { cargoManifestId, isCharter } = req.body;
      if (!cargoManifestId) { res.status(400).json({ error: 'cargoManifestId is required' }); return; }

      // Fetch the cargo manifest + ULDs
      const manifestRow = getDb().prepare('SELECT * FROM cargo_manifests WHERE id = ?').get(cargoManifestId) as {
        id: number; flight_id: number; aircraft_icao: string; ulds_json: string;
        logbook_id?: number | null; payload_kg: number;
      } | undefined;
      if (!manifestRow) { res.status(404).json({ error: 'Cargo manifest not found' }); return; }

      const ulds: ULD[] = JSON.parse(manifestRow.ulds_json || '[]');

      // Get aircraft profile by icao type to get capacity
      const fleetRow = getDb().prepare('SELECT id, cargo_capacity_lbs FROM fleet WHERE icao_type = ? LIMIT 1').get(manifestRow.aircraft_icao) as { id: number; cargo_capacity_lbs: number } | undefined;

      const rateConfig = store.getRateConfig();
      const commodityRates = store.getCommodityRateMap();
      const categoryRates = store.getCategoryRateMap();

      const rated = rateManifest({
        cargoManifestId,
        logbookId: (manifestRow as { logbook_id?: number | null }).logbook_id ?? null,
        ulds,
        commodityRates,
        categoryRates,
        rateConfig,
        cargoCapacityLbs: fleetRow?.cargo_capacity_lbs ?? 0,
        isCharter: isCharter ?? false,
      });

      const ratedId = store.saveRatedManifest(rated);
      res.json({ id: ratedId, ...rated });
    } catch (err) {
      logger.error('FinanceEngine', 'Rate manifest error', err);
      res.status(500).json({ error: 'Failed to rate manifest' });
    }
  });

  // ── Rated Manifests (read) ─────────────────────────────────

  router.get('/admin/finance-engine/rated-manifests', ...auth, (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50));
      res.json(store.getRatedManifests(page, pageSize));
    } catch (err) {
      logger.error('FinanceEngine', 'List rated manifests error', err);
      res.status(500).json({ error: 'Failed to list rated manifests' });
    }
  });

  router.get('/admin/finance-engine/rated-manifests/:id', ...auth, (req, res) => {
    try {
      const result = store.getRatedManifest(parseInt(req.params.id as string));
      if (!result) { res.status(404).json({ error: 'Rated manifest not found' }); return; }
      res.json(result);
    } catch (err) {
      logger.error('FinanceEngine', 'Get rated manifest error', err);
      res.status(500).json({ error: 'Failed to get rated manifest' });
    }
  });

  // ── Compute Flight P&L ─────────────────────────────────────

  router.post('/admin/finance-engine/compute-pnl', ...auth, (req, res) => {
    try {
      const { logbookId } = req.body;
      if (!logbookId) { res.status(400).json({ error: 'logbookId is required' }); return; }

      // Fetch logbook entry
      const logEntry = getDb().prepare(`
        SELECT l.*, f.id as fleet_id, f.cargo_capacity_lbs, f.mtow_lbs
        FROM logbook l
        LEFT JOIN fleet f ON f.registration = l.aircraft_registration
        WHERE l.id = ?
      `).get(logbookId) as {
        id: number; flight_number: string; dep_icao: string; arr_icao: string;
        aircraft_registration: string; flight_time_min: number; distance_nm: number;
        cargo_lbs: number; fleet_id: number | null; cargo_capacity_lbs: number | null; mtow_lbs: number | null;
      } | undefined;
      if (!logEntry) { res.status(404).json({ error: 'Logbook entry not found' }); return; }

      const blockHours = logEntry.flight_time_min / 60;
      const payloadLbs = logEntry.cargo_lbs ?? 0;
      const cargoCapacityLbs = logEntry.cargo_capacity_lbs ?? 0;

      // Get aircraft profile
      const profile = logEntry.fleet_id ? store.getAircraftProfile(logEntry.fleet_id) : null;
      const rateConfig = store.getRateConfig();

      // Check for rated manifest
      const cargoManifest = getDb().prepare('SELECT id FROM cargo_manifests WHERE logbook_id = ? LIMIT 1').get(logbookId) as { id: number } | undefined;
      let ratedManifestId: number | null = null;
      let cargoRevenue = 0;

      if (cargoManifest) {
        const rated = store.getRatedManifestByCargoId(cargoManifest.id);
        if (rated) {
          ratedManifestId = rated.id;
          cargoRevenue = rated.total_revenue;
        }
      }

      // Variable costs
      const depStation = store.getStationFee(logEntry.dep_icao);
      const arrStation = store.getStationFee(logEntry.arr_icao);
      const defaultStation = {
        id: 0, icao: '', landingRate: 5.50, parkingRate: 25.00, groundHandling: 350.00,
        fuelPriceGal: rateConfig.defaultFuelPrice, navFeePerNm: 0.12, deiceFee: 0, uldHandling: 15.00,
      };

      // Approximate ULD count from cargo manifest
      let uldCount = 0;
      if (cargoManifest) {
        const cm = getDb().prepare('SELECT ulds_json FROM cargo_manifests WHERE id = ?').get(cargoManifest.id) as { ulds_json: string } | undefined;
        if (cm?.ulds_json) {
          try { uldCount = JSON.parse(cm.ulds_json).length; } catch { /* empty */ }
        }
      }

      const variableCosts = computeFlightCosts({
        blockHours,
        profile: profile ?? {
          baseFuelGph: 800, payloadFuelSensitivity: 0.5, mtowLbs: logEntry.mtow_lbs ?? 100000,
          crewPerDiem: 4.50, crewHotelRate: 150,
        },
        payloadLbs,
        distanceNm: logEntry.distance_nm,
        uldCount,
        depStation: depStation ?? defaultStation,
        arrStation: arrStation ?? defaultStation,
        needsDeice: false,
        isOvernight: blockHours > 8,
      });

      // Fixed costs
      const monthlyFlights = logEntry.fleet_id ? store.getMonthlyFlightCount(logEntry.fleet_id) : 1;
      const fixedCosts = allocateFixedCosts({
        blockHours,
        profile: profile ?? {
          leaseMonthly: 0, maintReservePerFh: 150,
          insuranceHullValue: 0, insuranceHullPct: 0.015, insuranceLiability: 0, insuranceWarRisk: 0,
        },
        monthlyFlights,
      });

      // Roll for operational event
      const maintThresholds = store.getMaintThresholds();
      const maintAlerts = computeMaintAlerts(
        { totalHours: 0, hoursAtLastA: 0, hoursAtLastC: 0, lastDCheckDate: null },
        maintThresholds,
      );

      const hasDgr = false; // could check cargo manifest for DGR ULDs
      const event = rollOperationalEvent({ maintAlerts, hasDgr });
      let eventId: number | null = null;
      if (event) {
        eventId = store.saveEvent(event, logbookId);
      }

      // Compute P&L
      const pnl = computeFlightPnL({
        logbookId,
        flightNumber: logEntry.flight_number,
        depIcao: logEntry.dep_icao,
        arrIcao: logEntry.arr_icao,
        ratedManifestId,
        cargoRevenue,
        variableCosts,
        fixedCosts,
        blockHours,
        payloadLbs,
        cargoCapacityLbs,
        event,
      });

      store.saveFlightPnL(pnl, eventId);
      res.json(pnl);
    } catch (err) {
      logger.error('FinanceEngine', 'Compute P&L error', err);
      res.status(500).json({ error: 'Failed to compute P&L' });
    }
  });

  // ── Flight P&L (read) ─────────────────────────────────────

  router.get('/admin/finance-engine/flight-pnl', ...auth, (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50));
      res.json(store.getFlightPnLList(page, pageSize));
    } catch (err) {
      logger.error('FinanceEngine', 'List flight P&L error', err);
      res.status(500).json({ error: 'Failed to list flight P&L' });
    }
  });

  router.get('/admin/finance-engine/flight-pnl/:logbookId', ...auth, (req, res) => {
    try {
      const pnl = store.getFlightPnL(parseInt(req.params.logbookId as string));
      if (!pnl) { res.status(404).json({ error: 'Flight P&L not found' }); return; }
      res.json(pnl);
    } catch (err) {
      logger.error('FinanceEngine', 'Get flight P&L error', err);
      res.status(500).json({ error: 'Failed to get flight P&L' });
    }
  });

  // ── Period P&L ─────────────────────────────────────────────

  router.post('/admin/finance-engine/period-summary', ...auth, (req, res) => {
    try {
      const { periodType, periodKey } = req.body as { periodType: PeriodType; periodKey: string };
      if (!periodType || !periodKey) { res.status(400).json({ error: 'periodType and periodKey are required' }); return; }

      const flights = store.getFlightPnLsForPeriod(periodType, periodKey);
      const period = computePeriodPnL(flights, periodType, periodKey);
      store.savePeriodPnL(period);
      res.json(period);
    } catch (err) {
      logger.error('FinanceEngine', 'Compute period summary error', err);
      res.status(500).json({ error: 'Failed to compute period summary' });
    }
  });

  router.get('/admin/finance-engine/period-pnl', ...auth, (req, res) => {
    try {
      const periodType = req.query.periodType as PeriodType | undefined;
      res.json(store.getPeriodPnLList(periodType));
    } catch (err) {
      logger.error('FinanceEngine', 'List period P&L error', err);
      res.status(500).json({ error: 'Failed to list period P&L' });
    }
  });

  // ── Events (read) ─────────────────────────────────────────

  router.get('/admin/finance-engine/events', ...auth, (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50));
      res.json(store.getEvents(page, pageSize));
    } catch (err) {
      logger.error('FinanceEngine', 'List events error', err);
      res.status(500).json({ error: 'Failed to list events' });
    }
  });

  return router;
}
