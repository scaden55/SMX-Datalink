/**
 * Calculates great-circle distance between two points in nautical miles.
 */
export function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065; // Earth radius in nautical miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calculates ETE in seconds given distance (nm) and ground speed (knots).
 */
export function calcETE(distanceNm: number, groundSpeedKts: number): number | null {
  if (groundSpeedKts < 1) return null;
  return (distanceNm / groundSpeedKts) * 3600;
}

/**
 * Calculates ETA as ISO string given ETE in seconds.
 */
export function calcETA(eteSeconds: number | null): string | null {
  if (eteSeconds === null) return null;
  return new Date(Date.now() + eteSeconds * 1000).toISOString();
}

/**
 * Estimates fuel remaining at destination in pounds.
 */
export function fuelAtDestination(
  currentFuelLbs: number,
  fuelFlowLbsPerHour: number,
  eteSeconds: number | null,
): number | null {
  if (eteSeconds === null || fuelFlowLbsPerHour <= 0) return null;
  const eteHours = eteSeconds / 3600;
  return currentFuelLbs - fuelFlowLbsPerHour * eteHours;
}

/**
 * Calculates top-of-descent distance from destination (3-degree glidepath).
 */
export function topOfDescent(currentAltFt: number, targetAltFt: number): number {
  const altDiff = currentAltFt - targetAltFt;
  if (altDiff <= 0) return 0;
  return altDiff / 300; // 300 ft per nm (approx 3-degree path)
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
