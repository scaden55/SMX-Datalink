/**
 * Maps altitude (feet) to a hex color using smooth linear interpolation.
 *
 * Gradient bands:
 *   0–1,000 ft     → #4a9eff (ground/taxi — light blue)
 *   1,000–5,000 ft → #4a9eff → #00d4aa (climb — teal)
 *   5,000–10,000   → #00d4aa → #00e676 (low cruise — green)
 *   10,000–25,000  → #00e676 → #ffeb3b (mid cruise — yellow)
 *   25,000–35,000  → #ffeb3b → #ff9800 (high cruise — orange)
 *   35,000+ ft     → #ff9800 → #f44336 (cruise/FL350+ — red)
 */

type RGB = [number, number, number];

const STOPS: [number, RGB][] = [
  [0,     [0x4a, 0x9e, 0xff]], // #4a9eff — ground
  [1000,  [0x4a, 0x9e, 0xff]], // #4a9eff — flat until 1k
  [5000,  [0x00, 0xd4, 0xaa]], // #00d4aa — teal
  [10000, [0x00, 0xe6, 0x76]], // #00e676 — green
  [25000, [0xff, 0xeb, 0x3b]], // #ffeb3b — yellow
  [35000, [0xff, 0x98, 0x00]], // #ff9800 — orange
  [45000, [0xf4, 0x43, 0x36]], // #f44336 — red
];

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function toHex(n: number): string {
  return n.toString(16).padStart(2, '0');
}

export function altitudeToColor(altitudeFt: number): string {
  if (altitudeFt <= STOPS[0][0]) {
    const [r, g, b] = STOPS[0][1];
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  for (let i = 1; i < STOPS.length; i++) {
    const [prevAlt, prevRgb] = STOPS[i - 1];
    const [nextAlt, nextRgb] = STOPS[i];

    if (altitudeFt <= nextAlt) {
      const t = (altitudeFt - prevAlt) / (nextAlt - prevAlt);
      const r = lerp(prevRgb[0], nextRgb[0], t);
      const g = lerp(prevRgb[1], nextRgb[1], t);
      const b = lerp(prevRgb[2], nextRgb[2], t);
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
  }

  // Above highest stop
  const [r, g, b] = STOPS[STOPS.length - 1][1];
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
