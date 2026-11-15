/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { BODY_BY_ID, BodyId } from './data/missionsData';
import { useMuseumTransition } from './hooks/useMuseumTransition';
import { LoadingGate } from './components/LoadingGate';
import { SpaceStage } from './components/SpaceStage';
import { HudOverlay } from './components/HudOverlay';
import { MachineCameraPreset } from './components/MachineView';

export default function App() {
  const {
    view,
    activeBodyId,
    activeHardwareId,
    hoveredBodyId,
    setHoveredBodyId,
    bodyOpacities,
    machineOpacity,
    pendingPinFocus,
    transitionPhase,
    isTransitioning,
    transitionErrorBodyId,
    clearTransitionError,
    prefersReducedMotion,
    isTouchDevice,
    isMobileOrPortrait,
    isCalibrateMode,
    isEditMode,
    selectWorld,
    selectMachine,
    goBackOneLevel,
    stepChapter,
  } = useMuseumTransition();

  const [isReady, setIsReady] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [resetTrigger, setResetTrigger] = useState<number>(0);
  const [hudCollapsed, setHudCollapsed] = useState<boolean>(false);
  const [aboutOpen, setAboutOpen] = useState<boolean>(false);
  const [cameraPreset, setCameraPreset] = useState<MachineCameraPreset>('overview');

  // Per-body pin calibration offsets (initialized from missionsData.ts)
  const [lonOffsets, setLonOffsets] = useState<Record<BodyId, number>>({
    moon: BODY_BY_ID.moon.lonOffset,
    mars: BODY_BY_ID.mars.lonOffset,
  });
  const [latOffsets, setLatOffsets] = useState<Record<BodyId, number>>({
    moon: BODY_BY_ID.moon.latOffset,
    mars: BODY_BY_ID.mars.latOffset,
  });

  const currentBodyId: BodyId = activeBodyId ?? 'moon';

  const handleReady = useCallback(() => {
    setIsReady(true);
  }, []);

  const handleSelectWorld = useCallback(
    (id: BodyId) => {
      setAboutOpen(false);
      setAutoRotate(true);
      setCameraPreset('overview');
      selectWorld(id);
    },
    [selectWorld]
  );

  const handleSelectSite = useCallback(
    (hardwareId: string, lat: number, lon: number) => {
      if (!activeBodyId) return;
      setAboutOpen(false);
      setAutoRotate(true);
      setCameraPreset('overview');
      selectMachine(activeBodyId, hardwareId, { lat, lon });
    },
    [activeBodyId, selectMachine]
  );

  const handleSelectHardware = useCallback(
    (hardwareId: string) => {
      if (!activeBodyId) return;
      setAboutOpen(false);
      setAutoRotate(true);
      setCameraPreset('overview');
      selectMachine(activeBodyId, hardwareId);
    },
    [activeBodyId, selectMachine]
  );

  const handleStepChapter = useCallback(
    (direction: 'prev' | 'next') => {
      setAboutOpen(false);
      setAutoRotate(true);
      setCameraPreset('overview');
      stepChapter(direction);
    },
    [stepChapter]
  );

  const handleRetryTransition = useCallback(
    (id: BodyId) => {
      clearTransitionError();
      setAutoRotate(true);
      selectWorld(id);
    },
    [clearTransitionError, selectWorld]
  );

  const handleStopAutoRotate = useCallback(() => {
    setAutoRotate(false);
  }, []);

  // Reset View returns to Overview in machine view and re-fits bounds
  const handleResetView = useCallback(() => {
    setCameraPreset('overview');
    setResetTrigger((prev) => prev + 1);
  }, []);

  const handleSelectCameraPreset = useCallback((preset: MachineCameraPreset) => {
    setCameraPreset(preset);
  }, []);

  const handleToggleAbout = useCallback(() => {
    setAboutOpen((prev) => !prev);
  }, []);

  const handleCloseAbout = useCallback(() => {
    setAboutOpen(false);
  }, []);

  const handleChangeLonOffset = useCallback(
    (val: number) => {
      setLonOffsets((prev) => ({ ...prev, [currentBodyId]: val }));
    },
    [currentBodyId]
  );

  const handleChangeLatOffset = useCallback(
    (val: number) => {
      setLatOffsets((prev) => ({ ...prev, [currentBodyId]: val }));
    },
    [currentBodyId]
  );

  // Keyboard shortcuts:
  // - Escape closes About panel first, or goes up one level (machine -> world -> hub)
  // - ArrowLeft / ArrowRight move between chapters in world/machine views
  // - Keys 1..3 jump directly to a machine in world/machine views
  // - H toggles HUD; R resets camera framing
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Escape') {
        if (aboutOpen) {
          e.preventDefault();
          setAboutOpen(false);
          return;
        }
        if (view !== 'hub' || activeBodyId !== null) {
          e.preventDefault();
          goBackOneLevel();
        }
        return;
      }

      // - Keys 1..N jump directly to a machine in world/machine views (computed from hardware.length)
      // - H toggles HUD; R resets camera framing
      if (view === 'world' || view === 'machine') {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handleStepChapter('prev');
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          handleStepChapter('next');
          return;
        }
        if (activeBodyId && /^[1-9]$/.test(e.key)) {
          const hardwareList = BODY_BY_ID[activeBodyId].hardware;
          const idx = Number(e.key) - 1;
          if (idx >= 0 && idx < hardwareList.length) {
            e.preventDefault();
            handleSelectHardware(hardwareList[idx].id);
          }
          return;
        }
      }

      if (e.key === 'h' || e.key === 'H') {
        setHudCollapsed((prev) => !prev);
      } else if ((e.key === 'r' || e.key === 'R') && (view === 'world' || view === 'machine')) {
        handleResetView();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    aboutOpen,
    view,
    activeBodyId,
    goBackOneLevel,
    handleStepChapter,
    handleSelectHardware,
    handleResetView,
  ]);

  return (
    <main className="relative w-screen h-screen bg-[#0B0C10] text-[#ECEDEF] overflow-hidden">
      {/* Centered Minimal Loading Gate before the Hub reveals */}
      <LoadingGate isReady={isReady} onReady={handleReady} />

      {/* Single Full-Screen 3D Space Stage (100vw x 100vh) */}
      <SpaceStage
        isReady={isReady}
        view={view}
        activeBodyId={activeBodyId}
        activeHardwareId={activeHardwareId}
        hoveredBodyId={hoveredBodyId}
        bodyOpacities={bodyOpacities}
        machineOpacity={machineOpacity}
        pendingPinFocus={pendingPinFocus}
        transitionPhase={transitionPhase}
        isTransitioning={isTransitioning}
        transitionErrorBodyId={transitionErrorBodyId}
        onRetryTransition={handleRetryTransition}
        latOffset={latOffsets[currentBodyId]}
        lonOffset={lonOffsets[currentBodyId]}
        cameraPreset={cameraPreset}
        isMobileOrPortrait={isMobileOrPortrait}
        isTouchDevice={isTouchDevice}
        isEditMode={isEditMode}
        prefersReducedMotion={prefersReducedMotion}
        autoRotate={autoRotate}
        onStopAutoRotate={handleStopAutoRotate}
        resetTrigger={resetTrigger}
        onHoverChange={setHoveredBodyId}
        onSelectWorld={handleSelectWorld}
        onSelectSite={handleSelectSite}
      />

      {/* Floating Header Wordmark, About Drawer, Placard, and ChapterBar */}
      <HudOverlay
        isReady={isReady}
        view={view}
        activeBodyId={activeBodyId}
        activeHardwareId={activeHardwareId}
        isTransitioning={isTransitioning}
        isMobileOrPortrait={isMobileOrPortrait}
        isCalibrateMode={isCalibrateMode}
        prefersReducedMotion={prefersReducedMotion}
        autoRotate={autoRotate}
        hudCollapsed={hudCollapsed}
        aboutOpen={aboutOpen}
        cameraPreset={cameraPreset}
        latOffset={latOffsets[currentBodyId]}
        lonOffset={lonOffsets[currentBodyId]}
        onChangeLatOffset={handleChangeLatOffset}
        onChangeLonOffset={handleChangeLonOffset}
        onSelectCameraPreset={handleSelectCameraPreset}
        onToggleAbout={handleToggleAbout}
        onCloseAbout={handleCloseAbout}
        onResetView={handleResetView}
        onGoBack={goBackOneLevel}
        onSelectHardware={handleSelectHardware}
        onStepChapter={handleStepChapter}
      />
    </main>
  );
}
