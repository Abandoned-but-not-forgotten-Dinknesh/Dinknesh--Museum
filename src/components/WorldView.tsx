import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Bounds, Center, OrbitControls, useBounds, useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Check, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { Body, MUSEUM_COPY } from '../data/missionsData';
import { PendingPinFocus, TransitionPhase } from '../hooks/useMuseumTransition';
import { createNormalizedWorldClone, latLonToVector3 } from '../utils/cloneWorldScene';
import { WorldModelErrorBoundary } from './LoadingGate';
import { PinLabelSide, SitePin, SitePinLayoutState } from './SitePin';

const WORLD_VIEW_RADIUS = 1.32;
const CROWDED_PIN_THRESHOLD_PX = 28;
const OPPOSITE_LABEL_THRESHOLD_PX = 76;
const noRaycast = () => null;

interface PinScreenMetric {
  hardwareId: string;
  lat: number;
  lon: number;
  screenX: number;
  screenY: number;
  isFrontSide: boolean;
  isCrowded: boolean;
  labelSide: PinLabelSide;
}

interface BoundsFitControllerProps {
  resetTrigger: number;
  bodyId: Body['id'];
  targetRef: React.RefObject<THREE.Group | null>;
}

function BoundsFitController({ resetTrigger, bodyId, targetRef }: BoundsFitControllerProps) {
  const bounds = useBounds();
  const { camera } = useThree();

  const fitCameraToModel = useCallback(() => {
    try {
      camera.near = 0.1;
      camera.far = 1000;
      camera.updateProjectionMatrix();

      if (targetRef.current) {
        bounds.refresh(targetRef.current).fit();
      } else {
        bounds.refresh().fit();
      }
    } catch (err) {
      console.error(`[WorldView] Bounds fit failed for body "${bodyId}":`, err);
    }
  }, [bounds, bodyId, camera, targetRef]);

  useEffect(() => {
    camera.near = 0.1;
    camera.far = 1000;
    camera.position.set(0, 0.25, 5.2);
    camera.lookAt(0, 0.22, 0);
    camera.updateProjectionMatrix();

    fitCameraToModel();
    const rafId = window.requestAnimationFrame(() => {
      fitCameraToModel();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [bodyId, camera, fitCameraToModel]);

  useEffect(() => {
    if (resetTrigger > 0) {
      fitCameraToModel();
    }
  }, [resetTrigger, fitCameraToModel]);

  return null;
}

interface WorldGlobeModelProps {
  body: Body;
  latOffset: number;
  lonOffset: number;
  pendingPinFocus: PendingPinFocus | null;
  transitionPhase: TransitionPhase;
  isTransitioning: boolean;
  resetTrigger: number;
  prefersReducedMotion: boolean;
  onSelectSite: (hardwareId: string, lat: number, lon: number) => void;
}

function WorldGlobeModel({
  body,
  latOffset,
  lonOffset,
  pendingPinFocus,
  transitionPhase,
  isTransitioning,
  resetTrigger,
  prefersReducedMotion,
  onSelectSite,
}: WorldGlobeModelProps) {
  const { scene } = useGLTF(body.url);
  const { gl, camera, size } = useThree();

  const rootGroupRef = useRef<THREE.Group | null>(null);
  const spinGroupRef = useRef<THREE.Group | null>(null);
  const globeMeshOnlyRef = useRef<THREE.Group | null>(null);
  const boundsTargetRef = useRef<THREE.Group | null>(null);
  const atmosphereMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const currentOpacityRef = useRef<number>(1);
  const desiredCamPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.25, 3.1));

  // Scratch vectors for per-frame dot product and screen projection
  const globeWorldCenterRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const pinWorldPosRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const worldNormalRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const toCameraRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const ndcVecRef = useRef<THREE.Vector3>(new THREE.Vector3());

  // Per-pin screen metrics for nearest-cursor hit detection
  const pinMetricsRef = useRef<PinScreenMetric[]>([]);

  // Active pin state (hovered via cursor proximity or focused via keyboard)
  const [hoveredHardwareId, setHoveredHardwareId] = useState<string | null>(null);
  const [focusedHardwareId, setFocusedHardwareId] = useState<string | null>(null);

  // Per-pin layout state (front-side dot product visibility, <28px ring shrink, left/right label side)
  const [pinLayouts, setPinLayouts] = useState<Record<string, SitePinLayoutState>>(() => {
    const initial: Record<string, SitePinLayoutState> = {};
    body.hardware.forEach((hw) => {
      initial[hw.id] = {
        isFrontSide: true,
        isCrowded: false,
        labelSide: 'right',
      };
    });
    return initial;
  });

  const { clonedScene, normalizedRadius, clonedMaterials } = useMemo(() => {
    try {
      return createNormalizedWorldClone(scene, gl, WORLD_VIEW_RADIUS, false);
    } catch (err) {
      console.error(`[WorldView] Error cloning scene for body "${body.id}":`, err);
      throw err;
    }
  }, [scene, gl, body.id]);

  // Local 3D coordinates of each machine's primary landing site on the sphere
  const localPinPoints = useMemo(() => {
    return body.hardware.map((hw) => {
      const primarySite = hw.sites[0] ?? { label: hw.name, lat: 0, lon: 0 };
      const localPos = latLonToVector3(
        primarySite.lat,
        primarySite.lon,
        normalizedRadius * 1.045,
        latOffset,
        lonOffset
      );
      return {
        hardware: hw,
        site: primarySite,
        localPos,
      };
    });
  }, [body.hardware, normalizedRadius, latOffset, lonOffset]);

  // Force full opacity and reset transforms on mount
  useEffect(() => {
    currentOpacityRef.current = 1;
    if (rootGroupRef.current) {
      rootGroupRef.current.position.set(0, 0.22, 0);
      rootGroupRef.current.rotation.set(0, 0, 0);
      rootGroupRef.current.scale.set(1, 1, 1);
      rootGroupRef.current.visible = true;
    }
    if (spinGroupRef.current) {
      spinGroupRef.current.position.set(0, 0, 0);
      spinGroupRef.current.rotation.set(0, 0, 0);
      spinGroupRef.current.scale.set(1, 1, 1);
      spinGroupRef.current.visible = true;
    }
    clonedMaterials.forEach((mat) => {
      mat.opacity = 1;
      mat.transparent = false;
      mat.visible = true;
      mat.depthWrite = true;
      mat.needsUpdate = true;
    });
  }, [clonedMaterials]);

  useEffect(() => {
    return () => {
      document.body.style.cursor = 'auto';
      clonedMaterials.forEach((mat) => mat.dispose());
    };
  }, [clonedMaterials]);

  /**
   * Resolves which visible front-side pin is closest to the cursor (clientX, clientY).
   * Ensures that when two pins are close (<28px), the pin nearest the cursor always wins.
   */
  const resolveNearestPin = useCallback(
    (clientX: number, clientY: number, fallbackHardwareId: string): PinScreenMetric | null => {
      const rect = gl.domElement.getBoundingClientRect();
      const cursorX = clientX - rect.left;
      const cursorY = clientY - rect.top;

      const metrics = pinMetricsRef.current.filter((m) => m.isFrontSide);
      if (metrics.length === 0) return null;

      let bestMetric: PinScreenMetric | null = null;
      let bestDist = Infinity;

      for (const m of metrics) {
        const dRing = Math.hypot(cursorX - m.screenX, cursorY - m.screenY);
        const labelOffsetX = m.labelSide === 'left' ? -24 : 24;
        const dLabel = Math.hypot(cursorX - (m.screenX + labelOffsetX), cursorY - m.screenY);
        // Weight ring distance primary so between two nearby rings the closer ring center always wins
        const effectiveDist = Math.min(dRing, dLabel + 4);
        if (effectiveDist < bestDist) {
          bestDist = effectiveDist;
          bestMetric = m;
        }
      }

      if (bestMetric && bestDist <= 56) {
        return bestMetric;
      }

      return metrics.find((m) => m.hardwareId === fallbackHardwareId) ?? bestMetric;
    },
    [gl]
  );

  // Track pointer movement across the canvas so moving between two close pins smoothly picks the nearest pin
  useEffect(() => {
    const domEl = gl.domElement.parentElement ?? gl.domElement;
    const onWindowPointerMove = (e: PointerEvent) => {
      if (isTransitioning) return;
      const rect = gl.domElement.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const metrics = pinMetricsRef.current.filter((m) => m.isFrontSide);
      let nearestId: string | null = null;
      let nearestDist = Infinity;

      for (const m of metrics) {
        const dRing = Math.hypot(cursorX - m.screenX, cursorY - m.screenY);
        const labelOffsetX = m.labelSide === 'left' ? -24 : 24;
        const dLabel = Math.hypot(cursorX - (m.screenX + labelOffsetX), cursorY - m.screenY);
        const d = Math.min(dRing, dLabel + 4);
        if (d < nearestDist) {
          nearestDist = d;
          nearestId = m.hardwareId;
        }
      }

      if (nearestId && nearestDist <= 30) {
        setHoveredHardwareId((prev) => (prev === nearestId ? prev : nearestId));
      } else if (nearestDist > 42) {
        setHoveredHardwareId((prev) => (prev === null ? prev : null));
      }
    };

    domEl.addEventListener('pointermove', onWindowPointerMove, { passive: true });
    return () => {
      domEl.removeEventListener('pointermove', onWindowPointerMove);
    };
  }, [gl, isTransitioning]);

  const handlePointerHoverPin = useCallback(
    (hardwareId: string, clientX: number, clientY: number) => {
      const winner = resolveNearestPin(clientX, clientY, hardwareId);
      setHoveredHardwareId(winner ? winner.hardwareId : hardwareId);
    },
    [resolveNearestPin]
  );

  const handlePointerLeavePin = useCallback((hardwareId: string) => {
    setHoveredHardwareId((prev) => (prev === hardwareId ? null : prev));
  }, []);

  const handleFocusPin = useCallback((hardwareId: string) => {
    setFocusedHardwareId(hardwareId);
  }, []);

  const handleBlurPin = useCallback((hardwareId: string) => {
    setFocusedHardwareId((prev) => (prev === hardwareId ? null : prev));
  }, []);

  const handleClickPin = useCallback(
    (hardwareId: string, lat: number, lon: number, clientX: number, clientY: number) => {
      // Keyboard activation has clientX === 0 && clientY === 0; pointer click resolves nearest pin
      if (clientX !== 0 || clientY !== 0) {
        const winner = resolveNearestPin(clientX, clientY, hardwareId);
        if (winner) {
          onSelectSite(winner.hardwareId, winner.lat, winner.lon);
          return;
        }
      }
      onSelectSite(hardwareId, lat, lon);
    },
    [resolveNearestPin, onSelectSite]
  );

  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.1);

    if (spinGroupRef.current) {
      if (pendingPinFocus && transitionPhase === 'to-machine') {
        // Rotate globe smoothly so the clicked pin faces the camera (+Z)
        const targetLonRad = -THREE.MathUtils.degToRad(pendingPinFocus.lon + lonOffset);
        const targetLatRad = THREE.MathUtils.degToRad(pendingPinFocus.lat + latOffset) * 0.45;

        const currentY = spinGroupRef.current.rotation.y;
        const diffY = Math.atan2(
          Math.sin(targetLonRad - currentY),
          Math.cos(targetLonRad - currentY)
        );

        const rotLambda = prefersReducedMotion ? 16 : 4.8;
        spinGroupRef.current.rotation.y = THREE.MathUtils.damp(
          currentY,
          currentY + diffY,
          rotLambda,
          dt
        );
        spinGroupRef.current.rotation.x = THREE.MathUtils.damp(
          spinGroupRef.current.rotation.x,
          targetLatRad,
          rotLambda,
          dt
        );

        // Ease the camera in toward the globe surface (~900ms)
        const dir = camera.position.clone().sub(new THREE.Vector3(0, 0.22, 0)).normalize();
        desiredCamPosRef.current.copy(dir.multiplyScalar(2.75).add(new THREE.Vector3(0, 0.22, 0)));
        camera.position.lerp(desiredCamPosRef.current, 1 - Math.exp(-3.8 * dt));
      } else if (!prefersReducedMotion && !isTransitioning) {
        spinGroupRef.current.rotation.y += body.landingRotationSpeed * dt;
        spinGroupRef.current.rotation.x = THREE.MathUtils.damp(
          spinGroupRef.current.rotation.x,
          0,
          3,
          dt
        );
      }

      // Compute dot product visibility and 2D screen proximity for all pins
      spinGroupRef.current.updateMatrixWorld();
      spinGroupRef.current.getWorldPosition(globeWorldCenterRef.current);

      const nextMetrics: PinScreenMetric[] = localPinPoints.map(({ hardware, site, localPos }) => {
        pinWorldPosRef.current.copy(localPos).applyMatrix4(spinGroupRef.current!.matrixWorld);

        // Outward normal from globe center to pin
        worldNormalRef.current
          .copy(pinWorldPosRef.current)
          .sub(globeWorldCenterRef.current)
          .normalize();

        // Vector from pin to camera
        toCameraRef.current.copy(camera.position).sub(pinWorldPosRef.current).normalize();

        // Dot product check: positive when on the hemisphere facing the camera
        const dot = worldNormalRef.current.dot(toCameraRef.current);
        const isFrontSide = dot > 0.05;

        // Project into screen pixel coordinates
        ndcVecRef.current.copy(pinWorldPosRef.current).project(camera);
        const screenX = (ndcVecRef.current.x * 0.5 + 0.5) * size.width;
        const screenY = (-ndcVecRef.current.y * 0.5 + 0.5) * size.height;

        return {
          hardwareId: hardware.id,
          lat: site.lat,
          lon: site.lon,
          screenX,
          screenY,
          isFrontSide,
          isCrowded: false,
          labelSide: 'right' as PinLabelSide,
        };
      });

      // Pairwise screen-pixel check (< 28px shrinks rings and places labels on opposite sides)
      for (let i = 0; i < nextMetrics.length; i++) {
        for (let j = i + 1; j < nextMetrics.length; j++) {
          const a = nextMetrics[i];
          const b = nextMetrics[j];
          if (!a.isFrontSide || !b.isFrontSide) continue;

          const distPx = Math.hypot(a.screenX - b.screenX, a.screenY - b.screenY);
          if (distPx < OPPOSITE_LABEL_THRESHOLD_PX) {
            if (distPx < CROWDED_PIN_THRESHOLD_PX) {
              a.isCrowded = true;
              b.isCrowded = true;
            }
            // Place labels on opposite sides (one left, one right) so they never overlap
            if (a.screenX <= b.screenX) {
              a.labelSide = 'left';
              b.labelSide = 'right';
            } else {
              a.labelSide = 'right';
              b.labelSide = 'left';
            }
          }
        }
      }

      pinMetricsRef.current = nextMetrics;

      // Clear hover if the hovered pin rotated onto the far side of the globe
      if (hoveredHardwareId) {
        const hoveredMetric = nextMetrics.find((m) => m.hardwareId === hoveredHardwareId);
        if (hoveredMetric && !hoveredMetric.isFrontSide) {
          setHoveredHardwareId(null);
          document.body.style.cursor = 'auto';
        }
      }

      // Update React layout state only when a boolean/side actually changes
      setPinLayouts((prev) => {
        let changed = false;
        for (const m of nextMetrics) {
          const cur = prev[m.hardwareId];
          if (
            !cur ||
            cur.isFrontSide !== m.isFrontSide ||
            cur.isCrowded !== m.isCrowded ||
            cur.labelSide !== m.labelSide
          ) {
            changed = true;
            break;
          }
        }
        if (!changed) return prev;

        const updated: Record<string, SitePinLayoutState> = {};
        for (const m of nextMetrics) {
          updated[m.hardwareId] = {
            isFrontSide: m.isFrontSide,
            isCrowded: m.isCrowded,
            labelSide: m.labelSide,
          };
        }
        return updated;
      });
    }

    // Cross-fade out when transitioning into machine view
    const targetOpacity = transitionPhase === 'to-machine' ? 0.15 : 1.0;
    currentOpacityRef.current = THREE.MathUtils.damp(
      currentOpacityRef.current,
      targetOpacity,
      prefersReducedMotion ? 14 : 3.5,
      dt
    );
    const clamped = THREE.MathUtils.clamp(currentOpacityRef.current, 0, 1);

    clonedMaterials.forEach((mat) => {
      mat.opacity = clamped;
      const shouldBeTransparent = clamped < 0.995;
      if (mat.transparent !== shouldBeTransparent) {
        mat.transparent = shouldBeTransparent;
        mat.needsUpdate = true;
      }
    });

    if (atmosphereMatRef.current && body.atmosphere) {
      atmosphereMatRef.current.opacity = body.atmosphere.opacity * clamped;
    }
  });

  const activePinId = hoveredHardwareId ?? focusedHardwareId;

  return (
    <group ref={rootGroupRef} position={[0, 0.22, 0]} scale={[1, 1, 1]}>
      <group ref={spinGroupRef}>
        {/* <Bounds> wraps ONLY the normalized GLTF scene so atmosphere halo & pins never distort fitting */}
        <Bounds fit observe margin={1.48}>
          <group ref={boundsTargetRef}>
            <group ref={globeMeshOnlyRef}>
              <Center>
                <primitive object={clonedScene} />
              </Center>
            </group>
          </group>
          <BoundsFitController
            resetTrigger={resetTrigger}
            bodyId={body.id}
            targetRef={boundsTargetRef}
          />
        </Bounds>

        {/* Exactly 1 landing-site pin per hardware entry in body.hardware (3 on Moon, 3 on Mars) */}
        {localPinPoints.map(({ hardware, site }, index) => {
          const layout = pinLayouts[hardware.id] ?? {
            isFrontSide: true,
            isCrowded: false,
            labelSide: 'right',
          };
          return (
            <SitePin
              key={hardware.id}
              hardware={hardware}
              site={site}
              pinIndex={index}
              radius={normalizedRadius}
              latOffset={latOffset}
              lonOffset={lonOffset}
              layout={layout}
              isActive={activePinId === hardware.id}
              isTransitioning={isTransitioning}
              prefersReducedMotion={prefersReducedMotion}
              onPointerHoverPin={handlePointerHoverPin}
              onPointerLeavePin={handlePointerLeavePin}
              onFocusPin={handleFocusPin}
              onBlurPin={handleBlurPin}
              onClickPin={handleClickPin}
            />
          );
        })}

        {/* Optional atmosphere rim rendered OUTSIDE <Bounds> with depthWrite={false} and no raycast */}
        {body.atmosphere && (
          <mesh raycast={noRaycast}>
            <sphereGeometry args={[normalizedRadius * body.atmosphere.scale, 48, 48]} />
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
      </group>
    </group>
  );
}

export interface WorldViewSceneProps {
  body: Body;
  latOffset: number;
  lonOffset: number;
  pendingPinFocus: PendingPinFocus | null;
  transitionPhase: TransitionPhase;
  isTransitioning: boolean;
  autoRotate: boolean;
  onStopAutoRotate: () => void;
  resetTrigger: number;
  prefersReducedMotion: boolean;
  onSelectSite: (hardwareId: string, lat: number, lon: number) => void;
}

export function WorldView({
  body,
  latOffset,
  lonOffset,
  pendingPinFocus,
  transitionPhase,
  isTransitioning,
  autoRotate,
  onStopAutoRotate,
  resetTrigger,
  prefersReducedMotion,
  onSelectSite,
}: WorldViewSceneProps) {
  const handleOrbitStart = useCallback(() => {
    onStopAutoRotate();
  }, [onStopAutoRotate]);

  const handlePinSelect = useCallback(
    (hardwareId: string, lat: number, lon: number) => {
      onStopAutoRotate();
      onSelectSite(hardwareId, lat, lon);
    },
    [onStopAutoRotate, onSelectSite]
  );

  return (
    <group key={body.id} name={`world-view-${body.id}`}>
      <directionalLight position={[5, 8, 5]} intensity={1.6} color={body.keyLightColor} />

      <OrbitControls
        makeDefault
        enabled={!isTransitioning}
        target={[0, 0.22, 0]}
        minDistance={2.2}
        maxDistance={18}
        enableDamping
        dampingFactor={0.05}
        autoRotate={autoRotate && !prefersReducedMotion && !isTransitioning}
        autoRotateSpeed={0.4}
        onStart={handleOrbitStart}
      />

      <WorldModelErrorBoundary key={`eb-${body.id}`} body={body}>
        <Suspense fallback={null}>
          <WorldGlobeModel
            key={`model-${body.id}`}
            body={body}
            latOffset={latOffset}
            lonOffset={lonOffset}
            pendingPinFocus={pendingPinFocus}
            transitionPhase={transitionPhase}
            isTransitioning={isTransitioning}
            resetTrigger={resetTrigger}
            prefersReducedMotion={prefersReducedMotion}
            onSelectSite={handlePinSelect}
          />
        </Suspense>
      </WorldModelErrorBoundary>
    </group>
  );
}

export interface WorldViewPlacardProps {
  body: Body;
  hudCollapsed: boolean;
  isMobileOrPortrait: boolean;
  onSelectHardware: (hardwareId: string) => void;
}

/**
 * Compact bottom-left world overview placard.
 * Machine count and "Begin with <first machine> →" are computed dynamically from body.hardware.
 */
export function WorldViewPlacard({
  body,
  hudCollapsed,
  isMobileOrPortrait,
  onSelectHardware,
}: WorldViewPlacardProps) {
  const [placardCollapsed, setPlacardCollapsed] = useState<boolean>(isMobileOrPortrait);

  useEffect(() => {
    setPlacardCollapsed(isMobileOrPortrait);
  }, [isMobileOrPortrait, body.id]);

  const firstMachine = body.hardware[0];
  const machineCountLabel = MUSEUM_COPY.getMachinesAbandonedLabel(body.hardware.length);

  return (
    <section
      aria-label={`${body.name} Curatorial Placard`}
      className={`pointer-events-auto w-full sm:w-[320px] rounded-xl bg-[rgba(20,22,28,0.78)] backdrop-blur-xl border border-[rgba(255,255,255,0.08)] p-3.5 sm:p-4 animate-hud-fade-in transition-opacity duration-300 ${
        hudCollapsed ? 'opacity-0 pointer-events-none hidden sm:block' : 'opacity-100'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="block font-mono text-[10px] uppercase tracking-widest text-[#6FB3C2] truncate">
            {machineCountLabel}
          </span>
          <h2 className="font-display text-sm sm:text-base font-semibold text-[#ECEDEF] tracking-tight truncate">
            {body.name}
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setPlacardCollapsed((prev) => !prev)}
          aria-expanded={!placardCollapsed}
          aria-label={
            placardCollapsed ? MUSEUM_COPY.expandPlacard : MUSEUM_COPY.collapsePlacard
          }
          className="shrink-0 min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-transparent border border-[#C9A45C]/50 hover:bg-[#C9A45C]/10 text-[#C9A45C] font-mono text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
        >
          <span className="sm:hidden">
            {placardCollapsed ? MUSEUM_COPY.expandPlacard : MUSEUM_COPY.collapsePlacard}
          </span>
          {placardCollapsed ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {!placardCollapsed && (
        <div>
          <div className="my-2.5 h-px w-full bg-[#C9A45C]/35" />

          <p className="font-sans text-xs text-[#9096A2] leading-relaxed">
            {body.tagline}
          </p>

          <div className="mt-3">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#6FB3C2] mb-1.5">
              {MUSEUM_COPY.previewHeading}
            </div>
            <ul className="space-y-1">
              {body.hardware.map((hw) => (
                <li key={hw.id}>
                  <button
                    type="button"
                    onClick={() => onSelectHardware(hw.id)}
                    className="w-full flex items-baseline justify-between gap-2 py-1 px-1.5 -mx-1.5 rounded hover:bg-[#C9A45C]/10 text-left transition-colors cursor-pointer group"
                  >
                    <span className="font-sans text-xs text-[#ECEDEF] group-hover:text-[#C9A45C] transition-colors">
                      {hw.name}
                    </span>
                    <span className="font-mono text-[11px] text-[#6FB3C2] tabular-nums shrink-0">
                      {hw.year}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {firstMachine && (
            <button
              type="button"
              onClick={() => onSelectHardware(firstMachine.id)}
              className="mt-3 w-full min-h-[38px] inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-transparent border border-[#C9A45C] hover:bg-[#C9A45C]/10 text-[#C9A45C] font-mono text-[11px] uppercase tracking-wider transition-colors cursor-pointer"
            >
              {MUSEUM_COPY.getBeginWithLabel(firstMachine.name)}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export interface WorldCalibrationPanelProps {
  bodyName: string;
  lonOffset: number;
  latOffset: number;
  onChangeLonOffset: (val: number) => void;
  onChangeLatOffset: (val: number) => void;
}

/**
 * Calibration tool (?calibrate=1): sliders for lonOffset and latOffset (-180 to 180)
 * for the current body and a "Copy values" button.
 */
export function WorldCalibrationPanel({
  bodyName,
  lonOffset,
  latOffset,
  onChangeLonOffset,
  onChangeLatOffset,
}: WorldCalibrationPanelProps) {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = useCallback(() => {
    const text = `lonOffset: ${lonOffset}, latOffset: ${latOffset}`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }, [lonOffset, latOffset]);

  return (
    <aside
      aria-label="Pin Calibration Controls"
      className="pointer-events-auto w-[260px] rounded-xl bg-[rgba(20,22,28,0.85)] backdrop-blur-xl border border-[#C9A45C]/50 p-4 animate-hud-fade-in"
    >
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#C9A45C]">
          {MUSEUM_COPY.calibrateHeading} · {bodyName.toUpperCase()}
        </span>
      </div>

      <div className="space-y-3">
        <label className="block">
          <div className="flex items-center justify-between font-mono text-[11px] mb-1">
            <span className="text-[#6FB3C2]">{MUSEUM_COPY.calibrateLon}</span>
            <span className="text-[#ECEDEF] tabular-nums">{lonOffset}°</span>
          </div>
          <input
            type="range"
            min={-180}
            max={180}
            step={1}
            value={lonOffset}
            onChange={(e) => onChangeLonOffset(Number(e.target.value))}
            className="w-full accent-[#C9A45C] cursor-pointer"
          />
        </label>

        <label className="block">
          <div className="flex items-center justify-between font-mono text-[11px] mb-1">
            <span className="text-[#6FB3C2]">{MUSEUM_COPY.calibrateLat}</span>
            <span className="text-[#ECEDEF] tabular-nums">{latOffset}°</span>
          </div>
          <input
            type="range"
            min={-180}
            max={180}
            step={1}
            value={latOffset}
            onChange={(e) => onChangeLatOffset(Number(e.target.value))}
            className="w-full accent-[#C9A45C] cursor-pointer"
          />
        </label>

        <button
          type="button"
          onClick={handleCopy}
          className="w-full min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-transparent border border-[#C9A45C] hover:bg-[#C9A45C]/10 text-[#C9A45C] font-mono text-[11px] uppercase tracking-widest transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>{MUSEUM_COPY.calibrateCopied}</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>{MUSEUM_COPY.calibrateCopy}</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
