import { useState, useEffect, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { Earcut } from 'three/src/extras/Earcut.js';
import { fetchLandPolygons, type LandPolygon } from './geo-data';
import { latLonToVector3 } from './utils';

const GLOBE_RADIUS = 1.0;
const LAND_COLOR = new THREE.Color('#181D3E');
const LAND_HOVER_COLOR = new THREE.Color('#1F2549');
const BORDER_COLOR = new THREE.Color('#4F6CCD');
const DEG2RAD = Math.PI / 180;

/**
 * Azimuthal equidistant projection centered on (cLat, cLon).
 * Projects [lon, lat] to [x, y] in a local 2D plane.
 * This eliminates antimeridian discontinuities because the projection
 * is continuous around the center point.
 */
function azimuthalProject(
  lon: number, lat: number,
  cLon: number, cLat: number,
): [number, number] {
  const φ = lat * DEG2RAD;
  const λ = lon * DEG2RAD;
  const φ0 = cLat * DEG2RAD;
  const λ0 = cLon * DEG2RAD;
  const cosφ = Math.cos(φ);
  const sinφ = Math.sin(φ);
  const cosφ0 = Math.cos(φ0);
  const sinφ0 = Math.sin(φ0);
  const dλ = λ - λ0;
  const cosDλ = Math.cos(dλ);

  const cosC = sinφ0 * sinφ + cosφ0 * cosφ * cosDλ;
  // Clamp to avoid NaN from acos
  const c = Math.acos(Math.max(-1, Math.min(1, cosC)));

  if (c < 1e-10) return [0, 0]; // at center

  const k = c / Math.sin(c);
  const x = k * cosφ * Math.sin(dλ);
  const y = k * (cosφ0 * sinφ - sinφ0 * cosφ * cosDλ);
  return [x, y];
}

/** Compute the centroid of the outer ring in lon/lat space, handling antimeridian. */
function polygonCentroid(rings: number[][][]): [number, number] {
  const outer = rings[0];
  if (!outer || outer.length === 0) return [0, 0];

  // Use vector averaging to handle antimeridian correctly
  let cx = 0, cy = 0, cz = 0;
  for (const [lon, lat] of outer) {
    const φ = lat * DEG2RAD;
    const λ = lon * DEG2RAD;
    cx += Math.cos(φ) * Math.cos(λ);
    cy += Math.cos(φ) * Math.sin(λ);
    cz += Math.sin(φ);
  }
  const n = outer.length;
  cx /= n; cy /= n; cz /= n;
  const cLat = Math.atan2(cz, Math.sqrt(cx * cx + cy * cy)) / DEG2RAD;
  const cLon = Math.atan2(cy, cx) / DEG2RAD;
  return [cLon, cLat];
}

/** Build a BufferGeometry for a single polygon using earcut triangulation. */
function buildPolygonGeometry(poly: LandPolygon): THREE.BufferGeometry | null {
  const outerRing = poly.rings[0];
  if (!outerRing || outerRing.length < 3) return null;

  // Compute polygon centroid for azimuthal projection
  const [cLon, cLat] = polygonCentroid(poly.rings);

  // Project all ring coords into azimuthal 2D space for earcut,
  // while keeping original lon/lat for 3D sphere projection
  const flatProjected: number[] = [];
  const originalCoords: [number, number][] = [];
  const holeIndices: number[] = [];

  for (const [lon, lat] of outerRing) {
    const [px, py] = azimuthalProject(lon, lat, cLon, cLat);
    flatProjected.push(px, py);
    originalCoords.push([lon, lat]);
  }

  for (let h = 1; h < poly.rings.length; h++) {
    const hole = poly.rings[h];
    if (!hole || hole.length < 3) continue;
    holeIndices.push(flatProjected.length / 2);
    for (const [lon, lat] of hole) {
      const [px, py] = azimuthalProject(lon, lat, cLon, cLat);
      flatProjected.push(px, py);
      originalCoords.push([lon, lat]);
    }
  }

  // Triangulate in the projected 2D space (no antimeridian issues)
  const rawIndices = Earcut.triangulate(flatProjected, holeIndices, 2);
  if (rawIndices.length === 0) return null;

  // Project original lon/lat to 3D sphere positions
  const totalPoints = originalCoords.length;
  const positions = new Float32Array(totalPoints * 3);
  const normals = new Float32Array(totalPoints * 3);

  for (let i = 0; i < totalPoints; i++) {
    const [lon, lat] = originalCoords[i];
    const v = latLonToVector3(lat, lon, GLOBE_RADIUS);
    positions[i * 3] = v.x;
    positions[i * 3 + 1] = v.y;
    positions[i * 3 + 2] = v.z;
    const len = v.length();
    normals[i * 3] = v.x / len;
    normals[i * 3 + 1] = v.y / len;
    normals[i * 3 + 2] = v.z / len;
  }

  const triIndices = Array.from(rawIndices);

  // Fix winding order so all triangles face outward
  for (let i = 0; i < triIndices.length; i += 3) {
    const ia = triIndices[i] * 3;
    const ib = triIndices[i + 1] * 3;
    const ic = triIndices[i + 2] * 3;

    const ax = positions[ib] - positions[ia];
    const ay = positions[ib + 1] - positions[ia + 1];
    const az = positions[ib + 2] - positions[ia + 2];
    const bx = positions[ic] - positions[ia];
    const by = positions[ic + 1] - positions[ia + 1];
    const bz = positions[ic + 2] - positions[ia + 2];
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;

    const dot = nx * normals[ia] + ny * normals[ia + 1] + nz * normals[ia + 2];
    if (dot < 0) {
      const tmp = triIndices[i + 1];
      triIndices[i + 1] = triIndices[i + 2];
      triIndices[i + 2] = tmp;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setIndex(triIndices);
  return geo;
}

interface ContinentPolyProps {
  geometry: THREE.BufferGeometry;
  hovered: boolean;
  onHover: () => void;
  onUnhover: () => void;
}

function ContinentPoly({ geometry, hovered, onHover, onUnhover }: ContinentPolyProps) {
  return (
    <mesh
      geometry={geometry}
      renderOrder={1}
      onPointerOver={onHover}
      onPointerOut={onUnhover}
    >
      <meshBasicMaterial
        color={hovered ? LAND_HOVER_COLOR : LAND_COLOR}
        side={THREE.FrontSide}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
  );
}

/**
 * Render continent polygons as individual 3D meshes on the globe.
 * Each polygon is hoverable with a subtle highlight effect.
 */
export function ContinentMesh() {
  const [polygons, setPolygons] = useState<LandPolygon[]>([]);
  const [hoveredIdx, setHoveredIdx] = useState(-1);

  useEffect(() => {
    fetchLandPolygons().then(setPolygons).catch(() => {});
  }, []);

  const geometries = useMemo(() => {
    return polygons.map(buildPolygonGeometry);
  }, [polygons]);

  const handleHover = useCallback((idx: number) => () => setHoveredIdx(idx), []);
  const handleUnhover = useCallback(() => setHoveredIdx(-1), []);

  if (geometries.length === 0) return null;

  return (
    <group>
      {/* Ocean sphere */}
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshBasicMaterial color="#030726" />
      </mesh>

      {/* Continent polygons */}
      {geometries.map((geo, i) =>
        geo ? (
          <ContinentPoly
            key={i}
            geometry={geo}
            hovered={i === hoveredIdx}
            onHover={handleHover(i)}
            onUnhover={handleUnhover}
          />
        ) : null,
      )}
    </group>
  );
}
