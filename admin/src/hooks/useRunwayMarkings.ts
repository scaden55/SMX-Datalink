import { useState, useEffect, useRef, useCallback } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import { buildRunwayGeoJSON, EMPTY_FC } from '@/lib/runway-geometry';
import type { RunwayData } from '@/lib/runway-geometry';

const RUNWAY_MIN_ZOOM = 13;
const DEBOUNCE_MS = 250;

export function useRunwayMarkings(mapRef: React.RefObject<MapRef | null>, mapLoaded: boolean) {
  const [geoJson, setGeoJson] = useState<GeoJSON.FeatureCollection>(EMPTY_FC);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRunways = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const zoom = map.getZoom();
    if (zoom < RUNWAY_MIN_ZOOM) {
      setGeoJson(EMPTY_FC);
      return;
    }

    const bounds = map.getBounds();
    const n = bounds.getNorth();
    const s = bounds.getSouth();
    const e = bounds.getEast();
    const w = bounds.getWest();

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    fetch(`/api/airports/runways/bbox?n=${n}&s=${s}&e=${e}&w=${w}`, {
      signal: controller.signal,
    })
      .then(r => r.ok ? r.json() : [])
      .then((runways: RunwayData[]) => {
        if (!controller.signal.aborted) {
          setGeoJson(buildRunwayGeoJSON(runways));
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Runway fetch error:', err);
        }
      });
  }, [mapRef]);

  const debouncedFetch = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(fetchRunways, DEBOUNCE_MS);
  }, [fetchRunways]);

  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    debouncedFetch();

    map.on('moveend', debouncedFetch);
    return () => {
      map.off('moveend', debouncedFetch);
      abortRef.current?.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [mapLoaded, mapRef, debouncedFetch]);

  return geoJson;
}
