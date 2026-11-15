import React, { useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Body, BodyId, MUSEUM_COPY } from '../data/missionsData';

export interface WorldHotspotProps {
  body: Body;
  radius: number;
  isMobileOrPortrait: boolean;
  occludeRef: React.RefObject<THREE.Group | null>;
  isHovered: boolean;
  isOtherHovered: boolean;
  isTransitioning: boolean;
  labelsVisible: boolean;
  prefersReducedMotion: boolean;
  onHoverChange: (id: BodyId | null) => void;
  onSelect: (id: BodyId) => void;
  registerHotspotRef: (id: BodyId, el: HTMLButtonElement | null) => void;
  onArrowNavigate: (currentId: BodyId, direction: 'left' | 'right') => void;
}

export function WorldHotspot({
  body,
  radius,
  isMobileOrPortrait,
  occludeRef,
  isHovered,
  isOtherHovered,
  isTransitioning,
  labelsVisible,
  prefersReducedMotion,
  onHoverChange,
  onSelect,
  registerHotspotRef,
  onArrowNavigate,
}: WorldHotspotProps) {
  useEffect(() => {
    return () => {
      document.body.style.cursor = 'auto';
    };
  }, []);

  const handlePointerOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (isTransitioning || !labelsVisible) return;
      document.body.style.cursor = 'pointer';
      onHoverChange(body.id);
    },
    [body.id, isTransitioning, labelsVisible, onHoverChange]
  );

  const handlePointerOut = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      document.body.style.cursor = 'auto';
      onHoverChange(null);
    },
    [onHoverChange]
  );

  const handleMeshClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (isTransitioning || !labelsVisible) return;
      document.body.style.cursor = 'auto';
      onSelect(body.id);
    },
    [body.id, isTransitioning, labelsVisible, onSelect]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (isTransitioning || !labelsVisible) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onArrowNavigate(body.id, 'left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onArrowNavigate(body.id, 'right');
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(body.id);
      }
    },
    [body.id, isTransitioning, labelsVisible, onArrowNavigate, onSelect]
  );

  const ariaLabel = MUSEUM_COPY.getExploreAriaLabel(body.name);

  const opacityClass = !labelsVisible
    ? 'opacity-0 pointer-events-none'
    : isOtherHovered
      ? 'opacity-55'
      : 'opacity-100';

  const labelOffsetY = isMobileOrPortrait ? -radius - 0.44 : -radius - 0.52;
  const tooltipOffsetY = isMobileOrPortrait ? radius + 0.34 : radius + 0.42;

  return (
    <group>
      {/* Large invisible sphere collider slightly bigger than the normalized model */}
      <mesh
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleMeshClick}
      >
        <sphereGeometry args={[radius * 1.22, 24, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Camera-facing pulsing thin brass ring using drei <Html> with occlusion */}
      <Html
        position={[0, 0, radius * 1.08]}
        center
        occlude={[occludeRef as React.RefObject<THREE.Object3D>]}
        zIndexRange={[20, 0]}
      >
        <div
          className={`transition-opacity duration-300 ${
            labelsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <button
            ref={(el) => registerHotspotRef(body.id, el)}
            type="button"
            aria-label={ariaLabel}
            disabled={isTransitioning || !labelsVisible}
            onMouseEnter={() => {
              if (!isTransitioning && labelsVisible) onHoverChange(body.id);
            }}
            onMouseLeave={() => {
              if (!isTransitioning && labelsVisible) onHoverChange(null);
            }}
            onFocus={() => {
              if (!isTransitioning && labelsVisible) onHoverChange(body.id);
            }}
            onBlur={() => {
              if (!isTransitioning && labelsVisible) onHoverChange(null);
            }}
            onKeyDown={handleKeyDown}
            onClick={(e) => {
              e.stopPropagation();
              if (!isTransitioning && labelsVisible) onSelect(body.id);
            }}
            className="group relative flex items-center justify-center min-w-[48px] min-h-[48px] w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-transparent cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0C10]"
          >
            {/* Outer subtle pulsing thin brass ring */}
            <span
              aria-hidden="true"
              className={`absolute inset-0 rounded-full border transition-all duration-300 ${
                isHovered
                  ? 'border-[#C9A45C] scale-110 opacity-100'
                  : 'border-[#C9A45C]/65 scale-100 opacity-75'
              } ${!prefersReducedMotion ? 'animate-ping' : ''}`}
              style={{ animationDuration: '3.2s' }}
            />
            {/* Core crisp thin brass ring */}
            <span
              aria-hidden="true"
              className={`relative block w-9 h-9 sm:w-10 sm:h-10 rounded-full border transition-all duration-300 ${
                isHovered
                  ? 'border-[#C9A45C] bg-[#C9A45C]/15 scale-105'
                  : 'border-[#C9A45C]/70 bg-[#0B0C10]/30 scale-100'
              }`}
            />
            {/* Center reticle point */}
            <span
              aria-hidden="true"
              className={`absolute w-1.5 h-1.5 rounded-full bg-[#C9A45C] transition-transform duration-300 ${
                isHovered ? 'scale-125 opacity-100' : 'scale-100 opacity-80'
              }`}
            />
          </button>
        </div>
      </Html>

      {/* Hover / Focus Glass Tooltip listing preview machines with years */}
      <Html
        position={[0, tooltipOffsetY, 0]}
        center
        zIndexRange={[30, 0]}
      >
        <div
          role="tooltip"
          aria-hidden={!isHovered || !labelsVisible}
          className={`pointer-events-none select-none w-[235px] sm:w-[265px] rounded-xl bg-[rgba(20,22,28,0.82)] backdrop-blur-xl border border-[rgba(255,255,255,0.08)] p-3.5 transition-all duration-300 ${
            isHovered && labelsVisible
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-1.5'
          }`}
        >
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#6FB3C2] mb-1.5">
            {MUSEUM_COPY.previewHeading}
          </div>
          <div className="h-px w-full bg-[#C9A45C]/30 mb-2" />
          <ul className="space-y-1">
            {body.preview.map((item) => (
              <li
                key={item.name}
                className="flex items-baseline justify-between gap-3 text-xs"
              >
                <span className="font-sans text-[#ECEDEF] text-left leading-snug">
                  {item.name}
                </span>
                <span className="font-mono text-[11px] text-[#9096A2] tabular-nums shrink-0">
                  {item.year}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Html>

      {/* Under-World Glass Label positioned cleanly inside the safe area */}
      <Html
        position={[0, labelOffsetY, 0]}
        center
        zIndexRange={[25, 0]}
      >
        <div
          onClick={() => {
            if (!isTransitioning && labelsVisible) onSelect(body.id);
          }}
          onMouseEnter={() => {
            if (!isTransitioning && labelsVisible) onHoverChange(body.id);
          }}
          onMouseLeave={() => {
            if (!isTransitioning && labelsVisible) onHoverChange(null);
          }}
          className={`w-[220px] sm:w-[255px] rounded-xl bg-[rgba(20,22,28,0.78)] backdrop-blur-xl border transition-all duration-300 px-3.5 py-2.5 sm:p-3.5 text-center select-none cursor-pointer ${
            isHovered
              ? 'border-[#C9A45C]/60'
              : 'border-[rgba(255,255,255,0.08)]'
          } ${opacityClass}`}
        >
          <h2 className="font-display text-sm sm:text-base font-semibold text-[#ECEDEF] tracking-tight leading-snug">
            {body.name}
          </h2>
          <p className="mt-0.5 font-sans text-[11px] sm:text-xs text-[#9096A2] leading-snug">
            {body.tagline}
          </p>
          <div className="my-2 h-px w-full bg-[#C9A45C]/25" />
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] sm:text-[11px] uppercase tracking-widest text-[#6FB3C2]">
              {MUSEUM_COPY.getMachinesAbandonedLabel(body.hardware.length)}
            </span>
            <span
              className={`font-mono text-[10px] sm:text-[11px] uppercase tracking-widest transition-colors ${
                isHovered ? 'text-[#C9A45C]' : 'text-[#ECEDEF]'
              }`}
            >
              {MUSEUM_COPY.exploreLabel} →
            </span>
          </div>
        </div>
      </Html>
    </group>
  );
}
