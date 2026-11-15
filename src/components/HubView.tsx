import React, { Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Bounds, Center, useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { BODIES, Body, BodyId } from '../data/missionsData';
import { TransitionPhase } from '../hooks/useMuseumTransition';
import { createNormalizedWorldClone } from '../utils/cloneWorldScene';
import { WorldModelErrorBoundary } from './LoadingGate';
import { WorldHotspot } from './WorldHotspot';

const noRaycast = () => null;

interface HubWorldNodeProps {
  body: Body;
  basePosition: [number, number, number];
  targetRadius: number;
  isMobileOrPortrait: boolean;
  baseOpacity: number;
  isHovered: boolean;
  isOtherHovered: boolean;
  activeBodyId: BodyId | null;
  transitionPhase: TransitionPhase;
  isTransitioning: boolean;
  isReady: boolean;
  prefersReducedMotion: boolean;
  onHoverChange: (id: BodyId | null) => void;
  onSelect: (id: BodyId) => void;
  registerHotspotRef: (id: BodyId, el: HTMLButtonElement | null) => void;
  onArrowNavigate: (currentId: BodyId, direction: 'left' | 'right') => void;
}

function HubWorldMesh({
  body,
  basePosition,
  targetRadius,
  isMobileOrPortrait,
  baseOpacity,
  isHovered,
  isOtherHovered,
  activeBodyId,
  transitionPhase,
  isTransitioning,
  isReady,
  prefersReducedMotion,
  onHoverChange,
  onSelect,
  registerHotspotRef,
  onArrowNavigate,
}: HubWorldNodeProps) {
  const { scene } = useGLTF(body.url);
  const { gl } = useThree();

  const outerGroupRef = useRef<THREE.Group | null>(null);
  const spinGroupRef = useRef<THREE.Group | null>(null);
  const atmosphereMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const currentScaleRef = useRef<number>(1);
  const currentOpacityRef = useRef<number>(isReady ? 1 : 0);

  const { clonedScene, clonedMaterials } = useMemo(
    () => createNormalizedWorldClone(scene, gl, targetRadius, true),
    [scene, gl, targetRadius]
  );

  useEffect(() => {
    return () => {
      clonedMaterials.forEach((mat) => mat.dispose());
    };
  }, [clonedMaterials]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const elapsed = state.clock.getElapsedTime();

    const speedFactor = isHovered ? 0.35 : 1.0;
    if (spinGroupRef.current && !prefersReducedMotion) {
      spinGroupRef.current.rotation.y += body.hubRotationSpeed * speedFactor * dt;
    }

    const targetScale = isHovered && !isTransitioning ? 1.04 : 1.0;
    currentScaleRef.current = THREE.MathUtils.damp(
      currentScaleRef.current,
      targetScale,
      6,
      dt
    );

    const isChosenWorld = activeBodyId === body.id;
    const isUnchosenDuringTransition =
      (transitionPhase === 'to-world' || transitionPhase === 'to-hub') &&
      activeBodyId !== null &&
      !isChosenWorld;

    let targetOpacity = baseOpacity;
    if (!isReady) {
      targetOpacity = 0;
    } else if (isChosenWorld && transitionPhase === 'to-world') {
      targetOpacity = 1.0;
    } else if (transitionPhase === 'to-world' && isUnchosenDuringTransition) {
      targetOpacity = 0;
    } else if (isOtherHovered && !isTransitioning) {
      targetOpacity = 0.55;
    }

    const opacityLambda = prefersReducedMotion ? 16 : 4.5;
    currentOpacityRef.current = THREE.MathUtils.damp(
      currentOpacityRef.current,
      targetOpacity,
      opacityLambda,
      dt
    );

    const clampedOpacity = isChosenWorld
      ? 1.0
      : THREE.MathUtils.clamp(currentOpacityRef.current, 0, 1);

    clonedMaterials.forEach((mat) => {
      mat.visible = true;
      mat.opacity = clampedOpacity;
      const shouldBeTransparent = clampedOpacity < 0.995;
      if (mat.transparent !== shouldBeTransparent) {
        mat.transparent = shouldBeTransparent;
        mat.needsUpdate = true;
      }
      mat.depthWrite = clampedOpacity > 0.25;
    });

    if (atmosphereMatRef.current && body.atmosphere) {
      atmosphereMatRef.current.opacity = body.atmosphere.opacity * clampedOpacity;
    }

    if (outerGroupRef.current) {
      outerGroupRef.current.visible = true;
      const floatY = prefersReducedMotion
        ? 0
        : Math.sin(elapsed * body.floatFrequency + body.floatPhaseOffset) * 0.04;

      const driftDirX = basePosition[0] < 0 ? -1.4 : basePosition[0] > 0 ? 1.4 : 0;
      const driftZ = -2.2;
      const isDriftingAway = transitionPhase === 'to-world' && isUnchosenDuringTransition;

      const targetX = basePosition[0] + (isDriftingAway ? driftDirX : 0);
      const targetY = basePosition[1] + floatY;
      const targetZ = basePosition[2] + (isDriftingAway ? driftZ : 0);

      outerGroupRef.current.position.x = THREE.MathUtils.damp(
        outerGroupRef.current.position.x,
        targetX,
        3.5,
        dt
      );
      outerGroupRef.current.position.y = THREE.MathUtils.damp(
        outerGroupRef.current.position.y,
        targetY,
        4.5,
        dt
      );
      outerGroupRef.current.position.z = THREE.MathUtils.damp(
        outerGroupRef.current.position.z,
        targetZ,
        3.5,
        dt
      );

      outerGroupRef.current.scale.setScalar(Math.max(0.01, currentScaleRef.current));
    }
  });

  const labelsVisible = isReady && transitionPhase === 'idle';

  return (
    <group ref={outerGroupRef} position={basePosition}>
      <group ref={spinGroupRef}>
        <Bounds observe margin={1.2}>
          <Center>
            <primitive object={clonedScene} />
          </Center>
        </Bounds>
      </group>

      {body.atmosphere && (
        <mesh raycast={noRaycast}>
          <sphereGeometry args={[targetRadius * body.atmosphere.scale, 48, 48]} />
          <meshBasicMaterial
            ref={atmosphereMatRef}
            color={body.atmosphere.color}
            side={THREE.BackSide}
            transparent
            opacity={body.atmosphere.opacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      <WorldHotspot
        body={body}
        radius={targetRadius}
        isMobileOrPortrait={isMobileOrPortrait}
        occludeRef={spinGroupRef}
        isHovered={isHovered}
        isOtherHovered={isOtherHovered}
        isTransitioning={isTransitioning}
        labelsVisible={labelsVisible}
        prefersReducedMotion={prefersReducedMotion}
        onHoverChange={onHoverChange}
        onSelect={onSelect}
        registerHotspotRef={registerHotspotRef}
        onArrowNavigate={onArrowNavigate}
      />
    </group>
  );
}

export interface HubViewProps {
  isReady: boolean;
  isMobileOrPortrait: boolean;
  isTouchDevice: boolean;
  prefersReducedMotion: boolean;
  hoveredBodyId: BodyId | null;
  activeBodyId: BodyId | null;
  bodyOpacities: Record<BodyId, number>;
  transitionPhase: TransitionPhase;
  isTransitioning: boolean;
  onHoverChange: (id: BodyId | null) => void;
  onSelectWorld: (id: BodyId) => void;
  starsGroupRef: React.RefObject<THREE.Group | null>;
}

/**
 * Hub scene positioning Moon and Mars strictly inside the vertical safe area
 * (>=96px top and >=140px bottom on desktop; wider margins on mobile portrait).
 */
export function HubView({
  isReady,
  isMobileOrPortrait,
  isTouchDevice,
  prefersReducedMotion,
  hoveredBodyId,
  activeBodyId,
  bodyOpacities,
  transitionPhase,
  isTransitioning,
  onHoverChange,
  onSelectWorld,
  starsGroupRef,
}: HubViewProps) {
  const { camera } = useThree();

  // Positioned within the safe area so neither globes nor labels overlap the top wordmark/About button or bottom caption
  const positions: Record<BodyId, [number, number, number]> = useMemo(() => {
    if (isMobileOrPortrait) {
      return {
        moon: [0, 1.42, 0],
        mars: [0, -0.82, 0],
      };
    }
    return {
      moon: [-2.25, 0.36, 0],
      mars: [2.25, 0.36, 0],
    };
  }, [isMobileOrPortrait]);

  const targetRadius = isMobileOrPortrait ? 0.66 : 1.04;

  const hotspotRefs = useRef<Record<BodyId, HTMLButtonElement | null>>({
    moon: null,
    mars: null,
  });

  const registerHotspotRef = useCallback((id: BodyId, el: HTMLButtonElement | null) => {
    hotspotRefs.current[id] = el;
  }, []);

  const handleArrowNavigate = useCallback(
    (currentId: BodyId, _direction: 'left' | 'right') => {
      const nextId: BodyId = currentId === 'moon' ? 'mars' : 'moon';
      const targetBtn = hotspotRefs.current[nextId];
      if (targetBtn) {
        targetBtn.focus();
        onHoverChange(nextId);
      }
    },
    [onHoverChange]
  );

  const pointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  useEffect(() => {
    if (isTouchDevice || prefersReducedMotion) return;
    const onPointerMove = (e: PointerEvent) => {
      pointerRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointerRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [isTouchDevice, prefersReducedMotion]);

  const lookAtTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const desiredCamPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.2, 7.6));
  const desiredLookAtRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

  const baseCameraZ = isMobileOrPortrait ? 9.6 : 7.5;
  const introStartZ = prefersReducedMotion ? baseCameraZ : baseCameraZ + 1.65;

  useEffect(() => {
    camera.near = 0.1;
    camera.far = 1000;
    camera.updateProjectionMatrix();
    if (transitionPhase !== 'to-hub') {
      camera.position.set(0, 0.15, introStartZ);
      camera.lookAt(0, 0, 0);
    }
  }, [camera, introStartZ, transitionPhase]);

  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.1);

    const allowParallax = !isTouchDevice && !prefersReducedMotion && transitionPhase === 'idle';
    const maxParallaxOffset = Math.tan(THREE.MathUtils.degToRad(3)) * baseCameraZ;
    const parallaxX = allowParallax ? pointerRef.current.x * maxParallaxOffset : 0;
    const parallaxY = allowParallax ? pointerRef.current.y * maxParallaxOffset * 0.65 : 0;

    if (transitionPhase === 'to-world' && activeBodyId) {
      const targetPos = positions[activeBodyId];
      desiredCamPosRef.current.set(
        targetPos[0],
        targetPos[1] + 0.15,
        targetPos[2] + targetRadius * 2.85
      );
      desiredLookAtRef.current.set(targetPos[0], targetPos[1], targetPos[2]);

      const glideLambda = prefersReducedMotion ? 14 : 3.4;
      camera.position.lerp(desiredCamPosRef.current, 1 - Math.exp(-glideLambda * dt));
      lookAtTargetRef.current.lerp(desiredLookAtRef.current, 1 - Math.exp(-glideLambda * dt));
      camera.lookAt(lookAtTargetRef.current);
    } else {
      const targetZ = isReady ? baseCameraZ : introStartZ;
      desiredCamPosRef.current.set(parallaxX, 0.1 + parallaxY, targetZ);
      desiredLookAtRef.current.set(parallaxX * 0.2, parallaxY * 0.2, 0);

      const hubLambda = transitionPhase === 'to-hub' ? 3.4 : 2.6;
      camera.position.lerp(desiredCamPosRef.current, 1 - Math.exp(-hubLambda * dt));
      lookAtTargetRef.current.lerp(desiredLookAtRef.current, 1 - Math.exp(-hubLambda * dt));
      camera.lookAt(lookAtTargetRef.current);
    }

    if (starsGroupRef.current && allowParallax) {
      starsGroupRef.current.rotation.y = THREE.MathUtils.damp(
        starsGroupRef.current.rotation.y,
        -pointerRef.current.x * 0.018,
        3,
        dt
      );
      starsGroupRef.current.rotation.x = THREE.MathUtils.damp(
        starsGroupRef.current.rotation.x,
        pointerRef.current.y * 0.012,
        3,
        dt
      );
    }
  });

  return (
    <group name="museum-hub-view">
      {BODIES.map((body) => {
        const pos = positions[body.id];
        const xLightOffset = pos[0] <= 0 ? -2.5 : 2.5;
        return (
          <pointLight
            key={`light-${body.id}`}
            position={[pos[0] + xLightOffset, pos[1] + 2.8, 4.5]}
            color={body.keyLightColor}
            intensity={18}
            distance={14}
            decay={1.6}
          />
        );
      })}

      {BODIES.map((body) => {
        const pos = positions[body.id];
        const isHovered = hoveredBodyId === body.id;
        const isOtherHovered = hoveredBodyId !== null && hoveredBodyId !== body.id;

        return (
          <WorldModelErrorBoundary key={body.id} body={body} position={pos}>
            <Suspense fallback={null}>
              <HubWorldMesh
                body={body}
                basePosition={pos}
                targetRadius={targetRadius}
                isMobileOrPortrait={isMobileOrPortrait}
                baseOpacity={bodyOpacities[body.id]}
                isHovered={isHovered}
                isOtherHovered={isOtherHovered}
                activeBodyId={activeBodyId}
                transitionPhase={transitionPhase}
                isTransitioning={isTransitioning}
                isReady={isReady}
                prefersReducedMotion={prefersReducedMotion}
                onHoverChange={onHoverChange}
                onSelect={onSelectWorld}
                registerHotspotRef={registerHotspotRef}
                onArrowNavigate={handleArrowNavigate}
              />
            </Suspense>
          </WorldModelErrorBoundary>
        );
      })}
    </group>
  );
}
