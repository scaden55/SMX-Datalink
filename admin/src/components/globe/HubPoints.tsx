import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { latLonToVector3 } from './utils';

interface HubPointsProps {
  hubs: { lat: number; lon: number }[];
}

const GLOBE_RADIUS = 1.002;
const POINT_GEOMETRY = new THREE.SphereGeometry(0.008, 6, 6);
const POINT_MATERIAL = new THREE.MeshBasicMaterial({ color: '#3950ed' });

export function HubPoints({ hubs }: HubPointsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!meshRef.current || hubs.length === 0) return;
    const dummy = new THREE.Object3D();

    for (let i = 0; i < hubs.length; i++) {
      const pos = latLonToVector3(hubs[i].lat, hubs[i].lon, GLOBE_RADIUS);
      dummy.position.copy(pos);
      dummy.lookAt(pos.clone().multiplyScalar(2)); // face outward
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [hubs]);

  if (hubs.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[POINT_GEOMETRY, POINT_MATERIAL, Math.max(hubs.length, 1)]}
    />
  );
}
