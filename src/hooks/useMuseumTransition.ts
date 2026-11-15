import { useCallback, useEffect, useRef, useState } from 'react';
import { BODY_BY_ID, BodyId, findHardware } from '../data/missionsData';

export type MuseumView = 'hub' | 'world' | 'machine';
export type TransitionPhase =
  | 'idle'
  | 'to-world'
  | 'to-hub'
  | 'to-machine'
  | 'from-machine-to-world'
  | 'between-machines-out'
  | 'between-machines-in';

export interface PendingPinFocus {
  hardwareId: string;
  lat: number;
  lon: number;
}

interface ParsedHashRoute {
  view: MuseumView;
  bodyId: BodyId | null;
  hardwareId: string | null;
}

function parseHashRoute(): ParsedHashRoute {
  if (typeof window === 'undefined') {
    return { view: 'hub', bodyId: null, hardwareId: null };
  }
  const raw = window.location.hash.replace(/^#/, '').trim().toLowerCase();
  if (!raw || raw === 'hub') {
    return { view: 'hub', bodyId: null, hardwareId: null };
  }
  const parts = raw.split('/').filter(Boolean);
  const first = parts[0];
  if (first !== 'moon' && first !== 'mars') {
    return { view: 'hub', bodyId: null, hardwareId: null };
  }
  const bodyId: BodyId = first;
  const second = parts[1] ?? null;
  if (second) {
    const hw = findHardware(bodyId, second);
    if (hw) {
      return { view: 'machine', bodyId, hardwareId: hw.id };
    }
  }
  return { view: 'world', bodyId, hardwareId: null };
}

export interface MuseumTransitionState {
  view: MuseumView;
  activeBodyId: BodyId | null;
  activeHardwareId: string | null;
  hoveredBodyId: BodyId | null;
  setHoveredBodyId: (id: BodyId | null) => void;
  bodyOpacities: Record<BodyId, number>;
  machineOpacity: number;
  pendingPinFocus: PendingPinFocus | null;
  transitionPhase: TransitionPhase;
  isTransitioning: boolean;
  transitionErrorBodyId: BodyId | null;
  clearTransitionError: () => void;
  prefersReducedMotion: boolean;
  isTouchDevice: boolean;
  isMobileOrPortrait: boolean;
  isCalibrateMode: boolean;
  isEditMode: boolean;
  selectWorld: (id: BodyId) => void;
  selectMachine: (bodyId: BodyId, hardwareId: string, siteCoords?: { lat: number; lon: number }) => void;
  returnToWorld: () => void;
  returnToHall: () => void;
  goBackOneLevel: () => void;
  stepChapter: (direction: 'prev' | 'next') => void;
}

export function useMuseumTransition(): MuseumTransitionState {
  const initial = parseHashRoute();
  const [view, setView] = useState<MuseumView>(initial.view);
  const [activeBodyId, setActiveBodyId] = useState<BodyId | null>(initial.bodyId);
  const [activeHardwareId, setActiveHardwareId] = useState<string | null>(initial.hardwareId);
  const [hoveredBodyId, setHoveredBodyId] = useState<BodyId | null>(null);
  const [transitionPhase, setTransitionPhase] = useState<TransitionPhase>('idle');
  const [transitionErrorBodyId, setTransitionErrorBodyId] = useState<BodyId | null>(null);
  const [pendingPinFocus, setPendingPinFocus] = useState<PendingPinFocus | null>(null);
  const [machineOpacity, setMachineOpacity] = useState<number>(1);

  const [bodyOpacities, setBodyOpacities] = useState<Record<BodyId, number>>({
    moon: 1,
    mars: 1,
  });

  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches
    );
  });

  const [isMobileOrPortrait, setIsMobileOrPortrait] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768 || window.innerHeight > window.innerWidth;
  });

  const [isCalibrateMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('calibrate') === '1';
  });

  const [isEditMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('edit') === '1';
  });

  const timerRef = useRef<number | null>(null);
  const secondaryTimerRef = useRef<number | null>(null);
  const programmaticHashRef = useRef<boolean>(false);

  const clearTimers = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (secondaryTimerRef.current !== null) {
      window.clearTimeout(secondaryTimerRef.current);
      secondaryTimerRef.current = null;
    }
  }, []);

  const clearTransitionError = useCallback(() => {
    setTransitionErrorBodyId(null);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const onResize = () => {
      setIsMobileOrPortrait(window.innerWidth < 768 || window.innerHeight > window.innerWidth);
      setIsTouchDevice(
        'ontouchstart' in window ||
          navigator.maxTouchPoints > 0 ||
          window.matchMedia('(pointer: coarse)').matches
      );
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, '', '#hub');
    } else if (initial.view === 'world' && initial.bodyId) {
      const expectedHash = `#${initial.bodyId}`;
      if (window.location.hash.toLowerCase() !== expectedHash) {
        window.history.replaceState(null, '', expectedHash);
      }
    }
  }, [initial.view, initial.bodyId]);

  const setHashSilently = useCallback((newHash: string) => {
    if (window.location.hash !== newHash) {
      programmaticHashRef.current = true;
      window.location.hash = newHash;
    }
  }, []);

  const triggerToWorld = useCallback(
    (id: BodyId, updateHash: boolean, fromMachine = false) => {
      try {
        clearTimers();
        setTransitionErrorBodyId(null);
        setPendingPinFocus(null);

        if (updateHash) {
          setHashSilently(`#${id}`);
        }

        setHoveredBodyId(null);
        setActiveBodyId(id);

        if (fromMachine) {
          const outMs = prefersReducedMotion ? 120 : 350;
          setTransitionPhase('from-machine-to-world');
          setMachineOpacity(0);
          timerRef.current = window.setTimeout(() => {
            setActiveHardwareId(null);
            setMachineOpacity(1);
            setBodyOpacities({ moon: 1, mars: 1 });
            setView('world');
            setTransitionPhase('idle');
            timerRef.current = null;
          }, outMs);
          return;
        }

        const durationMs = prefersReducedMotion ? 180 : 1200;
        setBodyOpacities({
          moon: id === 'moon' ? 1 : 0,
          mars: id === 'mars' ? 1 : 0,
        });

        setTransitionPhase('to-world');
        timerRef.current = window.setTimeout(() => {
          setBodyOpacities({ moon: 1, mars: 1 });
          setActiveHardwareId(null);
          setMachineOpacity(1);
          setView('world');
          setTransitionPhase('idle');
          timerRef.current = null;
        }, durationMs);
      } catch (error) {
        console.error(`[MuseumTransition] Failed to enter world "${id}":`, error);
        setTransitionPhase('idle');
        setTransitionErrorBodyId(id);
      }
    },
    [clearTimers, prefersReducedMotion, setHashSilently]
  );

  const triggerToHub = useCallback(
    (updateHash: boolean) => {
      try {
        clearTimers();
        setTransitionErrorBodyId(null);
        setPendingPinFocus(null);
        const durationMs = prefersReducedMotion ? 180 : 1200;

        if (updateHash) {
          setHashSilently('#hub');
        }

        setHoveredBodyId(null);
        setActiveHardwareId(null);
        setMachineOpacity(1);
        setBodyOpacities({ moon: 1, mars: 1 });
        setView('hub');
        setTransitionPhase('to-hub');

        timerRef.current = window.setTimeout(() => {
          setActiveBodyId(null);
          setTransitionPhase('idle');
          timerRef.current = null;
        }, durationMs);
      } catch (error) {
        console.error(`[MuseumTransition] Failed returning to hub:`, error);
        setTransitionPhase('idle');
        setView('hub');
      }
    },
    [clearTimers, prefersReducedMotion, setHashSilently]
  );

  const triggerToMachine = useCallback(
    (
      bodyId: BodyId,
      hardwareId: string,
      updateHash: boolean,
      siteCoords?: { lat: number; lon: number }
    ) => {
      try {
        const hw = findHardware(bodyId, hardwareId);
        if (!hw) return;

        clearTimers();
        setTransitionErrorBodyId(null);

        if (updateHash) {
          setHashSilently(`#${bodyId}/${hw.id}`);
        }

        setActiveBodyId(bodyId);

        // Case 1: Switching from one machine to another (350ms fade out -> 500ms fade in)
        if (view === 'machine') {
          const outMs = prefersReducedMotion ? 120 : 350;
          const inMs = prefersReducedMotion ? 150 : 500;
          setTransitionPhase('between-machines-out');
          setMachineOpacity(0);

          timerRef.current = window.setTimeout(() => {
            setActiveHardwareId(hw.id);
            setTransitionPhase('between-machines-in');
            setMachineOpacity(1);

            secondaryTimerRef.current = window.setTimeout(() => {
              setMachineOpacity(1);
              setTransitionPhase('idle');
              secondaryTimerRef.current = null;
            }, inMs);
            timerRef.current = null;
          }, outMs);
          return;
        }

        // Case 2: Entering machine from World view (rotate globe so pin faces camera & ease camera in ~900ms)
        const targetSite = siteCoords ?? hw.sites[0] ?? { lat: 0, lon: 0 };
        const glideMs = prefersReducedMotion ? 180 : 900;

        setPendingPinFocus({
          hardwareId: hw.id,
          lat: targetSite.lat,
          lon: targetSite.lon,
        });
        setTransitionPhase('to-machine');

        timerRef.current = window.setTimeout(() => {
          setPendingPinFocus(null);
          setActiveHardwareId(hw.id);
          setMachineOpacity(1);
          setView('machine');
          setTransitionPhase('idle');
          timerRef.current = null;
        }, glideMs);
      } catch (error) {
        console.error(
          `[MuseumTransition] Failed transitioning to machine "${hardwareId}" on "${bodyId}":`,
          error
        );
        setTransitionPhase('idle');
      }
    },
    [clearTimers, prefersReducedMotion, setHashSilently, view]
  );

  const isTransitioning = transitionPhase !== 'idle';

  const selectWorld = useCallback(
    (id: BodyId) => {
      if (isTransitioning) return;
      if (view === 'world' && activeBodyId === id) return;
      triggerToWorld(id, true, view === 'machine');
    },
    [isTransitioning, view, activeBodyId, triggerToWorld]
  );

  const selectMachine = useCallback(
    (bodyId: BodyId, hardwareId: string, siteCoords?: { lat: number; lon: number }) => {
      if (isTransitioning) return;
      if (view === 'machine' && activeBodyId === bodyId && activeHardwareId === hardwareId) {
        return;
      }
      triggerToMachine(bodyId, hardwareId, true, siteCoords);
    },
    [isTransitioning, view, activeBodyId, activeHardwareId, triggerToMachine]
  );

  const returnToWorld = useCallback(() => {
    if (isTransitioning || !activeBodyId) return;
    if (view === 'world') return;
    triggerToWorld(activeBodyId, true, true);
  }, [isTransitioning, activeBodyId, view, triggerToWorld]);

  const returnToHall = useCallback(() => {
    if (isTransitioning) return;
    if (view === 'hub' && activeBodyId === null) return;
    triggerToHub(true);
  }, [isTransitioning, view, activeBodyId, triggerToHub]);

  const goBackOneLevel = useCallback(() => {
    if (isTransitioning) return;
    if (view === 'machine' && activeBodyId) {
      triggerToWorld(activeBodyId, true, true);
    } else if (view === 'world' || activeBodyId !== null) {
      triggerToHub(true);
    }
  }, [isTransitioning, view, activeBodyId, triggerToWorld, triggerToHub]);

  const stepChapter = useCallback(
    (direction: 'prev' | 'next') => {
      if (isTransitioning || !activeBodyId) return;
      const body = BODY_BY_ID[activeBodyId];
      const list = body.hardware;
      if (list.length === 0) return;

      if (view === 'world') {
        if (direction === 'next') {
          triggerToMachine(activeBodyId, list[0].id, true);
        } else {
          triggerToMachine(activeBodyId, list[list.length - 1].id, true);
        }
        return;
      }

      if (view === 'machine') {
        const currentIndex = list.findIndex((h) => h.id === activeHardwareId);
        if (currentIndex === -1) {
          triggerToMachine(activeBodyId, list[0].id, true);
          return;
        }
        if (direction === 'next') {
          if (currentIndex + 1 < list.length) {
            triggerToMachine(activeBodyId, list[currentIndex + 1].id, true);
          } else {
            // From the last machine, Next returns to the world view
            triggerToWorld(activeBodyId, true, true);
          }
        } else {
          if (currentIndex - 1 >= 0) {
            triggerToMachine(activeBodyId, list[currentIndex - 1].id, true);
          } else {
            triggerToWorld(activeBodyId, true, true);
          }
        }
      }
    },
    [isTransitioning, activeBodyId, activeHardwareId, view, triggerToMachine, triggerToWorld]
  );

  // Sync browser Back / Forward hash changes
  useEffect(() => {
    const onHashChange = () => {
      if (programmaticHashRef.current) {
        programmaticHashRef.current = false;
        return;
      }
      const next = parseHashRoute();
      if (next.view === 'machine' && next.bodyId && next.hardwareId) {
        triggerToMachine(next.bodyId, next.hardwareId, false);
      } else if (next.view === 'world' && next.bodyId) {
        const expectedHash = `#${next.bodyId}`;
        if (window.location.hash.toLowerCase() !== expectedHash) {
          window.history.replaceState(null, '', expectedHash);
        }
        triggerToWorld(next.bodyId, false, view === 'machine');
      } else {
        triggerToHub(false);
      }
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [triggerToMachine, triggerToWorld, triggerToHub, view]);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  return {
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
    returnToWorld,
    returnToHall,
    goBackOneLevel,
    stepChapter,
  };
}
