import { api } from './api';
import type { MetarData, TafData, NotamData } from '@acars/shared';

/**
 * Shared weather data fetching functions.
 * Centralizes the aviationweather.gov API response mapping
 * so field name changes only need updating in one place.
 */

export async function fetchMetar(icao: string): Promise<MetarData | null> {
  try {
    const data = await api.get<any[]>(`/api/weather/metar?ids=${icao}`);
    if (!Array.isArray(data) || data.length === 0) return null;
    const m = data[0];
    return {
      icao,
      rawOb: m.rawOb ?? '',
      temp: m.temp ?? null,
      dewpoint: m.dewp ?? null,
      windDir: m.wdir ?? null,
      windSpeed: m.wspd ?? null,
      windGust: m.wgst ?? null,
      visibility: m.visib ?? null,
      altimeter: m.altim ?? null,
      flightCategory: m.fltCat ?? null,
    };
  } catch {
    return null;
  }
}

export async function fetchTaf(icao: string): Promise<TafData | null> {
  try {
    const data = await api.get<any[]>(`/api/weather/taf?ids=${icao}`);
    if (!Array.isArray(data) || data.length === 0) return null;
    const t = data[0];
    return {
      icao,
      rawTaf: t.rawTAF ?? '',
      validTimeFrom: t.validTimeFrom ?? '',
      validTimeTo: t.validTimeTo ?? '',
    };
  } catch {
    return null;
  }
}

export async function fetchNotams(icao: string, limit = 20): Promise<NotamData[]> {
  try {
    const data = await api.get<any[]>(`/api/weather/notam?icaos=${icao}`);
    if (!Array.isArray(data)) return [];
    return data.slice(0, limit).map((n: any) => ({
      icao,
      text: n.text ?? n.icaoMessage ?? '',
      effectiveStart: n.effectiveStart ?? '',
      effectiveEnd: n.effectiveEnd ?? '',
      classification: n.classification ?? '',
    }));
  } catch {
    return [];
  }
}
