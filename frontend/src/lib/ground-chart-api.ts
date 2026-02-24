import { getApiBase } from './api';
import { useAuthStore } from '../stores/authStore';

export interface GroundChartData {
  icao: string;
  source: string;
  center: [number, number]; // [lon, lat]
  geojson: GeoJSON.FeatureCollection;
}

export async function fetchGroundChart(
  icao: string,
  signal?: AbortSignal,
): Promise<GroundChartData | null> {
  try {
    const { accessToken } = useAuthStore.getState();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

    const res = await fetch(
      `${getApiBase()}/api/ground-chart/${encodeURIComponent(icao)}`,
      { headers, signal },
    );
    if (!res.ok) return null;
    return res.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return null;
    return null;
  }
}
