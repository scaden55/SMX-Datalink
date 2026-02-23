/**
 * Ray-casting point-in-polygon test.
 * Works on GeoJSON Polygon / MultiPolygon coordinate arrays.
 */
export function isPointInPolygon(
  lat: number,
  lon: number,
  geometry: GeoJSON.Geometry,
): boolean {
  if (geometry.type === 'Polygon') {
    return isInsideRings(lat, lon, geometry.coordinates);
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((poly) => isInsideRings(lat, lon, poly));
  }
  return false;
}

function isInsideRings(lat: number, lon: number, rings: number[][][]): boolean {
  if (!raycast(lat, lon, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (raycast(lat, lon, rings[i])) return false;
  }
  return true;
}

function raycast(lat: number, lon: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][1], yi = ring[i][0]; // lat, lon from [lon, lat]
    const xj = ring[j][1], yj = ring[j][0];
    if ((yi > lon) !== (yj > lon) && lat < ((xj - xi) * (lon - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function pilotsInAirspace<T extends { latitude: number; longitude: number }>(
  pilots: T[],
  feature: GeoJSON.Feature,
): T[] {
  return pilots.filter((p) => isPointInPolygon(p.latitude, p.longitude, feature.geometry));
}
