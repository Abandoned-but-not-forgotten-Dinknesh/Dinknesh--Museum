import React from 'react';
import { ArrowLeft, RotateCcw, X } from 'lucide-react';
import { BODY_BY_ID, BodyId, MUSEUM_COPY, findHardware } from '../data/missionsData';
import { MuseumView } from '../hooks/useMuseumTransition';
import {
  WorldCalibrationPanel,
  WorldViewPlacard,
} from './WorldView';
import { ChapterBar } from './ChapterBar';
import { MachineCameraPreset } from './MachineView';
import { Placard } from './Placard';

export interface HudOverlayProps {
  isReady: boolean;
  view: MuseumView;
  activeBodyId: BodyId | null;
  activeHardwareId: string | null;
  isTransitioning: boolean;
  isMobileOrPortrait: boolean;
  isCalibrateMode: boolean;
  prefersReducedMotion: boolean;
  autoRotate: boolean;
  hudCollapsed: boolean;
  aboutOpen: boolean;
  cameraPreset: MachineCameraPreset;
  latOffset: number;
  lonOffset: number;
  onChangeLatOffset: (val: number) => void;
  onChangeLonOffset: (val: number) => void;
  onSelectCameraPreset: (preset: MachineCameraPreset) => void;
  onToggleAbout: () => void;
  onCloseAbout: () => void;
  onResetView: () => void;
  onGoBack: () => void;
  onSelectHardware: (hardwareId: string) => void;
  onStepChapter: (direction: 'prev' | 'next') => void;
}

export function HudOverlay({
  isReady,
  view,
  activeBodyId,
  activeHardwareId,
  isTransitioning,
  isMobileOrPortrait,
  isCalibrateMode,
  prefersReducedMotion,
  autoRotate,
  hudCollapsed,
  aboutOpen,
  cameraPreset,
  latOffset,
  lonOffset,
  onChangeLatOffset,
  onChangeLonOffset,
  onSelectCameraPreset,
  onToggleAbout,
  onCloseAbout,
  onResetView,
  onGoBack,
  onSelectHardware,
  onStepChapter,
}: HudOverlayProps) {
  if (!isReady) {
    return null;
  }

  const activeBody = activeBodyId ? BODY_BY_ID[activeBodyId] : null;
  const activeHardware = findHardware(activeBodyId, activeHardwareId);
  const isWorldView = view === 'world' && activeBody !== null;
  const isMachineView = view === 'machine' && activeBody !== null && activeHardware !== null;

  const backLabel = isMachineView && activeBody
    ? `${MUSEUM_COPY.backToWorldPrefix} ${activeBody.name}`
    : MUSEUM_COPY.backToHall;

  const aboutTransitionClasses = prefersReducedMotion
    ? `transition-opacity duration-250 ${
        aboutOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`
    : `transition-all duration-250 ease-out ${
        aboutOpen
          ? 'opacity-100 translate-x-0 pointer-events-auto'
          : 'opacity-0 translate-x-6 pointer-events-none'
      }`;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-6">
      {/* TOP BAR: Top-Left Unboxed Wordmark (+ Action Controls) & Top-Right About Button */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col items-start max-w-[74vw] sm:max-w-xl">
          {/* 1. HEADER AS A WORDMARK (pointer-events-none) */}
          <header
            aria-label="Museum Wordmark"
            className="pointer-events-none select-none animate-wordmark-fade-in"
          >
            <h1 className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 leading-tight line-clamp-2">
              <span className="font-ethiopic text-[22px] sm:text-[28px] font-semibold text-[#ECEDEF] tracking-tight">
                {MUSEUM_COPY.titleEthiopic}
              </span>
              <span className="font-display text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.3em] text-[#9096A2]">
                {MUSEUM_COPY.titleLatin}
              </span>
            </h1>
            <div className="mt-2 w-12 h-px bg-[#C9A45C]" />
          </header>

          {/* Controls under Wordmark in World or Machine View */}
          {(isWorldView || isMachineView) && !hudCollapsed && (
            <div className="mt-3 flex flex-wrap items-center gap-2 animate-hud-fade-in">
              {/* Back Button (Machine -> World, World -> Hub) */}
              <button
                type="button"
                disabled={isTransitioning}
                onClick={onGoBack}
                className="pointer-events-auto min-h-[44px] sm:min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(20,22,28,0.78)] backdrop-blur-xl border border-[#C9A45C] text-[#C9A45C] hover:bg-[#C9A45C]/10 font-display text-[11px] font-medium tracking-widest uppercase transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A45C]"
              >
                <ArrowLeft className="w-3.5 h-3.5 stroke-[1.75]" />
                <span>{backLabel}</span>
              </button>

              {/* Guided Camera Buttons in Machine View ("Overview" and "Close-up") */}
              {isMachineView && (
                <div
                  role="group"
                  aria-label="Guided Camera Presets"
                  className="pointer-events-auto inline-flex items-center p-0.5 rounded-lg bg-[rgba(20,22,28,0.78)] backdrop-blur-xl border border-[rgba(255,255,255,0.08)]"
                >
                  <button
                    type="button"
                    onClick={() => onSelectCameraPreset('overview')}
                    className={`min-h-[40px] sm:min-h-[32px] px-2.5 py-1 rounded-md font-mono text-[11px] uppercase tracking-wider transition-colors cursor-pointer ${
                      cameraPreset === 'overview'
                        ? 'bg-[#C9A45C]/15 text-[#C9A45C] border border-[#C9A45C]/60'
                        : 'text-[#9096A2] hover:text-[#ECEDEF] border border-transparent'
                    }`}
                  >
                    {MUSEUM_COPY.cameraOverview}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectCameraPreset('closeup')}
                    className={`min-h-[40px] sm:min-h-[32px] px-2.5 py-1 rounded-md font-mono text-[11px] uppercase tracking-wider transition-colors cursor-pointer ${
                      cameraPreset === 'closeup'
                        ? 'bg-[#C9A45C]/15 text-[#C9A45C] border border-[#C9A45C]/60'
                        : 'text-[#9096A2] hover:text-[#ECEDEF] border border-transparent'
                    }`}
                  >
                    {MUSEUM_COPY.cameraCloseup}
                  </button>
                </div>
              )}

              {/* Reset View Button */}
              <button
                type="button"
                onClick={onResetView}
                className="pointer-events-auto min-h-[44px] sm:min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(20,22,28,0.78)] backdrop-blur-xl border border-[#C9A45C] text-[#C9A45C] hover:bg-[#C9A45C]/10 font-display text-[11px] font-medium tracking-widest uppercase transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A45C]"
              >
                <RotateCcw className="w-3.5 h-3.5 stroke-[1.75]" />
                <span>{MUSEUM_COPY.resetView}</span>
              </button>

              {/* Orbit Telemetry Status */}
              <div className="pointer-events-none hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[rgba(20,22,28,0.65)] border border-[rgba(255,255,255,0.08)]">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#6FB3C2]">
                  {MUSEUM_COPY.orbitLabel}
                </span>
                <span className="font-mono text-[11px] text-[#ECEDEF]">
                  {autoRotate ? MUSEUM_COPY.orbitAuto : MUSEUM_COPY.orbitManual}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 2. TOP-RIGHT: Ghost "About" Button + Slide-In About Panel (+ ?calibrate=1 Panel) */}
        <div className="relative flex flex-col items-end gap-2.5">
          <button
            type="button"
            onClick={onToggleAbout}
            aria-expanded={aboutOpen}
            aria-controls="museum-about-panel"
            className="pointer-events-auto min-h-[44px] sm:min-h-[36px] px-3.5 py-1.5 rounded-lg bg-transparent border border-[#C9A45C] text-[#C9A45C] hover:bg-[#C9A45C]/10 font-mono text-[11px] uppercase tracking-widest transition-colors cursor-pointer animate-wordmark-fade-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A45C]"
          >
            {MUSEUM_COPY.aboutButton}
          </button>

          {/* Optional ?calibrate=1 Sliders in World View */}
          {isCalibrateMode && isWorldView && activeBody && !aboutOpen && (
            <WorldCalibrationPanel
              bodyName={activeBody.name}
              lonOffset={lonOffset}
              latOffset={latOffset}
              onChangeLonOffset={onChangeLonOffset}
              onChangeLatOffset={onChangeLatOffset}
            />
          )}

          {/* Slide-in Glass About Panel */}
          <aside
            id="museum-about-panel"
            aria-label="About the Exhibition"
            aria-hidden={!aboutOpen}
            className={`w-[calc(100vw-48px)] max-w-[360px] rounded-xl bg-[rgba(20,22,28,0.85)] backdrop-blur-xl border border-[rgba(255,255,255,0.08)] p-5 ${aboutTransitionClasses}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-transparent border border-[#C9A45C] text-[#C9A45C]">
                <span className="font-mono text-[10px] font-medium tracking-widest uppercase">
                  {MUSEUM_COPY.badge}
                </span>
              </div>

              <button
                type="button"
                onClick={onCloseAbout}
                aria-label={MUSEUM_COPY.aboutCloseAria}
                className="shrink-0 min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-lg bg-transparent border border-[#C9A45C]/50 text-[#C9A45C] hover:bg-[#C9A45C]/10 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A45C]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <h2 className="mt-3 font-sans text-sm font-medium text-[#ECEDEF] leading-snug">
              {MUSEUM_COPY.subtitle}
            </h2>

            <div className="my-3 h-px w-full bg-[#C9A45C]/30" />

            <p className="font-sans text-xs text-[#9096A2] leading-relaxed">
              {MUSEUM_COPY.aboutParagraph}
            </p>
          </aside>
        </div>
      </div>

      {/* BOTTOM AREA */}
      {view === 'hub' ? (
        /* 3. Persistent Exhibition Caption in Hub View */
        <div className="pointer-events-none select-none flex flex-col items-center justify-center text-center animate-hud-fade-in">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[#9096A2]">
            {MUSEUM_COPY.captionTitle}
          </p>
          <p className="mt-1 font-sans text-[13px] text-[#ECEDEF]">
            {MUSEUM_COPY.captionSubtitle}
          </p>
        </div>
      ) : (
        /* World View or Machine View: Bottom-Left Placard + Bottom-Center ChapterBar */
        activeBody &&
        !hudCollapsed && (
          <div className="relative flex flex-col lg:flex-row items-center lg:items-end justify-between gap-3 w-full">
            {/* Bottom-Left Placard */}
            <div className="w-full sm:w-auto flex justify-center lg:justify-start z-10">
              {isMachineView && activeHardware ? (
                <Placard
                  key={activeHardware.id}
                  hardware={activeHardware}
                  hudCollapsed={hudCollapsed}
                  isMobileOrPortrait={isMobileOrPortrait}
                  prefersReducedMotion={prefersReducedMotion}
                />
              ) : (
                <WorldViewPlacard
                  body={activeBody}
                  hudCollapsed={hudCollapsed}
                  isMobileOrPortrait={isMobileOrPortrait}
                  onSelectHardware={onSelectHardware}
                />
              )}
            </div>

            {/* Bottom-Center ChapterBar */}
            <div className="lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:bottom-0 flex justify-center z-10">
              <ChapterBar
                body={activeBody}
                activeHardwareId={activeHardwareId}
                isTransitioning={isTransitioning}
                onSelectHardware={onSelectHardware}
                onStepChapter={onStepChapter}
              />
            </div>

            {/* Right spacer for balanced layout on large viewports */}
            <div className="hidden lg:block w-[140px] pointer-events-none" />
          </div>
        )
      )}
    </div>
  );
}
