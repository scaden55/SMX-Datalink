export interface LandPolygon {
  rings: number[][][]; // [lon, lat][] per ring
}

let cachedPolygons: LandPolygon[] | null = null;

/**
 * Fetch simplified world land polygons (110m Natural Earth).
 * Uses world-atlas TopoJSON, converts to simple coordinate arrays.
 */
export async function fetchLandPolygons(): Promise<LandPolygon[]> {
  if (cachedPolygons) return cachedPolygons;

  const response = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json');
  const topo = await response.json();

  // TopoJSON -> GeoJSON conversion (inline, no dependency needed)
  const land = topo.objects.land;
  const arcs: number[][][] = topo.arcs;
  const transform: { scale: number[]; translate: number[] } = topo.transform;

  // Decode arcs
  const decodedArcs: number[][][] = arcs.map((arc: number[][]) => {
    let x = 0, y = 0;
    return arc.map((point: number[]) => {
      x += point[0];
      y += point[1];
      return [
        x * transform.scale[0] + transform.translate[0],
        y * transform.scale[1] + transform.translate[1],
      ];
    });
  });

  // Convert topology to polygons
  const polygons: LandPolygon[] = [];

  function decodeRing(indices: number[]): number[][] {
    const coords: number[][] = [];
    for (const idx of indices) {
      const arc = idx < 0 ? [...decodedArcs[~idx]].reverse() : decodedArcs[idx];
      for (let i = coords.length > 0 ? 1 : 0; i < arc.length; i++) {
        coords.push(arc[i]);
      }
    }
    return coords;
  }

  interface TopoGeometry {
    type: string;
    arcs: number[][] | number[][][];
    geometries?: TopoGeometry[];
  }

  function processGeometry(geom: TopoGeometry) {
    if (geom.type === 'Polygon') {
      polygons.push({ rings: (geom.arcs as number[][]).map(decodeRing) });
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.arcs as number[][][]) {
        polygons.push({ rings: poly.map(decodeRing) });
      }
    }
  }

  if (land.type === 'GeometryCollection') {
    for (const geom of (land as TopoGeometry & { geometries: TopoGeometry[] }).geometries) {
      processGeometry(geom);
    }
  } else {
    processGeometry(land as TopoGeometry);
  }

  cachedPolygons = polygons;
  return polygons;
}
