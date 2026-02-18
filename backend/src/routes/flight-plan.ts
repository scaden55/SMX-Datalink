import { Router } from 'express';
import { createHash } from 'crypto';
import { authMiddleware } from '../middleware/auth.js';
import { UserService } from '../services/user.js';
import { FlightPlanService } from '../services/flight-plan.js';
import { config } from '../config.js';

const SIMBRIEF_FETCH_URL = 'https://www.simbrief.com/api/xml.fetcher.php';
const AWC_BASE = 'https://aviationweather.gov/api/data';

export function flightPlanRouter(): Router {
  const router = Router();
  const userService = new UserService();
  const fpService = new FlightPlanService();

  // GET /api/profile/simbrief — get SimBrief username
  router.get('/profile/simbrief', authMiddleware, (req, res) => {
    try {
      const username = userService.getSimbriefUsername(req.user!.userId);
      res.json({ simbriefUsername: username });
    } catch (err) {
      console.error('[FlightPlan] Get SimBrief username error:', err);
      res.status(500).json({ error: 'Failed to get SimBrief username' });
    }
  });

  // PUT /api/profile/simbrief — save SimBrief username
  router.put('/profile/simbrief', authMiddleware, (req, res) => {
    try {
      const { simbriefUsername } = req.body as { simbriefUsername?: string };
      if (simbriefUsername === undefined) {
        res.status(400).json({ error: 'simbriefUsername is required' });
        return;
      }

      const trimmed = simbriefUsername.trim() || null;
      userService.updateSimbriefUsername(req.user!.userId, trimmed);
      res.json({ simbriefUsername: trimmed });
    } catch (err) {
      console.error('[FlightPlan] Save SimBrief username error:', err);
      res.status(500).json({ error: 'Failed to save SimBrief username' });
    }
  });

  // POST /api/simbrief/apicode — compute API v1 auth code for SimBrief popup generation
  router.post('/simbrief/apicode', authMiddleware, (req, res) => {
    try {
      const { orig, dest, type, outputpage } = req.body as {
        orig: string;
        dest: string;
        type: string;
        outputpage: string;
      };

      if (!orig || !dest || !type) {
        res.status(400).json({ error: 'orig, dest, and type are required' });
        return;
      }

      const timestamp = Math.round(Date.now() / 1000).toString();
      const outputpageCalc = (outputpage || '').replace(/^https?:\/\//, '');
      const apiReq = orig + dest + type + timestamp + outputpageCalc;
      const apicode = createHash('md5')
        .update(config.simbriefApiKey + apiReq)
        .digest('hex');

      res.json({ apicode, timestamp, outputpage: outputpageCalc });
    } catch (err) {
      console.error('[FlightPlan] SimBrief apicode error:', err);
      res.status(500).json({ error: 'Failed to compute API code' });
    }
  });

  // GET /api/simbrief/callback — auto-closing page for SimBrief popup redirect
  router.get('/simbrief/callback', (_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html><head><title>SimBrief</title></head>
<body style="background:#0d1117;color:#c9d1d9;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<p>OFP generated. This window will close automatically&hellip;</p>
<script>window.close();</script>
</body></html>`);
  });

  // GET /api/simbrief/ofp — proxy SimBrief fetch to avoid CORS
  router.get('/simbrief/ofp', authMiddleware, async (req, res) => {
    try {
      const username = userService.getSimbriefUsername(req.user!.userId);
      if (!username) {
        res.status(400).json({ error: 'SimBrief username not set' });
        return;
      }

      const url = `${SIMBRIEF_FETCH_URL}?username=${encodeURIComponent(username)}&json=1`;
      const upstream = await fetch(url);
      const json = await upstream.json();
      res.json(json);
    } catch (err) {
      console.error('[FlightPlan] SimBrief proxy error:', err);
      res.status(502).json({ error: 'Failed to fetch from SimBrief' });
    }
  });

  // GET /api/weather/metar — proxy aviationweather.gov METAR to avoid CORS
  router.get('/weather/metar', authMiddleware, async (req, res) => {
    try {
      const ids = req.query.ids as string;
      if (!ids) { res.status(400).json({ error: 'ids query param required' }); return; }
      const upstream = await fetch(`${AWC_BASE}/metar?ids=${encodeURIComponent(ids)}&format=json`);
      const json = await upstream.json();
      res.json(json);
    } catch (err) {
      console.error('[Weather] METAR proxy error:', err);
      res.status(502).json({ error: 'Failed to fetch METAR' });
    }
  });

  // GET /api/weather/taf — proxy aviationweather.gov TAF to avoid CORS
  router.get('/weather/taf', authMiddleware, async (req, res) => {
    try {
      const ids = req.query.ids as string;
      if (!ids) { res.status(400).json({ error: 'ids query param required' }); return; }
      const upstream = await fetch(`${AWC_BASE}/taf?ids=${encodeURIComponent(ids)}&format=json`);
      const json = await upstream.json();
      res.json(json);
    } catch (err) {
      console.error('[Weather] TAF proxy error:', err);
      res.status(502).json({ error: 'Failed to fetch TAF' });
    }
  });

  // GET /api/weather/notam — proxy aviationweather.gov NOTAM to avoid CORS
  router.get('/weather/notam', authMiddleware, async (req, res) => {
    try {
      const icaos = req.query.icaos as string;
      if (!icaos) { res.status(400).json({ error: 'icaos query param required' }); return; }
      const upstream = await fetch(`${AWC_BASE}/notam?icaos=${encodeURIComponent(icaos)}&format=json`);
      const json = await upstream.json();
      res.json(json);
    } catch (err) {
      console.error('[Weather] NOTAM proxy error:', err);
      res.status(502).json({ error: 'Failed to fetch NOTAMs' });
    }
  });

  // GET /api/bids/:id/flight-plan — load saved flight plan
  router.get('/bids/:id/flight-plan', authMiddleware, (req, res) => {
    try {
      const bidId = parseInt(req.params.id as string, 10);
      if (isNaN(bidId)) {
        res.status(400).json({ error: 'Invalid bid ID' });
        return;
      }

      const plan = fpService.getFlightPlan(bidId, req.user!.userId);
      if (!plan) {
        res.status(404).json({ error: 'Flight plan not found' });
        return;
      }

      res.json({
        ofpJson: plan.simbrief_ofp_json ? JSON.parse(plan.simbrief_ofp_json) : null,
        flightPlanData: plan.flight_plan_data ? JSON.parse(plan.flight_plan_data) : null,
        phase: plan.flight_plan_phase,
      });
    } catch (err) {
      console.error('[FlightPlan] Get flight plan error:', err);
      res.status(500).json({ error: 'Failed to get flight plan' });
    }
  });

  // PUT /api/bids/:id/flight-plan — save flight plan + OFP JSON
  router.put('/bids/:id/flight-plan', authMiddleware, (req, res) => {
    try {
      const bidId = parseInt(req.params.id as string, 10);
      if (isNaN(bidId)) {
        res.status(400).json({ error: 'Invalid bid ID' });
        return;
      }

      const { ofpJson, flightPlanData, phase } = req.body as {
        ofpJson?: unknown;
        flightPlanData?: unknown;
        phase?: string;
      };

      const updated = fpService.saveFlightPlan(bidId, req.user!.userId, {
        ofpJson: ofpJson !== undefined ? JSON.stringify(ofpJson) : undefined,
        flightPlanData: flightPlanData !== undefined ? JSON.stringify(flightPlanData) : undefined,
        phase: phase as any,
      });

      if (!updated) {
        res.status(404).json({ error: 'Bid not found or no changes' });
        return;
      }

      res.json({ success: true });
    } catch (err) {
      console.error('[FlightPlan] Save flight plan error:', err);
      res.status(500).json({ error: 'Failed to save flight plan' });
    }
  });

  return router;
}
