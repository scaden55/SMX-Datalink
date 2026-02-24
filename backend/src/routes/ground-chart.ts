import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { AirportDetailService } from '../services/airport-detail.js';
import osmtogeojson from 'osmtogeojson';
import { logger } from '../lib/logger.js';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const CACHE_TTL = 60 * 60 * 1000; // 60 minutes
const ICAO_RE = /^[A-Z]{3,4}$/;

interface CacheEntry {
  data: GroundChartResponse;
  timestamp: number;
}

interface GroundChartResponse {
  icao: string;
  source: 'boundary' | 'around';
  center: [number, number]; // [lon, lat]
  geojson: GeoJSON.FeatureCollection;
}

const cache = new Map<string, CacheEntry>();
const airportService = new AirportDetailService();

/** Normalize OSM aeroway tags to our canonical feature types */
function normalizeFeatureType(props: Record<string, unknown>): string {
  const aeroway = String(props.aeroway ?? '');
  const building = String(props.building ?? '');

  if (aeroway === 'runway') return 'runway';
  if (aeroway === 'taxiway') return 'taxiway';
  if (aeroway === 'apron') return 'apron';
  if (aeroway === 'parking_position') return 'parking_position';
  if (aeroway === 'gate') return 'gate';
  if (aeroway === 'holding_position') return 'holding_position';
  if (aeroway === 'terminal' || building === 'terminal') return 'terminal';
  if (aeroway === 'hangar' || building === 'hangar') return 'hangar';
  if (aeroway === 'navigationaid' || aeroway === 'windsock') return 'service_road';

  // Catch-all for other aeroway values
  if (aeroway) return aeroway;
  if (building) return 'terminal'; // buildings within airport bounds are likely terminals
  return 'apron';
}

/** Build Overpass QL for boundary-based query */
function boundaryQuery(icao: string): string {
  return `
[out:json][timeout:25];
(
  way["aerodrome"]["icao"="${icao}"];
  way["aerodrome"]["ref"="${icao}"];
  relation["aerodrome"]["icao"="${icao}"];
  relation["aerodrome"]["ref"="${icao}"];
  way["aeroway"="aerodrome"]["icao"="${icao}"];
  way["aeroway"="aerodrome"]["ref"="${icao}"];
  relation["aeroway"="aerodrome"]["icao"="${icao}"];
  relation["aeroway"="aerodrome"]["ref"="${icao}"];
)->.boundary;
(.boundary; map_to_area;)->.searchArea;
(
  way["aeroway"](area.searchArea);
  relation["aeroway"](area.searchArea);
  way["building"]["aeroway"](area.searchArea);
  node["aeroway"="gate"](area.searchArea);
  node["aeroway"="parking_position"](area.searchArea);
  node["aeroway"="holding_position"](area.searchArea);
);
out body;
>;
out skel qt;
`;
}

/** Build Overpass QL for radius-based fallback */
function aroundQuery(lat: number, lon: number): string {
  return `
[out:json][timeout:25];
(
  way["aeroway"](around:3000,${lat},${lon});
  relation["aeroway"](around:3000,${lat},${lon});
  node["aeroway"="gate"](around:3000,${lat},${lon});
  node["aeroway"="parking_position"](around:3000,${lat},${lon});
  node["aeroway"="holding_position"](around:3000,${lat},${lon});
);
out body;
>;
out skel qt;
`;
}

async function fetchOverpass(query: string): Promise<unknown> {
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) {
    throw new Error(`Overpass API returned ${res.status}`);
  }

  return res.json();
}

/** Check if Overpass response has meaningful aeroway features (not just nodes for skeleton) */
function hasAerowayFeatures(osmData: any): boolean {
  if (!osmData?.elements) return false;
  return osmData.elements.some(
    (el: any) => el.tags?.aeroway && (el.type === 'way' || el.type === 'relation' || el.tags.aeroway === 'gate' || el.tags.aeroway === 'parking_position' || el.tags.aeroway === 'holding_position'),
  );
}

export function groundChartRouter(): Router {
  const router = Router();

  // GET /api/ground-chart/:icao — proxy Overpass API with caching
  router.get('/ground-chart/:icao', authMiddleware, async (req, res) => {
    try {
      const icao = String(req.params.icao).toUpperCase();

      // Validate ICAO format
      if (!ICAO_RE.test(icao)) {
        res.status(400).json({ error: 'Invalid ICAO code — must be 3-4 uppercase letters' });
        return;
      }

      // Check cache (fresh)
      const now = Date.now();
      const cached = cache.get(icao);
      if (cached && now - cached.timestamp < CACHE_TTL) {
        res.json(cached.data);
        return;
      }

      // Look up airport for center coordinates (needed for fallback + response)
      const airport = airportService.getByIcao(icao);
      const center: [number, number] = airport
        ? [airport.longitude, airport.latitude]
        : [0, 0];

      let osmData: any;
      let source: 'boundary' | 'around' = 'boundary';

      // Stage 1: Boundary-based query
      try {
        osmData = await fetchOverpass(boundaryQuery(icao));
      } catch (err) {
        logger.error('GroundChart', `Boundary query failed for ${icao}`, err);
        osmData = null;
      }

      // Stage 2: Fallback to around-query if boundary produced no features
      if (!hasAerowayFeatures(osmData)) {
        if (airport) {
          source = 'around';
          try {
            osmData = await fetchOverpass(aroundQuery(airport.latitude, airport.longitude));
          } catch (err) {
            logger.error('GroundChart', `Around query failed for ${icao}`, err);
            // Return stale cache if available
            if (cached) {
              res.json(cached.data);
              return;
            }
            osmData = null;
          }
        } else {
          // No airport data for fallback
          if (cached) {
            res.json(cached.data);
            return;
          }
          osmData = null;
        }
      }

      // Convert OSM to GeoJSON
      let geojson: GeoJSON.FeatureCollection;
      if (osmData && osmData.elements && osmData.elements.length > 0) {
        geojson = osmtogeojson(osmData) as GeoJSON.FeatureCollection;

        // Enrich features with normalized featureType
        for (const feature of geojson.features) {
          if (feature.properties) {
            feature.properties.featureType = normalizeFeatureType(feature.properties);
          }
        }
      } else {
        geojson = { type: 'FeatureCollection', features: [] };
      }

      const response: GroundChartResponse = { icao, source, center, geojson };

      // Update cache (evict stale entries if cache is large)
      if (cache.size > 200) {
        for (const [key, entry] of cache) {
          if (now - entry.timestamp > CACHE_TTL) cache.delete(key);
        }
      }
      cache.set(icao, { data: response, timestamp: now });

      res.json(response);
    } catch (err) {
      logger.error('GroundChart', 'Proxy error', err);

      // Return stale cache on error
      const icao = String(req.params.icao).toUpperCase();
      const cached = cache.get(icao);
      if (cached) {
        res.json(cached.data);
        return;
      }

      res.status(502).json({ error: 'Failed to fetch ground chart data' });
    }
  });

  return router;
}
