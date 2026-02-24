/**
 * Haversine distance between two lat/lon points in nautical miles.
 * Shared utility used by schedule, charter-generator, and vatsim-events services.
 */
export function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065; // Earth radius in nautical miles
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Returns a bounding box (min/max lat/lon) for a given center point and radius in NM.
 * Used as a cheap pre-filter before computing exact haversine distances.
 */
export function boundingBox(lat: number, lon: number, radiusNm: number): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  const degPerNm = 1 / 60; // 1 degree of latitude ≈ 60 NM
  const latDelta = radiusNm * degPerNm;
  const lonDelta = radiusNm * degPerNm / Math.cos(lat * Math.PI / 180);
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLon: lon - lonDelta,
    maxLon: lon + lonDelta,
  };
}
