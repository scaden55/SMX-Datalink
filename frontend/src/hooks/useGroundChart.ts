import { useState, useEffect } from 'react';
import { fetchGroundChart, type GroundChartData } from '../lib/ground-chart-api';

export function useGroundChart(icao: string | null) {
  const [data, setData] = useState<GroundChartData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch for valid 3-4 char ICAO codes
    if (!icao || icao.length < 3 || icao.length > 4) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchGroundChart(icao, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Failed to load ground chart');
        setLoading(false);
      });

    return () => controller.abort();
  }, [icao]);

  return { data, loading, error };
}
