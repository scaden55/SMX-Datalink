import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { latLonToVector3 } from './utils';

interface FlightPointsProps {
  flights: { latitude: number; longitude: number; callsign: string }[];
}

const GLOBE_RADIUS = 1.005;
const FLIGHT_GEOMETRY = new THREE.SphereGeometry(0.012, 8, 8);
const FLIGHT_MATERIAL = new THREE.MeshBasicMaterial({ color: '#4ade80' });

export function FlightPoints({ flights }: FlightPointsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();

    for (let i = 0; i < flights.length; i++) {
      const pos = latLonToVector3(flights[i].latitude, flights[i].longitude, GLOBE_RADIUS);
      dummy.position.copy(pos);
      dummy.lookAt(pos.clone().multiplyScalar(2));
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    // Hide unused instances
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = flights.length; i < meshRef.current.count; i++) {
      meshRef.current.setMatrixAt(i, zero);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [flights]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[FLIGHT_GEOMETRY, FLIGHT_MATERIAL, 50]}
    />
  );
}
