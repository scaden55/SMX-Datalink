// @ts-expect-error — no types for topojson-client
import { feature } from 'topojson-client';

export interface LandPolygon {
  rings: number[][][]; // [lon, lat][] per ring
}

let cachedPolygons: LandPolygon[] | null = null;

/**
 * Fetch simplified world land polygons (110m Natural Earth).
 * Uses topojson-client's feature() which properly handles antimeridian stitching.
 */
export async function fetchLandPolygons(): Promise<LandPolygon[]> {
  if (cachedPolygons) return cachedPolygons;

  const response = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
  const topo = await response.json();

  // topojson-client.feature() properly decodes arcs AND handles antimeridian splitting
  const geojson = feature(topo, topo.objects.countries);
  const polygons: LandPolygon[] = [];

  for (const feat of (geojson as any).features) {
    const geom = feat.geometry;
    if (geom.type === 'Polygon') {
      polygons.push({ rings: geom.coordinates });
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        polygons.push({ rings: poly });
      }
    }
  }

  cachedPolygons = polygons;
  return polygons;
}
