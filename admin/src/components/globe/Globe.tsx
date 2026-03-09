import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { ContinentMesh } from './ContinentMesh';
import { HubPoints } from './HubPoints';
import { FlightPoints } from './FlightPoints';

interface GlobeProps {
  hubs: { lat: number; lon: number }[];
  flights: { latitude: number; longitude: number; callsign: string }[];
}

function GlobeScene({ hubs, flights }: GlobeProps) {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 3, 5]} intensity={0.4} />

      {/* Atmosphere glow - slightly larger back-face sphere */}
      <mesh>
        <sphereGeometry args={[1.15, 64, 64]} />
        <meshBasicMaterial
          color="#3950ed"
          transparent
          opacity={0.04}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Ocean sphere */}
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshBasicMaterial color="#0a0e1a" />
      </mesh>

      {/* Continents */}
      <ContinentMesh />

      {/* Data layers */}
      <HubPoints hubs={hubs} />
      <FlightPoints flights={flights} />

      {/* Controls */}
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={2.0}
        maxDistance={5.0}
        autoRotate
        autoRotateSpeed={0.3}
        enableDamping
        dampingFactor={0.05}
      />
    </>
  );
}

export function Globe({ hubs, flights }: GlobeProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 3.2], fov: 45 }}
      gl={{ alpha: true, antialias: true }}
      style={{ background: 'transparent' }}
    >
      <Suspense fallback={null}>
        <GlobeScene hubs={hubs} flights={flights} />
      </Suspense>
    </Canvas>
  );
}
