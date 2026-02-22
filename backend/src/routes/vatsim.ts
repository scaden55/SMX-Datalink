import { Router } from 'express';
import type { VatsimService } from '../services/vatsim.js';

/**
 * VATSIM REST endpoints — all public (no auth required).
 * VATSIM data is public information, no need to gate it.
 */
export function vatsimRouter(vatsimService: VatsimService): Router {
  const router = Router();

  // GET /api/vatsim/data — full snapshot
  router.get('/vatsim/data', (_req, res) => {
    const snapshot = vatsimService.getSnapshot();
    if (!snapshot) {
      res.status(503).json({ error: 'VATSIM data not yet available' });
      return;
    }
    res.json(snapshot);
  });

  // GET /api/vatsim/controllers — controllers only, optional facility filter
  router.get('/vatsim/controllers', (req, res) => {
    const snapshot = vatsimService.getSnapshot();
    if (!snapshot) {
      res.status(503).json({ error: 'VATSIM data not yet available' });
      return;
    }

    let controllers = snapshot.controllers;

    // Optional facility filter: ?facility=5,6
    const facilityParam = req.query.facility as string | undefined;
    if (facilityParam) {
      const facilities = new Set(facilityParam.split(',').map(Number).filter(n => !isNaN(n)));
      controllers = controllers.filter(c => facilities.has(c.facility));
    }

    res.json({ controllers, updatedAt: snapshot.updatedAt });
  });

  // GET /api/vatsim/pilots — pilots only, optional callsign search
  router.get('/vatsim/pilots', (req, res) => {
    const snapshot = vatsimService.getSnapshot();
    if (!snapshot) {
      res.status(503).json({ error: 'VATSIM data not yet available' });
      return;
    }

    let pilots = snapshot.pilots;

    // Optional callsign search: ?callsign=SMA
    const callsignParam = req.query.callsign as string | undefined;
    if (callsignParam) {
      const search = callsignParam.toUpperCase();
      pilots = pilots.filter(p => p.callsign.toUpperCase().includes(search));
    }

    res.json({ pilots, updatedAt: snapshot.updatedAt });
  });

  // GET /api/vatsim/boundaries/fir — serve FIR GeoJSON
  router.get('/vatsim/boundaries/fir', (_req, res) => {
    const geo = vatsimService.getBoundaryService().getFirGeoJson();
    if (!geo) {
      res.status(404).json({ error: 'FIR boundary data not available' });
      return;
    }
    res.json(geo);
  });

  // GET /api/vatsim/boundaries/tracon — serve TRACON GeoJSON
  router.get('/vatsim/boundaries/tracon', (_req, res) => {
    const geo = vatsimService.getBoundaryService().getTraconGeoJson();
    if (!geo) {
      res.status(404).json({ error: 'TRACON boundary data not available' });
      return;
    }
    res.json(geo);
  });

  return router;
}
