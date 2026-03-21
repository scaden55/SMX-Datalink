/**
 * Aircraft icon mapping — maps ICAO type codes to SVG silhouettes.
 *
 * 179 type-specific SVGs from RexKramer1/AircraftShapesSVG provide
 * per-aircraft silhouettes (B738, A320, C172, etc.). When no exact
 * match exists, falls back to 11 generic category shapes.
 *
 * Each type has a size coefficient (relative to a standard 30px base)
 * that keeps wide-bodies visually larger than Cessnas on the map.
 */

// ── Category SVG imports (fallback when no type-specific shape) ──

import narrowbodySvg from '../assets/aircraft/narrowbody.svg?raw';
import widebodySvg from '../assets/aircraft/widebody.svg?raw';
import heavySvg from '../assets/aircraft/heavy.svg?raw';
import regionalSvg from '../assets/aircraft/regional.svg?raw';
import turbopropSvg from '../assets/aircraft/turboprop.svg?raw';
import bizjetSvg from '../assets/aircraft/bizjet.svg?raw';
import gaSingleSvg from '../assets/aircraft/ga-single.svg?raw';
import gaTwinSvg from '../assets/aircraft/ga-twin.svg?raw';
import helicopterSvg from '../assets/aircraft/helicopter.svg?raw';
import fighterSvg from '../assets/aircraft/fighter.svg?raw';
import genericSvg from '../assets/aircraft/generic.svg?raw';

// ── Type-specific SVGs (179 silhouettes, eagerly loaded) ─────────

const typeShapeModules = import.meta.glob<string>('@aircraft-shapes/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
});

/** Map of ICAO code → raw SVG string, e.g. "B738" → "<svg ...>" */
const TYPE_SHAPES: Record<string, string> = {};
for (const [path, svg] of Object.entries(typeShapeModules)) {
  // Path looks like "/@aircraft-shapes/B738.svg" or similar
  const match = path.match(/\/([^/]+)\.svg$/);
  if (match) {
    TYPE_SHAPES[match[1].toUpperCase()] = svg;
  }
}

// ── Types ────────────────────────────────────────────────────────

export type AircraftCategory =
  | 'narrowbody'
  | 'widebody'
  | 'heavy'
  | 'regional'
  | 'turboprop'
  | 'bizjet'
  | 'ga-single'
  | 'ga-twin'
  | 'helicopter'
  | 'fighter'
  | 'generic';

export interface AircraftIconInfo {
  category: AircraftCategory;
  /** Raw SVG markup string (uses fill="currentColor") */
  svgRaw: string;
  /** Size coefficient — multiply by base (30) then clamp to [12, 38] */
  sizeCoef: number;
}

// ── Category definitions ─────────────────────────────────────────

const CATEGORIES: Record<AircraftCategory, { svgRaw: string; sizeCoef: number }> = {
  'heavy':      { svgRaw: heavySvg,      sizeCoef: 1.30 },
  'widebody':   { svgRaw: widebodySvg,   sizeCoef: 1.00 },
  'narrowbody': { svgRaw: narrowbodySvg, sizeCoef: 0.70 },
  'regional':   { svgRaw: regionalSvg,   sizeCoef: 0.55 },
  'bizjet':     { svgRaw: bizjetSvg,     sizeCoef: 0.50 },
  'turboprop':  { svgRaw: turbopropSvg,  sizeCoef: 0.50 },
  'ga-twin':    { svgRaw: gaTwinSvg,     sizeCoef: 0.30 },
  'ga-single':  { svgRaw: gaSingleSvg,   sizeCoef: 0.22 },
  'helicopter': { svgRaw: helicopterSvg, sizeCoef: 0.25 },
  'fighter':    { svgRaw: fighterSvg,    sizeCoef: 0.35 },
  'generic':    { svgRaw: genericSvg,    sizeCoef: 0.55 },
};

// ── ICAO type code → category mapping ────────────────────────────
// Covers 200+ common VATSIM aircraft types.

const TYPE_MAP: Record<string, AircraftCategory> = {
  // ─── Super-heavy / 4-engine ────────────────────────────
  A124: 'heavy', A225: 'heavy',
  A380: 'heavy', A388: 'heavy', A389: 'heavy',
  B741: 'heavy', B742: 'heavy', B743: 'heavy', B744: 'heavy', B748: 'heavy',
  A340: 'heavy', A342: 'heavy', A343: 'heavy', A345: 'heavy', A346: 'heavy',
  IL96: 'heavy', IL86: 'heavy',
  C5M: 'heavy', C5: 'heavy',

  // ─── Wide-body twin/tri ────────────────────────────────
  A300: 'widebody', A306: 'widebody', A30B: 'widebody', A30F: 'widebody',
  A310: 'widebody', A3ST: 'widebody',
  A330: 'widebody', A332: 'widebody', A333: 'widebody', A338: 'widebody', A339: 'widebody',
  A350: 'widebody', A35K: 'widebody', A359: 'widebody',
  B762: 'widebody', B763: 'widebody', B764: 'widebody',
  B772: 'widebody', B773: 'widebody', B77L: 'widebody', B77W: 'widebody', B779: 'widebody',
  B778: 'widebody', B788: 'widebody', B789: 'widebody', B78X: 'widebody',
  MD11: 'widebody', DC10: 'widebody', L101: 'widebody',
  IL62: 'widebody', IL76: 'widebody',
  C17: 'widebody',

  // ─── Narrow-body ───────────────────────────────────────
  A318: 'narrowbody', A319: 'narrowbody', A320: 'narrowbody', A321: 'narrowbody',
  A19N: 'narrowbody', A20N: 'narrowbody', A21N: 'narrowbody',
  B731: 'narrowbody', B732: 'narrowbody', B733: 'narrowbody', B734: 'narrowbody',
  B735: 'narrowbody', B736: 'narrowbody', B737: 'narrowbody', B738: 'narrowbody',
  B739: 'narrowbody', B37M: 'narrowbody', B38M: 'narrowbody', B39M: 'narrowbody',
  B752: 'narrowbody', B753: 'narrowbody',
  B712: 'narrowbody', B721: 'narrowbody', B722: 'narrowbody',
  MD80: 'narrowbody', MD81: 'narrowbody', MD82: 'narrowbody', MD83: 'narrowbody',
  MD87: 'narrowbody', MD88: 'narrowbody', MD90: 'narrowbody',
  DC9: 'narrowbody', DC87: 'narrowbody',
  B461: 'narrowbody', B462: 'narrowbody', B463: 'narrowbody',
  RJ70: 'narrowbody', RJ85: 'narrowbody', RJ1H: 'narrowbody',
  T204: 'narrowbody', T134: 'narrowbody', T154: 'narrowbody',
  C130: 'narrowbody', C160: 'narrowbody',
  SU95: 'narrowbody', AN24: 'narrowbody',
  A400: 'narrowbody',

  // ─── Regional jets ─────────────────────────────────────
  CRJ1: 'regional', CRJ2: 'regional', CRJ5: 'regional',
  CRJ7: 'regional', CRJ9: 'regional', CRJX: 'regional',
  E170: 'regional', E175: 'regional', E190: 'regional', E195: 'regional',
  E75L: 'regional', E75S: 'regional', E290: 'regional', E295: 'regional',
  E135: 'regional', E145: 'regional', E120: 'regional',
  F70: 'regional', F100: 'regional', F28: 'regional',
  ARJ: 'regional', SF34: 'regional',

  // ─── Turboprops ────────────────────────────────────────
  DH8A: 'turboprop', DH8B: 'turboprop', DH8C: 'turboprop', DH8D: 'turboprop',
  AT43: 'turboprop', AT45: 'turboprop', AT72: 'turboprop', AT73: 'turboprop',
  AT75: 'turboprop', AT76: 'turboprop', ATR: 'turboprop',
  JS31: 'turboprop', JS32: 'turboprop', JS41: 'turboprop',
  SB20: 'turboprop', SW4: 'turboprop', SW3: 'turboprop',
  AN26: 'turboprop', AN12: 'turboprop', AN32: 'turboprop',
  L410: 'turboprop', B190: 'turboprop', B350: 'turboprop',
  C208: 'turboprop', C212: 'turboprop', CN35: 'turboprop',
  DHC6: 'turboprop', DHC7: 'turboprop',
  PC12: 'turboprop', PC21: 'turboprop', P180: 'turboprop',
  TBM7: 'turboprop', TBM8: 'turboprop', TBM9: 'turboprop',

  // ─── Business jets ─────────────────────────────────────
  GL5T: 'bizjet', GL7T: 'bizjet', GLF3: 'bizjet', GLF4: 'bizjet',
  GLF5: 'bizjet', GLF6: 'bizjet', GLEX: 'bizjet',
  C25A: 'bizjet', C25B: 'bizjet', C25C: 'bizjet', C25M: 'bizjet',
  C500: 'bizjet', C510: 'bizjet', C525: 'bizjet', C550: 'bizjet',
  C560: 'bizjet', C56X: 'bizjet', C650: 'bizjet', C680: 'bizjet',
  C700: 'bizjet', C750: 'bizjet',
  CL30: 'bizjet', CL35: 'bizjet', CL60: 'bizjet',
  E35L: 'bizjet', E50P: 'bizjet', E545: 'bizjet', E550: 'bizjet',
  E55P: 'bizjet',
  FA10: 'bizjet', FA20: 'bizjet', FA50: 'bizjet', FA7X: 'bizjet',
  FA8X: 'bizjet', FA6X: 'bizjet', F900: 'bizjet', F2TH: 'bizjet',
  LJ25: 'bizjet', LJ31: 'bizjet', LJ35: 'bizjet', LJ40: 'bizjet',
  LJ45: 'bizjet', LJ60: 'bizjet', LJ70: 'bizjet', LJ75: 'bizjet',
  H25B: 'bizjet', H25C: 'bizjet', HA4T: 'bizjet',
  PRM1: 'bizjet', PC24: 'bizjet', BE40: 'bizjet',
  EA50: 'bizjet', ASTR: 'bizjet', G150: 'bizjet', G280: 'bizjet',
  GALX: 'bizjet',

  // ─── GA single-engine ──────────────────────────────────
  C150: 'ga-single', C152: 'ga-single', C162: 'ga-single',
  C172: 'ga-single', C177: 'ga-single', C182: 'ga-single',
  C185: 'ga-single', C206: 'ga-single', C210: 'ga-single',
  PA18: 'ga-single', PA28: 'ga-single', PA32: 'ga-single',
  PA38: 'ga-single', PA46: 'ga-single',
  SR20: 'ga-single', SR22: 'ga-single', SF50: 'ga-single',
  DA20: 'ga-single', DA40: 'ga-single',
  DR40: 'ga-single', RV7: 'ga-single', RV8: 'ga-single',
  M20P: 'ga-single', M20T: 'ga-single',
  AA5: 'ga-single', P28A: 'ga-single', P28B: 'ga-single',
  P28R: 'ga-single', P28T: 'ga-single',
  BE23: 'ga-single', BE33: 'ga-single', BE35: 'ga-single', BE36: 'ga-single',
  TB20: 'ga-single', TB21: 'ga-single',

  // ─── GA twin-engine ────────────────────────────────────
  PA34: 'ga-twin', PA44: 'ga-twin', PA31: 'ga-twin',
  C310: 'ga-twin', C340: 'ga-twin', C402: 'ga-twin', C414: 'ga-twin',
  C421: 'ga-twin',
  BE55: 'ga-twin', BE58: 'ga-twin', BE60: 'ga-twin', BE76: 'ga-twin',
  BE9L: 'ga-twin', BE99: 'ga-twin', B200: 'ga-twin',
  DA42: 'ga-twin', DA62: 'ga-twin',
  P68: 'ga-twin', DC3: 'ga-twin',

  // ─── Helicopters ───────────────────────────────────────
  R22: 'helicopter', R44: 'helicopter', R66: 'helicopter',
  EC20: 'helicopter', EC30: 'helicopter', EC35: 'helicopter',
  EC45: 'helicopter', EC55: 'helicopter', EC75: 'helicopter',
  H60: 'helicopter', H64: 'helicopter', H47: 'helicopter',
  S76: 'helicopter', S92: 'helicopter',
  A109: 'helicopter', A139: 'helicopter', A169: 'helicopter',
  AS50: 'helicopter', AS55: 'helicopter', AS65: 'helicopter',
  B06: 'helicopter', B06T: 'helicopter', B212: 'helicopter',
  B407: 'helicopter', B412: 'helicopter', B429: 'helicopter',
  B505: 'helicopter', BK17: 'helicopter',
  V22: 'helicopter', MI8: 'helicopter', MI24: 'helicopter',
  EH10: 'helicopter',

  // ─── Military fighters ─────────────────────────────────
  F14: 'fighter', F15: 'fighter', F16: 'fighter', F18: 'fighter',
  F18H: 'fighter', F18S: 'fighter',
  F22: 'fighter', F35: 'fighter', F4: 'fighter', F5: 'fighter',
  EUFI: 'fighter', RFAL: 'fighter', TOR: 'fighter',
  SU27: 'fighter', SU30: 'fighter', SU33: 'fighter', SU34: 'fighter',
  MG29: 'fighter', MG31: 'fighter',
  A10: 'fighter', B1: 'fighter', B2: 'fighter', B52: 'fighter',
  T38: 'fighter', T45: 'fighter', T6: 'fighter',
  E3CF: 'fighter', E6B: 'fighter', U2: 'fighter',
};

// ── Public API ───────────────────────────────────────────────────

const DEFAULT: AircraftIconInfo = {
  category: 'generic',
  ...CATEGORIES.generic,
};

/**
 * Resolve an ICAO aircraft type code to an icon + size.
 *
 * Resolution order:
 *  1. Exact match in 179 type-specific SVGs (B738.svg, A320.svg, etc.)
 *  2. Category fallback via TYPE_MAP (e.g. B37M → narrowbody)
 *  3. Generic silhouette
 */
export function getAircraftIcon(typeCode: string | null | undefined): AircraftIconInfo {
  if (!typeCode) return DEFAULT;

  // Normalize: uppercase, strip anything after "/" (e.g. "B738/L" → "B738")
  const code = typeCode.toUpperCase().split('/')[0].trim();
  if (!code) return DEFAULT;

  const category = TYPE_MAP[code] ?? 'generic';
  const sizeCoef = CATEGORIES[category].sizeCoef;

  // Try type-specific SVG first
  const typeSvg = TYPE_SHAPES[code];
  if (typeSvg) {
    return { category, svgRaw: typeSvg, sizeCoef };
  }

  // Fall back to category SVG
  return { category, svgRaw: CATEGORIES[category].svgRaw, sizeCoef };
}

/**
 * Compute the pixel size for a given icon at the standard base.
 * Clamped to [12, 38] so tiny GA aircraft remain clickable
 * and heavies don't dominate the map.
 */
export function getIconSize(info: AircraftIconInfo): number {
  const BASE = 30;
  const raw = BASE * info.sizeCoef;
  return Math.round(Math.max(12, Math.min(38, raw)));
}

/**
 * All available SVG URLs by category (for preloading / ground chart).
 */
export const AIRCRAFT_SVG_URLS: Record<AircraftCategory, string> = {
  narrowbody: narrowbodySvg,
  widebody: widebodySvg,
  heavy: heavySvg,
  regional: regionalSvg,
  turboprop: turbopropSvg,
  bizjet: bizjetSvg,
  'ga-single': gaSingleSvg,
  'ga-twin': gaTwinSvg,
  helicopter: helicopterSvg,
  fighter: fighterSvg,
  generic: genericSvg,
};
