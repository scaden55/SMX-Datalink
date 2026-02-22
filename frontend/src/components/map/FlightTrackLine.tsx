import { useMemo } from 'react';
import { Polyline } from 'react-leaflet';
import { altitudeToColor } from '@acars/shared';
import type { TrackPoint } from '@acars/shared';

// ── Downsampling ─────────────────────────────────────────────

const MAX_SEGMENTS = 500;

/**
 * Downsample track points using Ramer-Douglas-Peucker-like approach:
 * keep every Nth point to stay under MAX_SEGMENTS.
 * Simple and fast — no need for full RDP since we want uniform density.
 */
function downsample(points: TrackPoint[]): TrackPoint[] {
  if (points.length <= MAX_SEGMENTS) return points;
  const step = points.length / MAX_SEGMENTS;
  const result: TrackPoint[] = [];
  for (let i = 0; i < MAX_SEGMENTS; i++) {
    result.push(points[Math.floor(i * step)]);
  }
  // Always include the last point
  result.push(points[points.length - 1]);
  return result;
}

// ── Component ───────────────────────────────────────────────

interface Props {
  /** Track points from the trackStore (DB-persisted SMA flight data) */
  points: TrackPoint[];
}

/**
 * Renders an SMA flight's recorded track as altitude-gradient polyline segments.
 * Uses the shared altitudeToColor utility for consistent coloring across the app.
 * Segments with the same color are batched into single Polylines for performance.
 * Downsamples tracks > 500 points to prevent rendering bottlenecks.
 */
export function FlightTrackLine({ points }: Props) {
  const segments = useMemo(() => {
    const sampled = downsample(points);
    if (sampled.length < 2) return [];

    const result: { positions: [number, number][]; color: string }[] = [];
    let currentColor = '';
    let currentPositions: [number, number][] = [];

    for (let i = 0; i < sampled.length - 1; i++) {
      const a = sampled[i];
      const b = sampled[i + 1];
      const avgAlt = (a.altitudeFt + b.altitudeFt) / 2;
      const color = altitudeToColor(avgAlt);

      if (color === currentColor && currentPositions.length > 0) {
        currentPositions.push([b.lat, b.lon]);
      } else {
        if (currentPositions.length > 0) {
          result.push({ positions: currentPositions, color: currentColor });
        }
        currentColor = color;
        currentPositions = [[a.lat, a.lon], [b.lat, b.lon]];
      }
    }
    if (currentPositions.length > 0) {
      result.push({ positions: currentPositions, color: currentColor });
    }

    return result;
  }, [points]);

  if (segments.length === 0) return null;

  return (
    <>
      {segments.map((seg, i) => (
        <Polyline
          key={`track-${i}-${seg.color}`}
          positions={seg.positions}
          pathOptions={{
            color: seg.color,
            weight: 3,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      ))}
    </>
  );
}
