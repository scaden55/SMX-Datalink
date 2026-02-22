/**
 * Aviation-specific formatting utilities.
 * Used throughout the ACARS UI for consistent data display.
 */

/** Format a Date to Zulu time string: "HH:MMZ" */
export function formatZulu(date: Date | string | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '--:--Z';
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}Z`;
}

/** Format a Date to full Zulu time with seconds: "HH:MM:SSZ" */
export function formatZuluFull(date: Date | string | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '--:--:--Z';
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}Z`;
}

/** Ensure ICAO code is uppercase and trimmed (e.g., " kjfk " → "KJFK") */
export function formatICAO(code: string | undefined): string {
  if (!code) return '----';
  return code.trim().toUpperCase();
}

/** Format latitude/longitude in degrees-minutes notation (e.g., "N40°38.9'") */
export function formatLatLon(lat: number, lon: number): string {
  const fmtCoord = (value: number, pos: string, neg: string) => {
    const dir = value >= 0 ? pos : neg;
    const abs = Math.abs(value);
    const deg = Math.floor(abs);
    const min = ((abs - deg) * 60).toFixed(1);
    return `${dir}${deg}°${min}'`;
  };

  return `${fmtCoord(lat, 'N', 'S')} ${fmtCoord(lon, 'E', 'W')}`;
}

/** Format flight level (e.g., 35000 → "FL350") */
export function formatFlightLevel(altitudeFt: number): string {
  return `FL${Math.round(altitudeFt / 100).toString().padStart(3, '0')}`;
}

/** Format weight in lbs with comma separator (e.g., 145230 → "145,230") */
export function formatWeight(lbs: number | undefined): string {
  if (lbs === undefined || lbs === null) return '—';
  return Math.round(lbs).toLocaleString('en-US');
}

/** Format duration in HH:MM (e.g., 185 minutes → "3:05") */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}
