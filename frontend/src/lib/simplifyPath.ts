/**
 * Ramer-Douglas-Peucker line simplification for geographic paths.
 *
 * Removes points that don't meaningfully deviate from the overall path,
 * eliminating GPS jitter and sim coordinate noise while preserving
 * actual turns and route shape.
 *
 * Epsilon is in degrees — 0.0003 ≈ 33m tolerance, good for flight paths.
 */

interface GeoPoint {
  lat: number;
  lon: number;
}

/** Perpendicular distance from point P to line segment A→B (in degrees). */
function perpendicularDistance(p: GeoPoint, a: GeoPoint, b: GeoPoint): number {
  const dx = b.lon - a.lon;
  const dy = b.lat - a.lat;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    // A and B are the same point
    const ex = p.lon - a.lon;
    const ey = p.lat - a.lat;
    return Math.sqrt(ex * ex + ey * ey);
  }

  // Project P onto line A→B, clamped to segment
  const t = Math.max(0, Math.min(1, ((p.lon - a.lon) * dx + (p.lat - a.lat) * dy) / lenSq));
  const projLon = a.lon + t * dx;
  const projLat = a.lat + t * dy;
  const ex = p.lon - projLon;
  const ey = p.lat - projLat;
  return Math.sqrt(ex * ex + ey * ey);
}

/**
 * Iterative Ramer-Douglas-Peucker simplification.
 * Avoids stack overflow for very long tracks by using an explicit stack.
 */
export function simplifyPath<T extends GeoPoint>(points: T[], epsilon: number): T[] {
  if (points.length <= 2) return points;

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  // Explicit stack of [startIndex, endIndex]
  const stack: [number, number][] = [[0, points.length - 1]];

  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    if (end - start < 2) continue;

    let maxDist = 0;
    let maxIdx = start;

    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDistance(points[i], points[start], points[end]);
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }

    if (maxDist > epsilon) {
      keep[maxIdx] = 1;
      stack.push([start, maxIdx]);
      stack.push([maxIdx, end]);
    }
  }

  return points.filter((_, i) => keep[i]);
}
