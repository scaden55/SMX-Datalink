/**
 * Aircraft icon system for admin maps — maps ICAO type codes to
 * type-specific SVG silhouettes from RexKramer1/AircraftShapesSVG.
 *
 * Uses import.meta.glob to eagerly load all 179 SVGs at build time.
 * Falls back to a simple generic silhouette if no match found.
 */

// ── Type-specific SVGs (179 silhouettes, eagerly loaded) ─────────

const typeShapeModules = import.meta.glob<string>('@aircraft-shapes/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
});

/** Map of ICAO code → raw SVG string */
const TYPE_SHAPES: Record<string, string> = {};
for (const [path, svg] of Object.entries(typeShapeModules)) {
  const match = path.match(/\/([^/]+)\.svg$/);
  if (match) {
    TYPE_SHAPES[match[1].toUpperCase()] = svg;
  }
}

// ── Generic fallback (simple plane silhouette) ───────────────────

const GENERIC_SVG = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 2C33 2 34 3 34 5L34 20L54 30C56 31 56 33 55 34L34 32L34 48
    L42 54C43 55 43 56 42 57L34 55L33 58C32.5 59 31.5 59 31 58L30 55
    L22 57C21 56 21 55 22 54L30 48L30 32L9 34C8 33 8 31 10 30L30 20
    L30 5C30 3 31 2 32 2Z" fill="currentColor" stroke="none"/>
</svg>`;

// ── Size coefficients by category ────────────────────────────────

type AircraftCategory = 'heavy' | 'widebody' | 'narrowbody' | 'regional' |
  'turboprop' | 'bizjet' | 'ga-single' | 'ga-twin' | 'helicopter' | 'fighter' | 'generic';

const SIZE_COEF: Record<AircraftCategory, number> = {
  heavy: 1.30, widebody: 1.00, narrowbody: 0.70, regional: 0.55,
  bizjet: 0.50, turboprop: 0.50, 'ga-twin': 0.30, 'ga-single': 0.22,
  helicopter: 0.25, fighter: 0.35, generic: 0.55,
};

const TYPE_MAP: Record<string, AircraftCategory> = {
  A124: 'heavy', A225: 'heavy', A380: 'heavy', A388: 'heavy', A389: 'heavy',
  B741: 'heavy', B742: 'heavy', B743: 'heavy', B744: 'heavy', B748: 'heavy',
  A340: 'heavy', A342: 'heavy', A343: 'heavy', A345: 'heavy', A346: 'heavy',
  C5M: 'heavy', C5: 'heavy',
  A300: 'widebody', A306: 'widebody', A310: 'widebody', A3ST: 'widebody',
  A330: 'widebody', A332: 'widebody', A333: 'widebody', A338: 'widebody', A339: 'widebody',
  A350: 'widebody', A35K: 'widebody', A359: 'widebody',
  B762: 'widebody', B763: 'widebody', B764: 'widebody',
  B772: 'widebody', B773: 'widebody', B77L: 'widebody', B77W: 'widebody', B779: 'widebody',
  B788: 'widebody', B789: 'widebody', B78X: 'widebody',
  MD11: 'widebody', DC10: 'widebody', IL62: 'widebody', IL76: 'widebody', C17: 'widebody',
  A318: 'narrowbody', A319: 'narrowbody', A320: 'narrowbody', A321: 'narrowbody',
  A19N: 'narrowbody', A20N: 'narrowbody', A21N: 'narrowbody',
  B731: 'narrowbody', B732: 'narrowbody', B733: 'narrowbody', B734: 'narrowbody',
  B735: 'narrowbody', B737: 'narrowbody', B738: 'narrowbody', B739: 'narrowbody',
  B37M: 'narrowbody', B38M: 'narrowbody', B39M: 'narrowbody',
  B752: 'narrowbody', B753: 'narrowbody', B712: 'narrowbody', B722: 'narrowbody',
  MD80: 'narrowbody', MD87: 'narrowbody', MD90: 'narrowbody', DC87: 'narrowbody',
  RJ85: 'narrowbody', T204: 'narrowbody', C130: 'narrowbody', C160: 'narrowbody',
  SU95: 'narrowbody', A400: 'narrowbody',
  CRJ2: 'regional', CRJ7: 'regional', CRJ9: 'regional', CRJX: 'regional',
  E170: 'regional', E175: 'regional', E190: 'regional', E195: 'regional',
  E290: 'regional', E295: 'regional', SF34: 'regional',
  DH8A: 'turboprop', DH8B: 'turboprop', DH8C: 'turboprop', DH8D: 'turboprop',
  AT45: 'turboprop', AT72: 'turboprop', AT75: 'turboprop',
  AN26: 'turboprop', AN12: 'turboprop', B190: 'turboprop', B350: 'turboprop',
  C208: 'turboprop', CN35: 'turboprop', PC12: 'turboprop', P180: 'turboprop',
  GL5T: 'bizjet', GLF6: 'bizjet', C25B: 'bizjet', C750: 'bizjet',
  E35L: 'bizjet', FA7X: 'bizjet', LJ35: 'bizjet',
  C172: 'ga-single', PA28: 'ga-single', PA46: 'ga-single', SR22: 'ga-single', P28A: 'ga-single',
  DA42: 'ga-twin', DC3: 'ga-twin',
  R44: 'helicopter', EC20: 'helicopter', EC35: 'helicopter', EC45: 'helicopter',
  H60: 'helicopter', H64: 'helicopter', H47: 'helicopter', AS65: 'helicopter',
  V22: 'helicopter', MI24: 'helicopter',
  F15: 'fighter', F16: 'fighter', F18: 'fighter', F22: 'fighter', F35: 'fighter',
  A10: 'fighter', B1: 'fighter', B52: 'fighter', EUFI: 'fighter', T38: 'fighter', U2: 'fighter',
};

// ── Public API ───────────────────────────────────────────────────

export interface AircraftIconResult {
  svgRaw: string;
  sizeCoef: number;
}

/**
 * Resolve an ICAO type code to an SVG + size coefficient.
 * Tries exact match first, falls back to generic plane silhouette.
 */
export function getAircraftIcon(typeCode: string | null | undefined): AircraftIconResult {
  if (!typeCode) return { svgRaw: GENERIC_SVG, sizeCoef: SIZE_COEF.generic };

  const code = typeCode.toUpperCase().split('/')[0].trim();
  if (!code) return { svgRaw: GENERIC_SVG, sizeCoef: SIZE_COEF.generic };

  const category = TYPE_MAP[code] ?? 'generic';
  const sizeCoef = SIZE_COEF[category];

  const typeSvg = TYPE_SHAPES[code];
  if (typeSvg) return { svgRaw: typeSvg, sizeCoef };

  return { svgRaw: GENERIC_SVG, sizeCoef };
}

/** Compute pixel size from coefficient. Base 30, clamped [12, 38]. */
export function getIconSize(sizeCoef: number): number {
  return Math.round(Math.max(12, Math.min(38, 30 * sizeCoef)));
}
