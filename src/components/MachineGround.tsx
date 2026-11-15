import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { ContactShadows } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { BodyTerrainPalette } from '../data/missionsData';

const noRaycast = () => null;

export interface MachineGroundProps {
  terrain: BodyTerrainPalette;
  radius?: number;
  opacity?: number;
}

/**
 * Procedural circular terrain patch built in code (zero external textures):
 * a slightly noisy disc with a fading radial edge and <ContactShadows> for grounding.
 */
export function MachineGround({
  terrain,
  radius = 3.2,
  opacity = 1,
}: MachineGroundProps) {
  const { gl } = useThree();

  const { geometry, colorMap, alphaMap, bumpMap, material } = useMemo(() => {
    const maxAnisotropy = gl.capabilities.getMaxAnisotropy();

    // 1. Slightly noisy procedural disc geometry (keeps center flat at y=0 for machine landing gear)
    const geo = new THREE.PlaneGeometry(radius * 2, radius * 2, 64, 64);
    geo.rotateX(-Math.PI / 2);

    const posAttr = geo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const dist = Math.sqrt(vx * vx + vz * vz);
      const normDist = Math.min(1, dist / radius);

      // Keep inner footprint near y=0 so landing pads/wheels rest flush at y=0,
      // add gentle micro-relief outward, and taper to 0 at rim
      const footprintMask = THREE.MathUtils.smoothstep(normDist, 0.22, 0.65);
      const rimTaper = 1 - THREE.MathUtils.smoothstep(normDist, 0.72, 1.0);
      const n1 = Math.sin(vx * 3.1 + vz * 2.7) * Math.cos(vx * 1.9 - vz * 3.4);
      const n2 = Math.sin(vx * 7.3 - vz * 6.1) * 0.35;
      const height = (n1 + n2) * 0.032 * footprintMask * rimTaper;
      posAttr.setY(i, height);
    }
    geo.computeVertexNormals();

    // 2. Procedural Color & Bump CanvasTexture
    const size = 512;
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = size;
    colorCanvas.height = size;
    const cCtx = colorCanvas.getContext('2d');

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = size;
    bumpCanvas.height = size;
    const bCtx = bumpCanvas.getContext('2d');

    const alphaCanvas = document.createElement('canvas');
    alphaCanvas.width = size;
    alphaCanvas.height = size;
    const aCtx = alphaCanvas.getContext('2d');

    if (cCtx && bCtx && aCtx) {
      const half = size / 2;

      // Radial base gradient from innerColor to outerColor
      const radGrad = cCtx.createRadialGradient(half, half, size * 0.05, half, half, half);
      radGrad.addColorStop(0, terrain.innerColor);
      radGrad.addColorStop(0.65, terrain.outerColor);
      radGrad.addColorStop(1, terrain.outerColor);
      cCtx.fillStyle = radGrad;
      cCtx.fillRect(0, 0, size, size);

      bCtx.fillStyle = '#808080';
      bCtx.fillRect(0, 0, size, size);

      // Fine regolith granules and shallow micro-craters/pebbles
      for (let i = 0; i < 1800; i++) {
        const s1 = Math.sin(i * 12.9898) * 43758.5453;
        const s2 = Math.sin(i * 78.233) * 43758.5453;
        const s3 = Math.sin(i * 45.164) * 43758.5453;
        const fx = s1 - Math.floor(s1);
        const fy = s2 - Math.floor(s2);
        const fr = s3 - Math.floor(s3);

        const px = fx * size;
        const py = fy * size;
        const pr = 0.8 + fr * 3.8;
        const isLight = i % 2 === 0;

        cCtx.fillStyle = isLight ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.065)';
        cCtx.beginPath();
        cCtx.arc(px, py, pr, 0, Math.PI * 2);
        cCtx.fill();

        bCtx.fillStyle = isLight ? 'rgba(220,220,220,0.18)' : 'rgba(40,40,40,0.18)';
        bCtx.beginPath();
        bCtx.arc(px, py, pr, 0, Math.PI * 2);
        bCtx.fill();
      }

      // Soft circular fading edge alpha map
      aCtx.fillStyle = '#000000';
      aCtx.fillRect(0, 0, size, size);
      const alphaGrad = aCtx.createRadialGradient(half, half, size * 0.14, half, half, half * 0.96);
      alphaGrad.addColorStop(0, 'rgba(255,255,255,1)');
      alphaGrad.addColorStop(0.55, 'rgba(255,255,255,0.92)');
      alphaGrad.addColorStop(0.82, 'rgba(120,120,120,0.35)');
      alphaGrad.addColorStop(1, 'rgba(0,0,0,0)');
      aCtx.fillStyle = alphaGrad;
      aCtx.fillRect(0, 0, size, size);
    }

    const cTex = new THREE.CanvasTexture(colorCanvas);
    cTex.colorSpace = THREE.SRGBColorSpace;
    cTex.anisotropy = maxAnisotropy;

    const bTex = new THREE.CanvasTexture(bumpCanvas);
    bTex.anisotropy = maxAnisotropy;

    const aTex = new THREE.CanvasTexture(alphaCanvas);

    const mat = new THREE.MeshStandardMaterial({
      map: cTex,
      bumpMap: bTex,
      bumpScale: 0.025,
      alphaMap: aTex,
      transparent: true,
      opacity: 1,
      roughness: 0.92,
      metalness: 0.04,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });

    return {
      geometry: geo,
      colorMap: cTex,
      alphaMap: aTex,
      bumpMap: bTex,
      material: mat,
    };
  }, [terrain.innerColor, terrain.outerColor, radius, gl]);

  useEffect(() => {
    material.opacity = opacity;
  }, [material, opacity]);

  // Dispose procedural geometry, textures, and material on unmount
  useEffect(() => {
    return () => {
      geometry.dispose();
      colorMap.dispose();
      alphaMap.dispose();
      bumpMap.dispose();
      material.dispose();
    };
  }, [geometry, colorMap, alphaMap, bumpMap, material]);

  return (
    <group position={[0, 0, 0]} name="machine-ground">
      {/* Procedural Terrain Disc with Fading Edge */}
      <mesh
        geometry={geometry}
        material={material}
        receiveShadow
        raycast={noRaycast}
      />

      {/* Soft Contact Shadows Grounding the Hardware at y = 0 */}
      <ContactShadows
        position={[0, 0.002, 0]}
        opacity={0.58 * opacity}
        scale={radius * 1.55}
        blur={2.1}
        far={3.5}
        resolution={512}
        color="#000000"
      />
    </group>
  );
}
