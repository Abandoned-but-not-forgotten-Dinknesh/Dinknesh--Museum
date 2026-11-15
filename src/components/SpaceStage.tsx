import React, { Component, ReactNode, Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Html, Stars } from '@react-three/drei';
import { BODY_BY_ID, BodyId, MUSEUM_COPY, findHardware } from '../data/missionsData';
import {
  MuseumView,
  PendingPinFocus,
  TransitionPhase,
} from '../hooks/useMuseumTransition';
import { HubView } from './HubView';
import { WorldView } from './WorldView';
import { MachineCameraPreset, MachineView } from './MachineView';

export const isSoftwareGl = (() => {
  if (typeof document === 'undefined') return false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
})();

class EnvironmentSafeBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function StudioEnvironmentBootstrap() {
  const { gl, scene } = useThree();

  useEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.05;

    const pmremGenerator = new THREE.PMREMGenerator(gl);
    pmremGenerator.compileEquirectangularShader();
    const roomEnvTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

    if (!scene.environment) {
      scene.environment = roomEnvTexture;
    }

    return () => {
      roomEnvTexture.dispose();
      pmremGenerator.dispose();
    };
  }, [gl, scene]);

  return null;
}

/**
 * Subtle ambient depth: a very faint drifting dust layer (<150 points, 15% opacity)
 * positioned in front of the stars.
 */
function AmbientDustLayer({ prefersReducedMotion }: { prefersReducedMotion: boolean }) {
  const pointsRef = useRef<THREE.Points | null>(null);

  const { geometry, material } = useMemo(() => {
    const count = 120; // < 150 points
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const rx = Math.sin(i * 12.9898) * 43758.5453;
      const ry = Math.sin(i * 78.233) * 43758.5453;
      const rz = Math.sin(i * 39.346) * 43758.5453;
      const fx = rx - Math.floor(rx);
      const fy = ry - Math.floor(ry);
      const fz = rz - Math.floor(rz);

      positions[i * 3] = (fx - 0.5) * 22;
      positions[i * 3 + 1] = (fy - 0.5) * 14;
      positions[i * 3 + 2] = (fz - 0.5) * 12 - 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: '#ECEDEF',
      size: 0.032,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
      sizeAttenuation: true,
    });

    return { geometry: geo, material: mat };
  }, []);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((_state, delta) => {
    if (pointsRef.current && !prefersReducedMotion) {
      const dt = Math.min(delta, 0.1);
      pointsRef.current.rotation.y += 0.006 * dt;
      pointsRef.current.rotation.x += 0.002 * dt;
    }
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

export interface SpaceStageProps {
  isReady: boolean;
  view: MuseumView;
  activeBodyId: BodyId | null;
  activeHardwareId: string | null;
  hoveredBodyId: BodyId | null;
  bodyOpacities: Record<BodyId, number>;
  machineOpacity: number;
  pendingPinFocus: PendingPinFocus | null;
  transitionPhase: TransitionPhase;
  isTransitioning: boolean;
  transitionErrorBodyId: BodyId | null;
  onRetryTransition: (id: BodyId) => void;
  latOffset: number;
  lonOffset: number;
  cameraPreset: MachineCameraPreset;
  isMobileOrPortrait: boolean;
  isTouchDevice: boolean;
  isEditMode: boolean;
  prefersReducedMotion: boolean;
  autoRotate: boolean;
  onStopAutoRotate: () => void;
  resetTrigger: number;
  onHoverChange: (id: BodyId | null) => void;
  onSelectWorld: (id: BodyId) => void;
  onSelectSite: (hardwareId: string, lat: number, lon: number) => void;
}

export function SpaceStage({
  isReady,
  view,
  activeBodyId,
  activeHardwareId,
  hoveredBodyId,
  bodyOpacities,
  machineOpacity,
  pendingPinFocus,
  transitionPhase,
  isTransitioning,
  transitionErrorBodyId,
  onRetryTransition,
  latOffset,
  lonOffset,
  cameraPreset,
  isMobileOrPortrait,
  isTouchDevice,
  isEditMode,
  prefersReducedMotion,
  autoRotate,
  onStopAutoRotate,
  resetTrigger,
  onHoverChange,
  onSelectWorld,
  onSelectSite,
}: SpaceStageProps) {
  const starsGroupRef = useRef<THREE.Group | null>(null);
  const activeBody = activeBodyId ? BODY_BY_ID[activeBodyId] : BODY_BY_ID.moon;
  const activeHardware =
    findHardware(activeBodyId, activeHardwareId) ?? activeBody.hardware[0];

  return (
    <div className="relative w-screen h-screen bg-[#0B0C10] overflow-hidden select-none">
      <Canvas
        frameloop="always"
        shadows={!isSoftwareGl}
        dpr={isSoftwareGl ? 1 : [1, 2]}
        camera={{ position: [0, 0.25, 7.2], fov: 42, near: 0.1, far: 1000 }}
        gl={{
          antialias: !isSoftwareGl,
          powerPreference: 'high-performance',
          alpha: false,
        }}
        style={{ width: '100vw', height: '100vh', background: '#0B0C10' }}
      >
        <color attach="background" args={['#0B0C10']} />
        {view !== 'machine' && <fogExp2 attach="fog" args={['#0B0C10', 0.0025]} />}

        <StudioEnvironmentBootstrap />

        {/* Deep space starfield with slow parallax group */}
        <group ref={starsGroupRef}>
          <Stars
            radius={120}
            depth={60}
            count={4000}
            factor={4}
            saturation={0}
            fade
            speed={prefersReducedMotion ? 0 : 0.5}
          />
        </group>

        {/* Faint drifting dust layer in Hub and World views */}
        {view !== 'machine' && (
          <AmbientDustLayer prefersReducedMotion={prefersReducedMotion} />
        )}

        {/* Environment preset & subtle hemisphere ambient fill */}
        <EnvironmentSafeBoundary>
          <Suspense fallback={null}>
            <Environment preset="sunset" />
          </Suspense>
        </EnvironmentSafeBoundary>

        <hemisphereLight args={['#6FB3C2', '#0B0C10', 0.35]} intensity={0.35} />

        {/* Transition error fallback if anything threw during transition */}
        {transitionErrorBodyId ? (
          <Html center>
            <div
              role="alert"
              className="pointer-events-auto flex flex-col items-center text-center gap-3 p-5 rounded-xl bg-[rgba(20,22,28,0.78)] backdrop-blur-xl border border-[rgba(255,255,255,0.08)] w-[280px] sm:w-[320px] animate-hud-fade-in"
            >
              <p className="font-mono text-xs text-[#ECEDEF] tracking-wider leading-relaxed">
                {MUSEUM_COPY.signalLostPrefix} {BODY_BY_ID[transitionErrorBodyId].name}
              </p>
              <div className="w-full h-px bg-[#C9A45C]/30" />
              <button
                type="button"
                onClick={() => onRetryTransition(transitionErrorBodyId)}
                className="min-h-[44px] min-w-[110px] px-4 py-2 rounded-lg bg-transparent border border-[#C9A45C] hover:bg-[#C9A45C]/10 text-[#C9A45C] font-mono text-xs tracking-widest uppercase transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A45C]"
              >
                {MUSEUM_COPY.retryButton}
              </button>
            </div>
          </Html>
        ) : view === 'hub' ? (
          <HubView
            isReady={isReady}
            isMobileOrPortrait={isMobileOrPortrait}
            isTouchDevice={isTouchDevice}
            prefersReducedMotion={prefersReducedMotion}
            hoveredBodyId={hoveredBodyId}
            activeBodyId={activeBodyId}
            bodyOpacities={bodyOpacities}
            transitionPhase={transitionPhase}
            isTransitioning={isTransitioning}
            onHoverChange={onHoverChange}
            onSelectWorld={onSelectWorld}
            starsGroupRef={starsGroupRef}
          />
        ) : view === 'world' ? (
          <WorldView
            key={activeBody.id}
            body={activeBody}
            latOffset={latOffset}
            lonOffset={lonOffset}
            pendingPinFocus={pendingPinFocus}
            transitionPhase={transitionPhase}
            isTransitioning={isTransitioning}
            autoRotate={autoRotate}
            onStopAutoRotate={onStopAutoRotate}
            resetTrigger={resetTrigger}
            prefersReducedMotion={prefersReducedMotion}
            onSelectSite={onSelectSite}
          />
        ) : (
          <MachineView
            key={activeHardware.id}
            body={activeBody}
            hardware={activeHardware}
            machineOpacity={machineOpacity}
            cameraPreset={cameraPreset}
            autoRotate={autoRotate}
            onStopAutoRotate={onStopAutoRotate}
            resetTrigger={resetTrigger}
            isMobileOrPortrait={isMobileOrPortrait}
            isEditMode={isEditMode}
            prefersReducedMotion={prefersReducedMotion}
          />
        )}
      </Canvas>
    </div>
  );
}
