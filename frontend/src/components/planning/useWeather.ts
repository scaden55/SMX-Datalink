import { useEffect, useRef, useCallback } from 'react';
import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { api } from '../../lib/api';
import type { MetarData, TafData, NotamData } from '@acars/shared';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const DEBOUNCE_MS = 500;

async function fetchMetar(icao: string): Promise<MetarData | null> {
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
      flightCategory: m.fltcat ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchTaf(icao: string): Promise<TafData | null> {
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

async function fetchNotams(icao: string): Promise<NotamData[]> {
  try {
    const data = await api.get<any[]>(`/api/weather/notam?icaos=${icao}`);
    if (!Array.isArray(data)) return [];
    return data.slice(0, 20).map((n: any) => ({
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

export function useWeather() {
  const { form, weatherCache, updateWeather, setWeatherLoading } = useFlightPlanStore();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchForIcao = useCallback(async (icao: string) => {
    if (!icao || icao.length < 3) return;

    const cached = weatherCache[icao];
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return;

    setWeatherLoading(true);
    try {
      const [metar, taf, notams] = await Promise.all([
        fetchMetar(icao),
        fetchTaf(icao),
        fetchNotams(icao),
      ]);

      updateWeather(icao, {
        metar: metar ?? undefined,
        taf: taf ?? undefined,
        notams,
        fetchedAt: Date.now(),
      });
    } finally {
      setWeatherLoading(false);
    }
  }, [weatherCache, updateWeather, setWeatherLoading]);

  // Debounced fetch when origin/dest/alternates change
  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const icaos = [form.origin, form.destination, form.alternate1, form.alternate2]
        .map(s => s.trim().toUpperCase())
        .filter(s => s.length >= 3 && s.length <= 4);

      const unique = [...new Set(icaos)];
      unique.forEach(fetchForIcao);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timerRef.current);
  }, [form.origin, form.destination, form.alternate1, form.alternate2, fetchForIcao]);

  return { fetchForIcao };
}
