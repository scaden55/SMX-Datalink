import { useEffect, useRef, useCallback } from 'react';
import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { fetchMetar, fetchTaf, fetchNotams } from '../../lib/weather-api';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const DEBOUNCE_MS = 500;

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
