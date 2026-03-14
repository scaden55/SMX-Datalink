import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
  useMemo,
  useCallback,
  Suspense,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Earcut } from 'three/src/extras/Earcut.js';

// ─── Constants ────────────────────────────────────────────────────

const GLOBE_RADIUS = 1.0;
const LAND_RADIUS = 1.005;
const OCEAN_COLOR = '#0a0f1e';
const LAND_COLOR = '#1a2744';
const LAND_HOVER_COLOR = '#243358';
const BORDER_COLOR = '#2a3f6f';

const AUTO_ROTATE_SPEED = 0.0008; // rad per frame
const RESUME_DELAY = 3000; // ms after mouseup to resume rotation
const INTRO_DURATION = 1.5; // seconds
const INTRO_START_Z = 5.0;
const INTRO_END_Z = 3.2;

const DEG2RAD = Math.PI / 180;

// ─── Types ────────────────────────────────────────────────────────

interface LandPolygon {
  rings: number[][][]; // [lon, lat][] per ring
}

export interface SMXGlobeRef {
  focusOn: (lat: number, lng: number, duration?: number) => void;
  addMarker: (lat: number, lng: number, options?: MarkerOptions) => string;
  addArc: (from: [number, number], to: [number, number], options?: ArcOptions) => string;
  clearAll: () => void;
}

export interface MarkerOptions {
  color?: string;
  size?: number;
  label?: string;
}

export interface ArcOptions {
  color?: string;
  width?: number;
  dashLength?: number;
}

interface SMXGlobeProps {
  width?: string | number;
  height?: string | number;
}

// ─── Geo helpers ──────────────────────────────────────────────────

function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * DEG2RAD;
  const theta = (lon + 180) * DEG2RAD;
  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

// ─── TopoJSON decoder ─────────────────────────────────────────────

interface TopoGeometry {
  type: string;
  arcs: number[][] | number[][][];
  geometries?: TopoGeometry[];
}

interface TopoJSON {
  arcs: number[][][];
  transform: { scale: number[]; translate: number[] };
  objects: Record<string, TopoGeometry & { geometries?: TopoGeometry[] }>;
}

let geoCache: { land: LandPolygon[]; borders: number[][][] } | null = null;

async function fetchGeoData(): Promise<{ land: LandPolygon[]; borders: number[][][] }> {
  if (geoCache) return geoCache;

  const res = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
  const topo: TopoJSON = await res.json();

  const { arcs, transform } = topo;

  // Decode arcs with delta encoding
  const decodedArcs: number[][][] = arcs.map((arc) => {
    let x = 0, y = 0;
    return arc.map((pt) => {
      x += pt[0];
      y += pt[1];
      return [
        x * transform.scale[0] + transform.translate[0],
        y * transform.scale[1] + transform.translate[1],
      ];
    });
  });

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

  // Extract land polygons from individual countries (not merged land)
  // Using countries gives smaller polygons that earcut triangulates correctly
  const landPolygons: LandPolygon[] = [];
  function processGeom(geom: TopoGeometry) {
    if (geom.type === 'Polygon') {
      landPolygons.push({ rings: (geom.arcs as number[][]).map(decodeRing) });
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.arcs as number[][][]) {
        landPolygons.push({ rings: poly.map(decodeRing) });
      }
    }
  }

  const countriesObj = topo.objects.countries;
  if (countriesObj.type === 'GeometryCollection' && countriesObj.geometries) {
    for (const g of countriesObj.geometries) processGeom(g);
  } else {
    processGeom(countriesObj);
  }

  // Extract border line segments from country boundaries
  const borderRings: number[][][] = [];
  if (countriesObj.type === 'GeometryCollection' && countriesObj.geometries) {
    for (const g of countriesObj.geometries) {
      if (g.type === 'Polygon') {
        borderRings.push(decodeRing((g.arcs as number[][])[0]));
      } else if (g.type === 'MultiPolygon') {
        for (const poly of g.arcs as number[][][]) {
          borderRings.push(decodeRing(poly[0]));
        }
      }
    }
  }

  geoCache = { land: landPolygons, borders: borderRings };
  return geoCache;
}

// ─── Spherical subdivision ───────────────────────────────────────

const SUBDIV_PASSES = 3; // uniform passes — each triangle → 4 sub-triangles

/**
 * Uniformly subdivide ALL triangles, re-projecting midpoints onto the sphere.
 * Uniform subdivision avoids T-junction artifacts that occur when only some
 * triangles are subdivided (selective subdivision leaves gaps at shared edges).
 */
function subdivideSpherical(
  verts: number[],
  indices: number[],
  radius: number,
) {
  for (let pass = 0; pass < SUBDIV_PASSES; pass++) {
    const midCache = new Map<string, number>();
    const newIndices: number[] = [];

    function getMidpoint(a: number, b: number): number {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      const cached = midCache.get(key);
      if (cached !== undefined) return cached;

      const ax = verts[a * 3], ay = verts[a * 3 + 1], az = verts[a * 3 + 2];
      const bx = verts[b * 3], by = verts[b * 3 + 1], bz = verts[b * 3 + 2];
      let mx = (ax + bx) / 2, my = (ay + by) / 2, mz = (az + bz) / 2;
      const len = Math.sqrt(mx * mx + my * my + mz * mz);
      mx = (mx / len) * radius;
      my = (my / len) * radius;
      mz = (mz / len) * radius;

      const idx = verts.length / 3;
      verts.push(mx, my, mz);
      midCache.set(key, idx);
      return idx;
    }

    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i], i1 = indices[i + 1], i2 = indices[i + 2];
      const m01 = getMidpoint(i0, i1);
      const m12 = getMidpoint(i1, i2);
      const m20 = getMidpoint(i2, i0);
      newIndices.push(
        i0, m01, m20,
        m01, i1, m12,
        m20, m12, i2,
        m01, m12, m20,
      );
    }

    indices.length = 0;
    indices.push(...newIndices);
  }
}

// ─── Polygon geometry builder ─────────────────────────────────────

const WIDE_POLYGON_THRESHOLD = 60; // degrees — use fan triangulation above this

/**
 * Fan triangulation from centroid for wide polygons.
 * Creates small triangles radiating from center to each edge,
 * avoiding the huge interior triangles that earcut produces.
 */
function fanTriangulate(outerRing: number[][], radius: number) {
  // Compute centroid on sphere
  let cx = 0, cy = 0, cz = 0;
  for (const [lon, lat] of outerRing) {
    const v = latLonToVector3(lat, lon, radius);
    cx += v.x; cy += v.y; cz += v.z;
  }
  const clen = Math.sqrt(cx * cx + cy * cy + cz * cz);
  cx = (cx / clen) * radius;
  cy = (cy / clen) * radius;
  cz = (cz / clen) * radius;

  // Build vertices: centroid at index 0, ring points after
  const verts: number[] = [cx, cy, cz];
  const indices: number[] = [];

  for (const [lon, lat] of outerRing) {
    const v = latLonToVector3(lat, lon, radius);
    verts.push(v.x, v.y, v.z);
  }

  // Fan triangles from centroid (index 0) to each edge
  for (let i = 1; i < outerRing.length; i++) {
    const next = i + 1 <= outerRing.length ? (i % outerRing.length) + 1 || 1 : 1;
    indices.push(0, i, next === 0 ? 1 : next);
  }

  return { verts, indices };
}

function buildPolygonGeometry(poly: LandPolygon): THREE.BufferGeometry | null {
  const outerRing = poly.rings[0];
  if (!outerRing || outerRing.length < 3) return null;

  // Check longitude span to decide triangulation strategy
  let minLon = Infinity, maxLon = -Infinity;
  for (const [lon] of outerRing) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }
  const lonSpan = maxLon - minLon;

  let verts: number[];
  let triIndices: number[];

  if (lonSpan > WIDE_POLYGON_THRESHOLD) {
    // Wide polygon — use fan triangulation (no holes support, but works for wide countries)
    const fan = fanTriangulate(outerRing, LAND_RADIUS);
    verts = fan.verts;
    triIndices = fan.indices;
  } else {
    // Normal polygon — use earcut
    const flatCoords: number[] = [];
    const holeIndices: number[] = [];

    for (const [lon, lat] of outerRing) flatCoords.push(lon, lat);

    for (let h = 1; h < poly.rings.length; h++) {
      const hole = poly.rings[h];
      if (!hole || hole.length < 3) continue;
      holeIndices.push(flatCoords.length / 2);
      for (const [lon, lat] of hole) flatCoords.push(lon, lat);
    }

    const rawIndices = Earcut.triangulate(flatCoords, holeIndices, 2);
    if (rawIndices.length === 0) return null;

    // Filter antimeridian-crossing triangles
    triIndices = [];
    for (let i = 0; i < rawIndices.length; i += 3) {
      const lons = [
        flatCoords[rawIndices[i] * 2],
        flatCoords[rawIndices[i + 1] * 2],
        flatCoords[rawIndices[i + 2] * 2],
      ];
      const hasEast = lons.some((l) => l > 90);
      const hasWest = lons.some((l) => l < -90);
      if (!(hasEast && hasWest)) {
        triIndices.push(rawIndices[i], rawIndices[i + 1], rawIndices[i + 2]);
      }
    }
    if (triIndices.length === 0) return null;

    // Project vertices to sphere
    const totalPts = flatCoords.length / 2;
    verts = [];
    for (let i = 0; i < totalPts; i++) {
      const v = latLonToVector3(flatCoords[i * 2 + 1], flatCoords[i * 2], LAND_RADIUS);
      verts.push(v.x, v.y, v.z);
    }
  }

  // Subdivide large triangles so faces follow sphere curvature
  subdivideSpherical(verts, triIndices, LAND_RADIUS);

  // Build final arrays
  const vertCount = verts.length / 3;
  const positions = new Float32Array(verts);
  const normals = new Float32Array(vertCount * 3);

  for (let i = 0; i < vertCount; i++) {
    const x = verts[i * 3], y = verts[i * 3 + 1], z = verts[i * 3 + 2];
    const len = Math.sqrt(x * x + y * y + z * z);
    normals[i * 3] = x / len;
    normals[i * 3 + 1] = y / len;
    normals[i * 3 + 2] = z / len;
  }

  // Fix winding order — ensure outward-facing
  for (let i = 0; i < triIndices.length; i += 3) {
    const ia = triIndices[i] * 3;
    const ib = triIndices[i + 1] * 3;
    const ic = triIndices[i + 2] * 3;

    const ax = positions[ib] - positions[ia], ay = positions[ib + 1] - positions[ia + 1], az = positions[ib + 2] - positions[ia + 2];
    const bx = positions[ic] - positions[ia], by = positions[ic + 1] - positions[ia + 1], bz = positions[ic + 2] - positions[ia + 2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;

    if (nx * normals[ia] + ny * normals[ia + 1] + nz * normals[ia + 2] < 0) {
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

// ─── Border lines geometry ────────────────────────────────────────

function buildBorderLines(borderRings: number[][][]): THREE.BufferGeometry {
  const positions: number[] = [];

  for (const ring of borderRings) {
    if (ring.length < 2) continue;
    for (let i = 0; i < ring.length - 1; i++) {
      const [lon1, lat1] = ring[i];
      const [lon2, lat2] = ring[i + 1];
      // Skip antimeridian-crossing segments
      if (Math.abs(lon2 - lon1) > 90) continue;
      const v1 = latLonToVector3(lat1, lon1, LAND_RADIUS + 0.001);
      const v2 = latLonToVector3(lat2, lon2, LAND_RADIUS + 0.001);
      positions.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geo;
}

// ─── Scene sub-components ─────────────────────────────────────────

/** Eases camera from far to default position on mount. */
function IntroAnimation() {
  const { camera } = useThree();
  const startTime = useRef(performance.now());

  useFrame(() => {
    const elapsed = (performance.now() - startTime.current) / 1000;
    if (elapsed >= INTRO_DURATION) return;
    const t = elapsed / INTRO_DURATION;
    // Ease-out cubic
    const ease = 1 - Math.pow(1 - t, 3);
    camera.position.z = INTRO_START_Z + (INTRO_END_Z - INTRO_START_Z) * ease;
  });

  return null;
}

/** Manages auto-rotation with interaction pause. */
function AutoRotate({
  groupRef,
  controlsRef,
}: {
  groupRef: React.RefObject<THREE.Group | null>;
  controlsRef: React.RefObject<any>;
}) {
  const isInteracting = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const autoRotateActive = useRef(true);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const onStart = () => {
      isInteracting.current = true;
      autoRotateActive.current = false;
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
    const onEnd = () => {
      isInteracting.current = false;
      resumeTimer.current = setTimeout(() => {
        autoRotateActive.current = true;
      }, RESUME_DELAY);
    };

    controls.addEventListener('start', onStart);
    controls.addEventListener('end', onEnd);
    return () => {
      controls.removeEventListener('start', onStart);
      controls.removeEventListener('end', onEnd);
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, [controlsRef]);

  useFrame(() => {
    if (autoRotateActive.current && groupRef.current) {
      groupRef.current.rotation.y += AUTO_ROTATE_SPEED;
    }
  });

  return null;
}

/** Individual continent polygon mesh. */
function LandPoly({
  geometry,
  hovered,
  onHover,
  onUnhover,
}: {
  geometry: THREE.BufferGeometry;
  hovered: boolean;
  onHover: () => void;
  onUnhover: () => void;
}) {
  return (
    <mesh geometry={geometry} renderOrder={1} onPointerOver={onHover} onPointerOut={onUnhover}>
      <meshBasicMaterial color={hovered ? LAND_HOVER_COLOR : LAND_COLOR} side={THREE.FrontSide} />
    </mesh>
  );
}

/** The full globe scene. */
function GlobeScene({
  onReady,
}: {
  onReady: (api: {
    groupRef: React.RefObject<THREE.Group | null>;
    camera: THREE.Camera;
  }) => void;
}) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const controlsRef = useRef<any>(null);
  const [geoData, setGeoData] = useState<{ land: LandPolygon[]; borders: number[][][] } | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState(-1);

  useEffect(() => {
    fetchGeoData().then(setGeoData).catch(() => {});
  }, []);

  useEffect(() => {
    if (groupRef.current) {
      onReady({ groupRef, camera });
    }
  }, [geoData, camera, onReady]);

  // Build geometries
  const landGeometries = useMemo(() => {
    if (!geoData) return [];
    return geoData.land.map(buildPolygonGeometry);
  }, [geoData]);

  const borderGeometry = useMemo(() => {
    if (!geoData) return null;
    return buildBorderLines(geoData.borders);
  }, [geoData]);

  const handleHover = useCallback((idx: number) => () => setHoveredIdx(idx), []);
  const handleUnhover = useCallback(() => setHoveredIdx(-1), []);

  return (
    <>
      {/* Lighting — subtle specular depth cue */}
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 3, 5]} intensity={0.3} />

      <IntroAnimation />
      <AutoRotate groupRef={groupRef} controlsRef={controlsRef} />

      <group ref={groupRef}>
        {/* Ocean sphere */}
        <mesh>
          <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
          <meshBasicMaterial color={OCEAN_COLOR} />
        </mesh>

        {/* Land polygons — same radius, wins depth test over ocean */}
        {landGeometries.map((geo, i) =>
          geo ? (
            <LandPoly
              key={i}
              geometry={geo}
              hovered={i === hoveredIdx}
              onHover={handleHover(i)}
              onUnhover={handleUnhover}
            />
          ) : null,
        )}

        {/* Country border lines — slightly above land */}
        {borderGeometry && (
          <lineSegments geometry={borderGeometry} renderOrder={2}>
            <lineBasicMaterial color={BORDER_COLOR} transparent opacity={0.4} />
          </lineSegments>
        )}
      </group>

      {/* Controls */}
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom
        minDistance={1.8}
        maxDistance={5.0}
        enableDamping
        dampingFactor={0.05}
      />
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────

export const SMXGlobe = forwardRef<SMXGlobeRef, SMXGlobeProps>(function SMXGlobe(
  { width = '100%', height = '100%' },
  ref,
) {
  const sceneApi = useRef<{
    groupRef: React.RefObject<THREE.Group | null>;
    camera: THREE.Camera;
  } | null>(null);

  const markersRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const arcsRef = useRef<Map<string, THREE.Line>>(new Map());
  const nextId = useRef(0);

  const onSceneReady = useCallback(
    (api: { groupRef: React.RefObject<THREE.Group | null>; camera: THREE.Camera }) => {
      sceneApi.current = api;
    },
    [],
  );

  useImperativeHandle(ref, () => ({
    focusOn(lat: number, lng: number, duration = 1.0) {
      if (!sceneApi.current) return;
      const { camera } = sceneApi.current;
      const target = latLonToVector3(lat, lng, GLOBE_RADIUS);
      const camDist = camera.position.length();
      const dest = target.clone().normalize().multiplyScalar(camDist);

      const start = camera.position.clone();
      const startTime = performance.now();

      function animate() {
        const t = Math.min((performance.now() - startTime) / (duration * 1000), 1);
        const ease = 1 - Math.pow(1 - t, 3);
        camera.position.lerpVectors(start, dest, ease);
        camera.lookAt(0, 0, 0);
        if (t < 1) requestAnimationFrame(animate);
      }
      animate();
    },

    addMarker(lat: number, lng: number, options: MarkerOptions = {}): string {
      if (!sceneApi.current?.groupRef.current) return '';
      const id = `marker-${nextId.current++}`;
      const { color = '#4F6CCD', size = 0.008 } = options;
      const geo = new THREE.SphereGeometry(size, 8, 8);
      const mat = new THREE.MeshBasicMaterial({ color });
      const mesh = new THREE.Mesh(geo, mat);
      const pos = latLonToVector3(lat, lng, GLOBE_RADIUS + 0.002);
      mesh.position.copy(pos);
      sceneApi.current.groupRef.current.add(mesh);
      markersRef.current.set(id, mesh);
      return id;
    },

    addArc(from: [number, number], to: [number, number], options: ArcOptions = {}): string {
      if (!sceneApi.current?.groupRef.current) return '';
      const id = `arc-${nextId.current++}`;
      const { color = '#4F6CCD', dashLength } = options;

      const p1 = latLonToVector3(from[0], from[1], GLOBE_RADIUS + 0.003);
      const p2 = latLonToVector3(to[0], to[1], GLOBE_RADIUS + 0.003);
      const mid = p1.clone().add(p2).multiplyScalar(0.5).normalize()
        .multiplyScalar(GLOBE_RADIUS + 0.15);

      const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
      const points = curve.getPoints(64);
      const geo = new THREE.BufferGeometry().setFromPoints(points);

      let mat: THREE.Material;
      if (dashLength) {
        mat = new THREE.LineDashedMaterial({ color, dashSize: dashLength, gapSize: dashLength * 0.5 });
      } else {
        mat = new THREE.LineBasicMaterial({ color });
      }

      const line = new THREE.Line(geo, mat);
      if (dashLength) line.computeLineDistances();
      sceneApi.current.groupRef.current.add(line);
      arcsRef.current.set(id, line);
      return id;
    },

    clearAll() {
      if (!sceneApi.current?.groupRef.current) return;
      const group = sceneApi.current.groupRef.current;

      for (const [, mesh] of markersRef.current) {
        group.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      markersRef.current.clear();

      for (const [, line] of arcsRef.current) {
        group.remove(line);
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      }
      arcsRef.current.clear();
    },
  }));

  return (
    <div className="relative" style={{ width, height }}>
      {/* Atmosphere glow — CSS radial gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(79,108,205,0.10) 0%, rgba(79,108,205,0.04) 25%, transparent 48%)',
        }}
      />
      <Canvas
        camera={{ position: [0, 0, INTRO_START_Z], fov: 45 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
          <GlobeScene onReady={onSceneReady} />
        </Suspense>
      </Canvas>
    </div>
  );
});
