import { eclipse } from '@versatiles/style';
import type { StyleSpecification } from 'maplibre-gl';

/**
 * Generate a VersaTiles eclipse dark style customized
 * to match the SMA ACARS deep indigo design system.
 *
 * Palette reference (design tokens):
 *   --surface-0: #030726   (app bg / ocean)
 *   --surface-1: #111532   (panels)
 *   --surface-2: #181D3E   (cards, inputs)
 *   --surface-3: #1F2549   (elevated)
 *   --accent:    #4F6CCD
 */

// ── Color map ────────────────────────────────────────────────
// Neutral gray palette — no blue tint, clear land/ocean contrast
const CLR_OCEAN      = '#1D242F';   // app bg (--surface-0)
const CLR_LAND       = '#090A10';   // true neutral charcoal
const CLR_LAND_USE   = '#090A10';   // land-use fills
const CLR_WATER_LINE = '#1D242F';   // rivers, canals
const CLR_WATER_AREA = '#1D242F';   // lakes, reservoirs
const CLR_BORDER     = '#282f46';   // country borders — neutral gray
const CLR_BORDER_ST  = '#21273b';   // state borders
const CLR_ROAD       = '#0d0e16';   // major roads
const CLR_ROAD_OUT   = '#313A4A';   // road outlines
const CLR_BUILDING   = '#1a2136';   // buildings
const CLR_LABEL      = '#697785';   // place labels — true neutral
const CLR_LABEL_HALO = '#171b27';   // label halo

// Paint overrides keyed by layer id prefix or exact id
const FILL_OVERRIDES: Record<string, string> = {
  'background':       CLR_LAND,
  'water-ocean':      CLR_OCEAN,
  'water-area':       CLR_WATER_AREA,
  'water-area-river': CLR_WATER_AREA,
  'water-area-small': CLR_WATER_AREA,
  'land-glacier':     CLR_LAND,
  'land-rock':        CLR_LAND,
  'land-sand':        CLR_LAND,
  'land-wetland':     CLR_LAND,
  'land-leisure':     CLR_LAND_USE,
  'land-forest':      CLR_LAND_USE,
  'land-grass':       CLR_LAND_USE,
  'land-vegetation':  CLR_LAND_USE,
  'land-park':        CLR_LAND_USE,
  'land-garden':      CLR_LAND_USE,
  'land-agriculture': CLR_LAND_USE,
  'land-commercial':  CLR_LAND_USE,
  'land-industrial':  CLR_LAND_USE,
  'land-residential': CLR_LAND_USE,
  'land-burial':      CLR_LAND_USE,
  'land-waste':       CLR_LAND_USE,
  'building':         CLR_BUILDING,
  'building:outline': CLR_BUILDING,
  'airport-area':     '#0c0d12',
};

/** Scale a line-width value (number or zoom stops object) by a factor */
function scaleLineWidth(width: unknown, factor: number): unknown {
  if (typeof width === 'number') return width * factor;
  if (typeof width === 'object' && width !== null && 'stops' in (width as any)) {
    return {
      ...(width as any),
      stops: (width as any).stops.map(([z, w]: [number, number]) => [z, w * factor]),
    };
  }
  return width;
}

export function getMapStyle(): StyleSpecification {
  // Must pass baseUrl explicitly — in the browser @versatiles/style defaults
  // to document.location.origin, which resolves tiles/sprites to localhost.
  const style = eclipse({
    language: 'en',
    baseUrl: 'https://tiles.versatiles.org',
  }) as StyleSpecification;

  // Override glyphs to a reliable CDN (VersaTiles CDN glyphs can be unreliable)
  style.glyphs = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf';

  if (!style.layers) return style;

  for (const layer of style.layers) {
    const id = layer.id;
    const paint = (layer as any).paint ?? {};

    // ── Fill layers ──────────────────────────────────────────
    if (layer.type === 'fill' || layer.type === 'background') {
      const colorKey = layer.type === 'background' ? 'background-color' : 'fill-color';
      const override = FILL_OVERRIDES[id];
      if (override) {
        paint[colorKey] = override;
        (layer as any).paint = paint;
      }
    }

    // ── Water lines (rivers, canals, streams, ditches) ───────
    if (layer.type === 'line' && id.startsWith('water-')) {
      paint['line-color'] = CLR_WATER_LINE;
      (layer as any).paint = paint;
    }

    // ── Boundaries — thin + muted ─────────────────────────────
    if (id.startsWith('boundary-country')) {
      if (layer.type === 'line') {
        paint['line-color'] = CLR_BORDER;
        if (id.endsWith(':outline')) {
          paint['line-width'] = scaleLineWidth(paint['line-width'], 0.3);
          paint['line-opacity'] = 0.3;
        } else {
          paint['line-width'] = scaleLineWidth(paint['line-width'], 0.4);
        }
        (layer as any).paint = paint;
      }
    }
    if (id.startsWith('boundary-state')) {
      if (layer.type === 'line') {
        paint['line-color'] = CLR_BORDER_ST;
        if (id.endsWith(':outline')) {
          paint['line-width'] = scaleLineWidth(paint['line-width'], 0.3);
          paint['line-opacity'] = 0.3;
        } else {
          paint['line-width'] = scaleLineWidth(paint['line-width'], 0.4);
        }
        (layer as any).paint = paint;
      }
    }

    // ── Roads & streets — mute colors + thin widths ───────────
    if (layer.type === 'line' && (
      id.startsWith('street-') || id.startsWith('tunnel-street-') || id.startsWith('bridge-street-')
    )) {
      if (id.endsWith(':outline')) {
        paint['line-color'] = CLR_ROAD_OUT;
      } else {
        paint['line-color'] = CLR_ROAD;
      }
      // Halve road widths
      if (paint['line-width']) {
        paint['line-width'] = scaleLineWidth(paint['line-width'], 0.5);
      }
      (layer as any).paint = paint;
    }

    // ── Airport ground detail ──────────────────────────────────
    if (layer.type === 'line' && id.startsWith('airport-')) {
      if (id === 'airport-runway:outline') {
        paint['line-color'] = '#2a2a30';       // dark gray runway edge
      } else if (id === 'airport-runway') {
        paint['line-color'] = '#1e1e24';        // dark gray runway surface
      } else if (id === 'airport-taxiway:outline') {
        paint['line-color'] = '#8a7a40';        // tan/yellow taxiway edge
      } else if (id === 'airport-taxiway') {
        paint['line-color'] = '#3a3528';        // dark taxiway surface
      }
      (layer as any).paint = paint;
    }

    // ── Transport (rail, tram, etc.) ─────────────────────────
    if (layer.type === 'line' && (
      id.startsWith('transport-') || id.startsWith('tunnel-transport-') || id.startsWith('bridge-transport-')
    )) {
      paint['line-color'] = CLR_ROAD_OUT;
      (layer as any).paint = paint;
    }

    // ── Labels — desaturated indigo ──────────────────────────
    if (layer.type === 'symbol' && id.startsWith('label-')) {
      if (paint['text-color']) {
        paint['text-color'] = CLR_LABEL;
      }
      if (paint['text-halo-color']) {
        paint['text-halo-color'] = CLR_LABEL_HALO;
      }
      (layer as any).paint = paint;
    }
  }

  return style;
}
