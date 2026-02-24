import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { VatsimFacilityType, ParsedCallsign } from '@acars/shared';
import { logger } from '../lib/logger.js';

interface GeoJsonFeature {
  type: 'Feature';
  properties: Record<string, any>;
  geometry: any;
}

interface GeoJsonCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

/**
 * VATSIM callsign prefix → FIR boundary ID mapping.
 *
 * VATSIM controllers use informal city/region callsign prefixes that don't match
 * the ICAO FIR identifiers in the boundary GeoJSON. For example, Chicago Center
 * uses callsign prefix "CHI" but the FIR boundary ID is "KZAU".
 *
 * International controllers typically match their ICAO codes directly (e.g.
 * ZSSS_CTR → "ZSSS"), so only regions with divergent naming need entries here.
 */
const CALLSIGN_TO_FIR: Record<string, string> = {
  // ── VATUSA ARTCCs ─────────────────────────────────
  ABQ: 'KZAB',   // Albuquerque Center
  ATL: 'KZTL',   // Atlanta Center
  BOS: 'KZBW',   // Boston Center
  CHI: 'KZAU',   // Chicago Center
  CLV: 'KZOB',   // Cleveland Center
  CLE: 'KZOB',   // Cleveland Center (alt prefix)
  DC:  'KZDC',   // Washington Center
  PCT: 'KZDC',   // Washington Center (Potomac alt)
  DEN: 'KZDV',   // Denver Center
  FTW: 'KZFW',   // Fort Worth Center
  HOU: 'KZHU',   // Houston Center
  IND: 'KZID',   // Indianapolis Center
  JAX: 'KZJX',   // Jacksonville Center
  KC:  'KZKC',   // Kansas City Center
  ZKC: 'KZKC',   // Kansas City Center (ICAO style)
  LA:  'KZLA',   // Los Angeles Center
  SLC: 'KZLC',   // Salt Lake Center
  MIA: 'KZMA',   // Miami Center
  MEM: 'KZME',   // Memphis Center
  MSP: 'KZMP',   // Minneapolis Center
  MIN: 'KZMP',   // Minneapolis Center (alt prefix)
  NY:  'KZNY',   // New York Center
  OAK: 'KZOA',   // Oakland Center
  SEA: 'KZSE',   // Seattle Center
  ANC: 'PAZA',   // Anchorage Center
  HNL: 'PHZH',   // Honolulu Center

  // ── VATCAN ARTCCs ─────────────────────────────────
  WPG: 'CZWG',   // Winnipeg Center
  MTL: 'CZUL',   // Montreal Center
  TOR: 'CZYZ',   // Toronto Center
  VAN: 'CZVR',   // Vancouver Center
  EDM: 'CZEG',   // Edmonton Center
  MON: 'CZQM',   // Moncton Center
  GDR: 'CZQX',   // Gander Center
};

/**
 * Resolves controller callsigns to FIR/TRACON boundary IDs.
 *
 * Boundary matching strategy:
 * - CTR (6) / FSS (1) → FIR boundaries (matched by ICAO prefix)
 * - APP/DEP (5)       → TRACON boundaries (matched by prefix)
 * - TWR (4) / GND (3) / DEL (2) → no boundary (use transceiver position)
 */
export class VatsimBoundaryService {
  private firIndex = new Map<string, string>();      // prefix -> featureId
  private traconIndex = new Map<string, string>();   // prefix -> featureId
  private firGeoJson: GeoJsonCollection | null = null;
  private traconGeoJson: GeoJsonCollection | null = null;

  constructor() {
    this.loadBoundaries();
  }

  private loadBoundaries(): void {
    const dataDir = join(process.cwd(), 'data', 'vatsim');

    const firPath = join(dataDir, 'fir-boundaries.geojson');
    if (existsSync(firPath)) {
      try {
        this.firGeoJson = JSON.parse(readFileSync(firPath, 'utf-8'));
        for (const feature of this.firGeoJson!.features) {
          const id = feature.properties.id || feature.properties.icao || feature.properties.ICAO;
          if (id) {
            this.firIndex.set(id, id);

            // Strip country prefix so "ZAU" also resolves to "KZAU", "ZYZ" to "CZYZ"
            if (/^K[A-Z]/.test(id)) {
              this.firIndex.set(id.slice(1), id);      // KZAU → ZAU
            } else if (/^C[A-Z]/.test(id)) {
              this.firIndex.set(id.slice(1), id);      // CZWG → ZWG
            }

            if (feature.properties.prefix) {
              this.firIndex.set(feature.properties.prefix, id);
            }
          }
        }

        // Apply VATSIM callsign prefix → FIR ID mapping
        for (const [prefix, firId] of Object.entries(CALLSIGN_TO_FIR)) {
          if (this.firIndex.has(firId)) {
            this.firIndex.set(prefix, firId);
          }
        }
        logger.info('VatsimBoundaries', `Loaded ${this.firGeoJson!.features.length} FIR boundaries`);
      } catch (err) {
        logger.warn('VatsimBoundaries', 'Failed to load FIR boundaries', err);
      }
    } else {
      logger.info('VatsimBoundaries', 'No FIR boundary file found (optional)');
    }

    const traconPath = join(dataDir, 'tracon-boundaries.geojson');
    if (existsSync(traconPath)) {
      try {
        this.traconGeoJson = JSON.parse(readFileSync(traconPath, 'utf-8'));
        for (const feature of this.traconGeoJson!.features) {
          const id = feature.properties.id;
          if (id) {
            this.traconIndex.set(id, id);
          }
          // Index each ICAO prefix → TRACON id (e.g. "ATL" → "A80")
          const prefixes = feature.properties.prefix;
          if (Array.isArray(prefixes)) {
            for (const p of prefixes) {
              if (typeof p === 'string') this.traconIndex.set(p, id);
            }
          } else if (typeof prefixes === 'string') {
            this.traconIndex.set(prefixes, id);
          }
        }
        logger.info('VatsimBoundaries', `Loaded ${this.traconGeoJson!.features.length} TRACON boundaries`);
      } catch (err) {
        logger.warn('VatsimBoundaries', 'Failed to load TRACON boundaries', err);
      }
    } else {
      logger.info('VatsimBoundaries', 'No TRACON boundary file found (optional)');
    }
  }

  /** Parse a VATSIM controller callsign into prefix/suffix parts */
  parseCallsign(callsign: string): ParsedCallsign {
    const parts = callsign.split('_');
    const suffix = parts[parts.length - 1] ?? '';
    const prefix = parts[0] ?? '';
    const fullPrefix = parts.length > 2 ? parts.slice(0, -1).join('_') : prefix;
    return { prefix, fullPrefix, suffix };
  }

  /** Resolve a boundary ID for a controller based on callsign and facility type */
  resolveBoundary(callsign: string, facility: VatsimFacilityType): string | null {
    const parsed = this.parseCallsign(callsign);

    switch (facility) {
      case 6: // Center
      case 1: // FSS
        // Try full prefix first, then just the ICAO prefix
        return this.firIndex.get(parsed.fullPrefix)
          ?? this.firIndex.get(parsed.prefix)
          ?? null;

      case 5: // Approach/Departure
        return this.traconIndex.get(parsed.fullPrefix)
          ?? this.traconIndex.get(parsed.prefix)
          ?? null;

      default:
        // TWR/GND/DEL — no boundary polygon, position from transceivers
        return null;
    }
  }

  /** Get the FIR GeoJSON collection (for serving via REST) */
  getFirGeoJson(): GeoJsonCollection | null {
    return this.firGeoJson;
  }

  /** Get the TRACON GeoJSON collection (for serving via REST) */
  getTraconGeoJson(): GeoJsonCollection | null {
    return this.traconGeoJson;
  }
}
