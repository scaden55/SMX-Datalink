import { getDb } from '../db/index.js';

// ── Raw DB row types ─────────────────────────────────────────

interface OaAirportRow {
  ident: string;
  type: string;
  name: string;
  latitude_deg: number | null;
  longitude_deg: number | null;
  elevation_ft: number | null;
  iso_country: string | null;
  iso_region: string | null;
  municipality: string | null;
  iata_code: string | null;
}

interface OaRunwayRow {
  le_ident: string | null;
  he_ident: string | null;
  length_ft: number | null;
  width_ft: number | null;
  surface: string | null;
  lighted: number | null;
  closed: number | null;
  le_heading_degT: number | null;
}

interface OaFrequencyRow {
  type: string | null;
  description: string | null;
  frequency_mhz: number | null;
}

interface FallbackAirportRow {
  icao: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  elevation: number;
}

// ── Public response types ────────────────────────────────────

export interface AirportFrequency {
  type: string;
  description: string;
  frequency_mhz: number;
}

export interface AirportRunway {
  le_ident: string;
  he_ident: string;
  length_ft: number;
  width_ft: number;
  surface: string;
  lighted: boolean;
  le_heading_degT: number | null;
}

export interface AirportDetail {
  icao: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  elevation_ft: number | null;
  country: string | null;
  region: string | null;
  municipality: string | null;
  iata_code: string | null;
  frequencies: AirportFrequency[];
  runways: AirportRunway[];
}

// ── Map airport (minimal projection for labels) ─────────────

export interface MapAirport {
  ident: string;
  type: string;
  latitude_deg: number;
  longitude_deg: number;
}

export interface AirportSearchResult {
  ident: string;
  name: string;
  iata_code: string | null;
  municipality: string | null;
  iso_country: string | null;
}

// ── Service ──────────────────────────────────────────────────

export class AirportDetailService {
  /** Minimal airport list for map labels (large + medium airports with coords) */
  getMapAirports(): MapAirport[] {
    const db = getDb();
    return db.prepare(
      `SELECT ident, type, latitude_deg, longitude_deg
       FROM oa_airports
       WHERE type IN ('large_airport', 'medium_airport')
         AND latitude_deg IS NOT NULL AND longitude_deg IS NOT NULL`,
    ).all() as MapAirport[];
  }

  getByIcao(icao: string): AirportDetail | null {
    const db = getDb();
    const upperIcao = icao.toUpperCase();

    // Try OurAirports data first (richer — has frequencies + runways)
    const oaRow = db.prepare(
      `SELECT ident, type, name, latitude_deg, longitude_deg, elevation_ft,
              iso_country, iso_region, municipality, iata_code
       FROM oa_airports WHERE ident = ?`,
    ).get(upperIcao) as OaAirportRow | undefined;

    if (oaRow) {
      const frequencies = db.prepare(
        `SELECT type, description, frequency_mhz
         FROM oa_frequencies WHERE airport_ident = ? ORDER BY type`,
      ).all(upperIcao) as OaFrequencyRow[];

      const runways = db.prepare(
        `SELECT le_ident, he_ident, length_ft, width_ft, surface, lighted, closed, le_heading_degT
         FROM oa_runways WHERE airport_ident = ? AND closed != 1 ORDER BY length_ft DESC`,
      ).all(upperIcao) as OaRunwayRow[];

      return {
        icao: oaRow.ident,
        name: oaRow.name,
        type: oaRow.type,
        latitude: oaRow.latitude_deg ?? 0,
        longitude: oaRow.longitude_deg ?? 0,
        elevation_ft: oaRow.elevation_ft,
        country: oaRow.iso_country,
        region: oaRow.iso_region,
        municipality: oaRow.municipality,
        iata_code: oaRow.iata_code,
        frequencies: frequencies
          .filter((f) => f.frequency_mhz != null)
          .map((f) => ({
            type: f.type ?? 'OTHER',
            description: f.description ?? '',
            frequency_mhz: f.frequency_mhz!,
          })),
        runways: runways.map((r) => ({
          le_ident: r.le_ident ?? '',
          he_ident: r.he_ident ?? '',
          length_ft: r.length_ft ?? 0,
          width_ft: r.width_ft ?? 0,
          surface: r.surface ?? 'Unknown',
          lighted: r.lighted === 1,
          le_heading_degT: r.le_heading_degT,
        })),
      };
    }

    // Fallback to seed airports table (fewer fields, no freq/runways)
    const fallback = db.prepare(
      `SELECT icao, name, city, country, lat, lon, elevation
       FROM airports WHERE icao = ?`,
    ).get(upperIcao) as FallbackAirportRow | undefined;

    if (fallback) {
      return {
        icao: fallback.icao,
        name: fallback.name,
        type: 'airport',
        latitude: fallback.lat,
        longitude: fallback.lon,
        elevation_ft: fallback.elevation,
        country: fallback.country,
        region: null,
        municipality: fallback.city,
        iata_code: null,
        frequencies: [],
        runways: [],
      };
    }

    return null;
  }

  /** Search airports by ICAO prefix, IATA code, or name (case-insensitive). */
  searchAirports(query: string, limit = 10): AirportSearchResult[] {
    const db = getDb();
    const upperQuery = query.toUpperCase();
    const namePattern = `%${upperQuery}%`;
    return db.prepare(
      `SELECT ident, name, iata_code, municipality, iso_country
       FROM oa_airports
       WHERE (ident LIKE ? OR iata_code LIKE ? OR UPPER(name) LIKE ?)
         AND type IN ('large_airport', 'medium_airport', 'small_airport')
       ORDER BY
         CASE WHEN ident = ? THEN 0 WHEN ident LIKE ? THEN 1 ELSE 2 END,
         CASE type WHEN 'large_airport' THEN 0 WHEN 'medium_airport' THEN 1 ELSE 2 END
       LIMIT ?`,
    ).all(upperQuery + '%', upperQuery + '%', namePattern, upperQuery, upperQuery + '%', limit) as AirportSearchResult[];
  }
}
