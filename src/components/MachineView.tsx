import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Bounds, Center, Html, OrbitControls, useBounds, useGLTF } from '@react-three/drei';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Body, Hardware, MUSEUM_COPY } from '../data/missionsData';
import { createNormalizedHardwareClone } from '../utils/cloneWorldScene';
import {
  ArtifactTelemetrySuspenseFallback,
  WorldModelErrorBoundary,
} from './LoadingGate';
import { MachineGround } from './MachineGround';

export type MachineCameraPreset = 'overview' | 'closeup';

const TARGET_MACHINE_MAX_DIM = 2.15;
const noRaycast = () => null;

/**
 * Sparse layer of slow drifting dust motes (<120 points, 12% opacity) for MachineView.
 */
function MachineDustMotes({
  prefersReducedMotion,
  color,
}: {
  prefersReducedMotion: boolean;
  color: string;
}) {
  const pointsRef = useRef<THREE.Points | null>(null);

  const { geometry, material } = useMemo(() => {
    const count = 96; // < 120 points
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const s1 = Math.sin(i * 19.19) * 43758.5453;
      const s2 = Math.sin(i * 73.41) * 43758.5453;
      const s3 = Math.sin(i * 41.77) * 43758.5453;
      const fx = s1 - Math.floor(s1);
      const fy = s2 - Math.floor(s2);
      const fz = s3 - Math.floor(s3);

      positions[i * 3] = (fx - 0.5) * 9;
      positions[i * 3 + 1] = fy * 3.8 + 0.1;
      positions[i * 3 + 2] = (fz - 0.5) * 9;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color,
      size: 0.026,
      transparent: true,
      opacity: 0.12, // 12% opacity
      depthWrite: false,
      sizeAttenuation: true,
    });

    return { geometry: geo, material: mat };
  }, [color]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((_state, delta) => {
    if (pointsRef.current && !prefersReducedMotion) {
      const dt = Math.min(delta, 0.1);
      pointsRef.current.rotation.y += 0.012 * dt;
    }
  });

  return <points ref={pointsRef} geometry={geometry} material={material} raycast={noRaycast} />;
}

interface MachineBoundsSyncProps {
  hardwareId: string;
}

function MachineBoundsSync({ hardwareId }: MachineBoundsSyncProps) {
  const bounds = useBounds();
  const { camera } = useThree();

  useEffect(() => {
    bounds.refresh();
    camera.near = 0.05;
    camera.far = 1000;
    camera.updateProjectionMatrix();
  }, [hardwareId, bounds, camera]);

  return null;
}

interface MachineArtifactModelProps {
  body: Body;
  hardware: Hardware;
  stageXOffset: number;
  targetOpacity: number;
  cameraPreset: MachineCameraPreset;
  resetTrigger: number;
  isEditMode: boolean;
  prefersReducedMotion: boolean;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}

function MachineArtifactModel({
  body,
  hardware,
  stageXOffset,
  targetOpacity,
  cameraPreset,
  resetTrigger,
  isEditMode,
  prefersReducedMotion,
  controlsRef,
}: MachineArtifactModelProps) {
  const { scene } = useGLTF(hardware.url);
  const { gl, camera } = useThree();

  const [isHovered, setIsHovered] = useState<boolean>(false);
  const currentOpacityRef = useRef<number>(prefersReducedMotion ? 1 : 0);
  const currentHoverBoostRef = useRef<number>(0);

  // Camera glide state for Overview / Close-up (~900ms damped glide)
  const isGlidingCameraRef = useRef<boolean>(true);
  const glideElapsedRef = useRef<number>(0);
  const desiredCamPosRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const desiredTargetRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const scratchColorRef = useRef<THREE.Color>(new THREE.Color());

  const { clonedScene, normalizedHeight, clonedMaterials } = useMemo(
    () =>
      createNormalizedHardwareClone(
        scene,
        gl,
        TARGET_MACHINE_MAX_DIM,
        hardware.modelRotation,
        hardware.modelScale
      ),
    [scene, gl, hardware.modelRotation, hardware.modelScale]
  );

  // Force full visibility and clean initial material state on mount
  useEffect(() => {
    currentOpacityRef.current = prefersReducedMotion ? 1 : 0.05;
    clonedMaterials.forEach(({ material }) => {
      material.visible = true;
      material.opacity = 1;
      material.transparent = false;
      material.depthWrite = true;
      material.needsUpdate = true;
    });

    return () => {
      document.body.style.cursor = 'auto';
      clonedMaterials.forEach(({ material }) => material.dispose());
    };
  }, [clonedMaterials, prefersReducedMotion]);

  // Compute Overview vs Close-up (55% distance, slightly above eye level) camera targets
  const applyCameraPresetTargets = useCallback(
    (preset: MachineCameraPreset) => {
      const centerY = Math.max(0.42, normalizedHeight * 0.45);
      const overviewDist = 4.35;

      if (preset === 'closeup') {
        const closeupDist = overviewDist * 0.55; // ~55% of Overview distance
        desiredCamPosRef.current.set(
          stageXOffset + 0.35,
          centerY + 0.24,
          closeupDist
        );
        desiredTargetRef.current.set(stageXOffset, centerY * 0.95, 0);
      } else {
        desiredCamPosRef.current.set(
          stageXOffset * 0.4,
          centerY + 0.68,
          overviewDist
        );
        desiredTargetRef.current.set(0, centerY * 0.88, 0);
      }

      glideElapsedRef.current = 0;
      isGlidingCameraRef.current = true;
    },
    [normalizedHeight, stageXOffset]
  );

  // Trigger camera glide on hardware switch, preset change, or Reset View
  useEffect(() => {
    camera.near = 0.05;
    camera.far = 1000;
    camera.updateProjectionMatrix();
    applyCameraPresetTargets(cameraPreset);
  }, [hardware.id, cameraPreset, resetTrigger, camera, applyCameraPresetTargets]);

  // Cancel scripted camera glide if the user manually orbits/drags
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const onControlStart = () => {
      isGlidingCameraRef.current = false;
    };
    controls.addEventListener('start', onControlStart);
    return () => {
      controls.removeEventListener('start', onControlStart);
    };
  }, [controlsRef]);

  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.1);

    // 1. Damped camera preset glide (~900ms)
    if (isGlidingCameraRef.current) {
      glideElapsedRef.current += dt;
      const lambda = prefersReducedMotion ? 18 : 4.2;
      camera.position.lerp(desiredCamPosRef.current, 1 - Math.exp(-lambda * dt));
      if (controlsRef.current) {
        controlsRef.current.target.lerp(desiredTargetRef.current, 1 - Math.exp(-lambda * dt));
        controlsRef.current.update();
      }
      camera.near = 0.05;
      camera.far = 1000;

      if (
        camera.position.distanceToSquared(desiredCamPosRef.current) < 0.0008 ||
        glideElapsedRef.current > 1.35
      ) {
        isGlidingCameraRef.current = false;
      }
    }

    // 2. Per-machine opacity fade (350ms out / 500ms in, always forcing full opacity 1 when settled)
    const opacityLambda = prefersReducedMotion ? 18 : targetOpacity < 0.5 ? 7.5 : 4.8;
    currentOpacityRef.current = THREE.MathUtils.damp(
      currentOpacityRef.current,
      targetOpacity,
      opacityLambda,
      dt
    );
    const clampedOpacity =
      targetOpacity >= 0.99 && currentOpacityRef.current > 0.985
        ? 1.0
        : THREE.MathUtils.clamp(currentOpacityRef.current, 0, 1);

    // 3. Softly raise emissive / brightness by ~8% on hover
    const targetBoost = isHovered ? 0.08 : 0.0;
    currentHoverBoostRef.current = THREE.MathUtils.damp(
      currentHoverBoostRef.current,
      targetBoost,
      8,
      dt
    );
    const boost = currentHoverBoostRef.current;

    clonedMaterials.forEach(({ material, baseColor, baseEmissive }) => {
      material.visible = true;
      material.opacity = clampedOpacity;
      const shouldBeTransparent = clampedOpacity < 0.995;
      if (material.transparent !== shouldBeTransparent) {
        material.transparent = shouldBeTransparent;
        material.needsUpdate = true;
      }
      material.depthWrite = clampedOpacity > 0.25;

      const std = material as THREE.MeshStandardMaterial;
      if (std.color && baseColor) {
        scratchColorRef.current.copy(baseColor).multiplyScalar(1 + boost);
        std.color.copy(scratchColorRef.current);
      }
      if (std.emissive && baseEmissive) {
        scratchColorRef.current
          .copy(baseEmissive)
          .lerp(new THREE.Color('#C9A45C'), boost * 0.65);
        std.emissive.copy(scratchColorRef.current);
      }
    });
  });

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = 'pointer';
    setIsHovered(true);
  }, []);

  const handlePointerOut = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = 'auto';
    setIsHovered(false);
  }, []);

  return (
    <group position={[stageXOffset, 0, 0]} name={`machine-stage-${hardware.id}`}>
      {/* Procedural circular terrain patch & ContactShadows resting at y = 0 */}
      <MachineGround
        terrain={body.terrain}
        radius={3.1}
        opacity={THREE.MathUtils.clamp(currentOpacityRef.current, 0, 1)}
      />

      {/* Normalized Hardware Artifact auto-fit with Bounds & Center top (lowest point rests on y = 0) */}
      <Bounds fit clip observe margin={1.2}>
        <MachineBoundsSync hardwareId={hardware.id} />
        <group onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
          <Center top>
            <primitive object={clonedScene} />
          </Center>
        </group>
      </Bounds>

      {/* Hover hint shown ONLY when ?edit=1 parameter is set */}
      {isEditMode && isHovered && (
        <Html position={[0, normalizedHeight + 0.35, 0]} center zIndexRange={[30, 0]}>
          <div className="pointer-events-none select-none px-3 py-1.5 rounded-lg bg-[rgba(20,22,28,0.88)] backdrop-blur-xl border border-[#C9A45C]/50 font-mono text-[11px] text-[#C9A45C] whitespace-nowrap">
            {MUSEUM_COPY.editHoverHint}
          </div>
        </Html>
      )}
    </group>
  );
}

export interface MachineViewProps {
  body: Body;
  hardware: Hardware;
  machineOpacity: number;
  cameraPreset: MachineCameraPreset;
  autoRotate: boolean;
  onStopAutoRotate: () => void;
  resetTrigger: number;
  isMobileOrPortrait: boolean;
  isEditMode: boolean;
  prefersReducedMotion: boolean;
}

export function MachineView({
  body,
  hardware,
  machineOpacity,
  cameraPreset,
  autoRotate,
  onStopAutoRotate,
  resetTrigger,
  isMobileOrPortrait,
  isEditMode,
  prefersReducedMotion,
}: MachineViewProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  // Shift the model's screen position slightly to the right on desktop so the bottom-left placard never covers it
  const stageXOffset = isMobileOrPortrait ? 0 : 0.42;

  const handleOrbitStart = useCallback(() => {
    onStopAutoRotate();
  }, [onStopAutoRotate]);

  return (
    <group key={hardware.id} name={`machine-view-${hardware.id}`}>
      {/* World-specific key light (#FFF4E0 on Moon, #FFE2C4 on Mars) */}
      <directionalLight
        position={[4.5, 7.5, 4.5]}
        intensity={1.65}
        color={body.keyLightColor}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={25}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      />

      {/* Subtle cool/warm fill light for surface detail */}
      <directionalLight
        position={[-4, 3, -3]}
        intensity={0.45}
        color={body.terrain.hazeColor ? '#FFE2C4' : '#6FB3C2'}
      />

      {/* Mars-only very faint warm atmospheric haze dome (no fog that hides the model) */}
      {body.terrain.hazeColor && (
        <mesh position={[stageXOffset, 0, 0]} raycast={noRaycast}>
          <sphereGeometry args={[14, 32, 32]} />
          <meshBasicMaterial
            color={body.terrain.hazeColor}
            side={THREE.BackSide}
            transparent
            opacity={0.045}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Sparse slow drifting dust motes (<120 points, 12% opacity) */}
      <MachineDustMotes
        prefersReducedMotion={prefersReducedMotion}
        color={body.terrain.hazeColor ? '#E8C5B0' : '#ECEDEF'}
      />

      {/* OrbitControls with damping 0.05, idle auto-rotate 0.4, polar angle limited above ground */}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.05}
        autoRotate={autoRotate && !prefersReducedMotion}
        autoRotateSpeed={0.4}
        minDistance={1.15}
        maxDistance={11}
        minPolarAngle={0.08}
        maxPolarAngle={Math.PI / 2 - 0.04}
        onStart={handleOrbitStart}
      />

      {/* Per-machine Error Boundary with Retry button + Telemetry Suspense Loader */}
      <WorldModelErrorBoundary key={`eb-hw-${hardware.id}`} body={hardware}>
        <Suspense fallback={<ArtifactTelemetrySuspenseFallback />}>
          <MachineArtifactModel
            key={`hw-model-${hardware.id}`}
            body={body}
            hardware={hardware}
            stageXOffset={stageXOffset}
            targetOpacity={machineOpacity}
            cameraPreset={cameraPreset}
            resetTrigger={resetTrigger}
            isEditMode={isEditMode}
            prefersReducedMotion={prefersReducedMotion}
            controlsRef={controlsRef}
          />
        </Suspense>
      </WorldModelErrorBoundary>
    </group>
  );
}
