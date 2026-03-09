import { useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { fetchLandPolygons, type LandPolygon } from './geo-data';
import { latLonToVector3 } from './utils';

const GLOBE_RADIUS = 1.001; // slightly above ocean sphere

export function ContinentMesh() {
  const [polygons, setPolygons] = useState<LandPolygon[]>([]);

  useEffect(() => {
    fetchLandPolygons().then(setPolygons);
  }, []);

  const geometry = useMemo(() => {
    if (polygons.length === 0) return null;

    const positions: number[] = [];
    const indices: number[] = [];

    for (const poly of polygons) {
      const ring = poly.rings[0]; // outer ring only
      if (!ring || ring.length < 3) continue;

      // Compute centroid
      let cLat = 0, cLon = 0;
      for (const [lon, lat] of ring) {
        cLon += lon;
        cLat += lat;
      }
      cLon /= ring.length;
      cLat /= ring.length;

      const centroid = latLonToVector3(cLat, cLon, GLOBE_RADIUS);
      const centroidIdx = positions.length / 3;
      positions.push(centroid.x, centroid.y, centroid.z);

      // Add ring vertices
      const ringStartIdx = centroidIdx + 1;
      for (const [lon, lat] of ring) {
        const v = latLonToVector3(lat, lon, GLOBE_RADIUS);
        positions.push(v.x, v.y, v.z);
      }

      // Fan triangulation from centroid
      for (let i = 0; i < ring.length - 1; i++) {
        indices.push(centroidIdx, ringStartIdx + i, ringStartIdx + i + 1);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [polygons]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry}>
      <meshLambertMaterial
        color="#1a1d2e"
        flatShading
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
