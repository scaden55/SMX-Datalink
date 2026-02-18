/**
 * Formats a decimal degrees value as DMS (e.g., N 39°51'42")
 */
export function formatLatLon(lat: number, lon: number): { lat: string; lon: string } {
  const toDMS = (value: number, posChar: string, negChar: string): string => {
    const dir = value >= 0 ? posChar : negChar;
    const abs = Math.abs(value);
    const d = Math.floor(abs);
    const m = Math.floor((abs - d) * 60);
    const s = Math.floor(((abs - d) * 60 - m) * 60);
    return `${dir} ${d}\u00B0${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}"`;
  };

  return {
    lat: toDMS(lat, 'N', 'S'),
    lon: toDMS(lon, 'E', 'W'),
  };
}

/**
 * Formats altitude with FL prefix for high altitudes.
 */
export function formatAltitude(feet: number): string {
  if (feet >= 18000) {
    return `FL${Math.round(feet / 100)}`;
  }
  return `${Math.round(feet).toLocaleString()} ft`;
}

/**
 * Formats a number with fixed decimals and a unit suffix.
 */
export function formatValue(value: number, decimals: number, unit: string): string {
  return `${value.toFixed(decimals)} ${unit}`;
}

/**
 * Formats seconds since midnight as HH:MM:SSz (Zulu).
 */
export function formatZulu(seconds: number): string {
  const h = Math.floor(seconds / 3600) % 24;
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}z`;
}

/**
 * Formats a frequency in MHz (e.g., 118.000).
 */
export function formatFrequency(mhz: number): string {
  return mhz.toFixed(3);
}

/**
 * Formats transponder code as 4-digit octal.
 */
export function formatSquawk(code: number): string {
  return code.toString(8).padStart(4, '0');
}

/**
 * Formats a heading value (0-360).
 */
export function formatHeading(degrees: number): string {
  return `${Math.round(degrees).toString().padStart(3, '0')}\u00B0`;
}
