import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api';
import { fetchMetar, fetchTaf } from '../lib/weather-api';
import type { MetarData, TafData, FaaAirportEvent } from '@acars/shared';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface MetarCache {
  [icao: string]: { data: MetarData; fetchedAt: number };
}
interface TafCache {
  [icao: string]: { data: TafData; fetchedAt: number };
}

export interface DispatchData {
  metars: Record<string, MetarData>;
  tafs: Record<string, TafData>;
  faaEvents: FaaAirportEvent[];
  loading: boolean;
}

async function fetchFaaEvents(): Promise<FaaAirportEvent[]> {
  try {
    const data = await api.get<FaaAirportEvent[]>('/api/faa/airport-events');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function useDispatchData(origin?: string, destination?: string): DispatchData {
  const [metars, setMetars] = useState<Record<string, MetarData>>({});
  const [tafs, setTafs] = useState<Record<string, TafData>>({});
  const [faaEvents, setFaaEvents] = useState<FaaAirportEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const metarCacheRef = useRef<MetarCache>({});
  const tafCacheRef = useRef<TafCache>({});
  const faaFetchedAtRef = useRef(0);
  const faaCacheRef = useRef<FaaAirportEvent[]>([]);

  const fetchAll = useCallback(async () => {
    const icaos = [origin, destination].filter((s): s is string => !!s && s.length >= 3);
    if (icaos.length === 0) return;

    setLoading(true);
    try {
      const now = Date.now();

      // Fetch METAR/TAF for each ICAO (skip if cached)
      const metarPromises = icaos.map(async (icao) => {
        const cached = metarCacheRef.current[icao];
        if (cached && now - cached.fetchedAt < CACHE_TTL) return cached.data;
        const result = await fetchMetar(icao);
        if (result) {
          metarCacheRef.current[icao] = { data: result, fetchedAt: now };
        }
        return result;
      });

      const tafPromises = icaos.map(async (icao) => {
        const cached = tafCacheRef.current[icao];
        if (cached && now - cached.fetchedAt < CACHE_TTL) return cached.data;
        const result = await fetchTaf(icao);
        if (result) {
          tafCacheRef.current[icao] = { data: result, fetchedAt: now };
        }
        return result;
      });

      // Fetch FAA events (use ref for cache — avoids stale closure)
      const faaPromise = now - faaFetchedAtRef.current < CACHE_TTL
        ? Promise.resolve(faaCacheRef.current)
        : fetchFaaEvents().then((events) => {
            faaFetchedAtRef.current = now;
            faaCacheRef.current = events;
            return events;
          });

      const [metarResults, tafResults, faaResult] = await Promise.all([
        Promise.all(metarPromises),
        Promise.all(tafPromises),
        faaPromise,
      ]);

      const newMetars: Record<string, MetarData> = {};
      metarResults.forEach((m) => { if (m) newMetars[m.icao] = m; });

      const newTafs: Record<string, TafData> = {};
      tafResults.forEach((t) => { if (t) newTafs[t.icao] = t; });

      setMetars(newMetars);
      setTafs(newTafs);
      setFaaEvents(faaResult);
    } finally {
      setLoading(false);
    }
  }, [origin, destination]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { metars, tafs, faaEvents, loading };
}
