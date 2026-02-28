import { useMemo } from 'react';
import { Polyline } from 'react-leaflet';
import { altitudeToColor } from '@acars/shared';
import type { VatsimTrailPoint } from '../../stores/vatsimStore';
import { simplifyPath } from '../../lib/simplifyPath';

const RDP_EPSILON = 0.0003;

// ── Component ───────────────────────────────────────────────

interface Props {
  track: VatsimTrailPoint[];
}

/**
 * Renders a VATSIM pilot's flight trail as colored polyline segments.
 * Each segment is colored by the average altitude of its two endpoints
 * using the shared altitudeToColor gradient (blue→teal→green→yellow→orange→red).
 * Segments are batched by color to minimize React elements.
 */
export function PilotTrailLine({ track }: Props) {
  const segments = useMemo(() => {
    const simplified = simplifyPath(track, RDP_EPSILON);
    if (simplified.length < 2) return [];

    const result: { positions: [number, number][]; color: string }[] = [];
    let currentColor = '';
    let currentPositions: [number, number][] = [];

    for (let i = 0; i < simplified.length - 1; i++) {
      const a = simplified[i];
      const b = simplified[i + 1];
      const avgAlt = (a.alt + b.alt) / 2;
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
  }, [track]);

  if (segments.length === 0) return null;

  return (
    <>
      {segments.map((seg, i) => (
        <Polyline
          key={`${i}-${seg.color}`}
          positions={seg.positions}
          pathOptions={{
            color: seg.color,
            weight: 3,
            opacity: 0.85,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      ))}
    </>
  );
}
