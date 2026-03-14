import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
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

      {/* Globe sphere — ocean + continents as a single textured surface */}
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
        enableDamping
        dampingFactor={0.05}
      />
    </>
  );
}

export function Globe({ hubs, flights }: GlobeProps) {
  return (
    <div className="relative w-full h-full">
      {/* Subtle atmosphere glow — CSS radial gradient behind canvas */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(79,108,205,0.08) 0%, rgba(79,108,205,0.03) 25%, transparent 45%)',
        }}
      />
      <Canvas
        camera={{ position: [0, 0, 3.2], fov: 45 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
          <GlobeScene hubs={hubs} flights={flights} />
        </Suspense>
      </Canvas>
    </div>
  );
}
