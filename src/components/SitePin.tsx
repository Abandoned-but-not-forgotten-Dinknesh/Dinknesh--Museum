import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { Hardware, Site } from '../data/missionsData';
import { latLonToVector3 } from '../utils/cloneWorldScene';

export type PinLabelSide = 'left' | 'right';

export interface SitePinLayoutState {
  isFrontSide: boolean;
  isCrowded: boolean;
  labelSide: PinLabelSide;
}

export interface SitePinProps {
  hardware: Hardware;
  site: Site;
  pinIndex: number;
  radius: number;
  latOffset: number;
  lonOffset: number;
  layout: SitePinLayoutState;
  isActive: boolean;
  isTransitioning: boolean;
  prefersReducedMotion: boolean;
  onPointerHoverPin: (hardwareId: string, clientX: number, clientY: number) => void;
  onPointerLeavePin: (hardwareId: string) => void;
  onFocusPin: (hardwareId: string) => void;
  onBlurPin: (hardwareId: string) => void;
  onClickPin: (hardwareId: string, lat: number, lon: number, clientX: number, clientY: number) => void;
}

export function SitePin({
  hardware,
  site,
  pinIndex,
  radius,
  latOffset,
  lonOffset,
  layout,
  isActive,
  isTransitioning,
  prefersReducedMotion,
  onPointerHoverPin,
  onPointerLeavePin,
  onFocusPin,
  onBlurPin,
  onClickPin,
}: SitePinProps) {
  const { isFrontSide, isCrowded, labelSide } = layout;

  const pinPosition = useMemo(
    () => latLonToVector3(site.lat, site.lon, radius * 1.045, latOffset, lonOffset),
    [site.lat, site.lon, radius, latOffset, lonOffset]
  );

  const surfaceDotPosition = useMemo(
    () => latLonToVector3(site.lat, site.lon, radius * 1.006, latOffset, lonOffset),
    [site.lat, site.lon, radius, latOffset, lonOffset]
  );

  // If a hardware item represents multiple sites (e.g. Spirit & Opportunity), list both in the tooltip
  const siteSummaryLabel = useMemo(
    () => hardware.sites.map((s) => s.label).join(' · '),
    [hardware.sites]
  );

  const ariaLabel = `Explore ${hardware.name} (${hardware.year}) at ${siteSummaryLabel}`;

  // Stagger the pulse timing across pins so adjacent pins never pulse in unison
  const pulseDelayStyle = useMemo(
    () => ({
      animationDuration: '2.8s',
      animationDelay: `${(pinIndex * 0.75).toFixed(2)}s`,
    }),
    [pinIndex]
  );

  const isInteractive = isFrontSide && !isTransitioning;

  return (
    <group renderOrder={isActive ? 20 : 2}>
      {/* Subtle 3D brass anchor point on the planetary surface; hidden on far side */}
      <mesh
        position={surfaceDotPosition}
        visible={isFrontSide}
        renderOrder={isActive ? 20 : 2}
      >
        <sphereGeometry args={[isCrowded ? 0.014 : 0.018, 12, 12]} />
        <meshBasicMaterial color="#C9A45C" />
      </mesh>

      {/* Camera-side HTML Pin & Hover Tooltip with elevated render order when active */}
      <Html
        position={[pinPosition.x, pinPosition.y, pinPosition.z]}
        zIndexRange={isActive ? [100, 60] : [25, 0]}
        style={{
          zIndex: isActive ? 100 : 10,
          pointerEvents: isInteractive ? 'auto' : 'none',
          opacity: isFrontSide ? 1 : 0,
          visibility: isFrontSide ? 'visible' : 'hidden',
        }}
      >
        {/* Zero-size anchor centered at exact 3D pin coordinate */}
        <div
          className={`relative w-0 h-0 select-none ${
            isInteractive ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        >
          {/* Hover / Focus Glass Tooltip */}
          <div
            role="tooltip"
            aria-hidden={!isActive || !isFrontSide}
            className={`pointer-events-none absolute bottom-6 -translate-x-1/2 left-0 w-[215px] rounded-xl bg-[rgba(20,22,28,0.9)] backdrop-blur-xl border border-[rgba(255,255,255,0.08)] px-3.5 py-2.5 text-left transition-all duration-200 ${
              isActive && isFrontSide
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-1'
            }`}
            style={{ zIndex: isActive ? 110 : 15 }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-display text-xs font-semibold text-[#ECEDEF] leading-snug">
                {hardware.name}
              </span>
              <span className="font-mono text-[11px] text-[#6FB3C2] tabular-nums shrink-0">
                {hardware.year}
              </span>
            </div>
            <div className="my-1.5 h-px w-full bg-[#C9A45C]/30" />
            <p className="font-sans text-[11px] text-[#9096A2] leading-snug">
              {siteSummaryLabel}
            </p>
          </div>

          {/* Focusable Pin Button: ring stays centered on (0,0) while year label sits on labelSide ('left' or 'right') */}
          <button
            type="button"
            aria-label={ariaLabel}
            tabIndex={isInteractive ? 0 : -1}
            disabled={!isInteractive}
            onPointerEnter={(e) => {
              if (!isInteractive) return;
              document.body.style.cursor = 'pointer';
              onPointerHoverPin(hardware.id, e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (!isInteractive) return;
              document.body.style.cursor = 'pointer';
              onPointerHoverPin(hardware.id, e.clientX, e.clientY);
            }}
            onPointerLeave={() => {
              document.body.style.cursor = 'auto';
              onPointerLeavePin(hardware.id);
            }}
            onFocus={() => {
              if (!isInteractive) return;
              onFocusPin(hardware.id);
            }}
            onBlur={() => {
              onBlurPin(hardware.id);
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (!isInteractive) return;
              document.body.style.cursor = 'auto';
              onClickPin(hardware.id, site.lat, site.lon, e.clientX, e.clientY);
            }}
            className={`group absolute top-0 -translate-y-1/2 flex items-center gap-1 min-h-[36px] py-1 rounded-full bg-transparent cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0C10] ${
              labelSide === 'left'
                ? 'right-0 translate-x-[13px] flex-row-reverse pl-1.5 pr-0.5'
                : 'left-0 -translate-x-[13px] flex-row pl-0.5 pr-1.5'
            }`}
          >
            {/* Pulsing Brass Ring Container (shrinks slightly when within 28 screen pixels of another pin) */}
            <span
              className={`relative flex items-center justify-center transition-transform duration-200 ${
                isCrowded ? 'w-5 h-5 scale-[0.84]' : 'w-6 h-6 scale-100'
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute inset-0 rounded-full border transition-all duration-200 ${
                  isActive
                    ? 'border-[#C9A45C] scale-125 opacity-100'
                    : 'border-[#C9A45C]/70 scale-100 opacity-80'
                } ${!prefersReducedMotion && isFrontSide ? 'animate-ping' : ''}`}
                style={pulseDelayStyle}
              />
              <span
                aria-hidden="true"
                className={`relative flex items-center justify-center rounded-full border transition-all duration-200 ${
                  isCrowded ? 'w-4 h-4' : 'w-5 h-5'
                } ${
                  isActive
                    ? 'border-[#C9A45C] bg-[#C9A45C]/25 scale-110'
                    : 'border-[#C9A45C]/85 bg-[#0B0C10]/75 scale-100'
                }`}
              >
                <span
                  className={`rounded-full bg-[#C9A45C] ${
                    isCrowded ? 'w-1 h-1' : 'w-1.5 h-1.5'
                  }`}
                />
              </span>
            </span>

            {/* Small Year Label Badge placed on left or right side */}
            <span
              className={`px-1.5 py-0.5 rounded bg-[rgba(20,22,28,0.85)] border font-mono text-[10px] tabular-nums tracking-wider transition-colors duration-200 ${
                isActive
                  ? 'border-[#C9A45C] text-[#ECEDEF]'
                  : 'border-[rgba(255,255,255,0.08)] text-[#C9A45C]'
              }`}
            >
              {hardware.year}
            </span>
          </button>
        </div>
      </Html>
    </group>
  );
}
