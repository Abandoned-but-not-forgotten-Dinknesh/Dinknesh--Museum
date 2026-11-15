import React, { Component, ReactNode, useEffect, useState } from 'react';
import { Html, useGLTF, useProgress } from '@react-three/drei';
import { BODIES, MUSEUM_COPY } from '../data/missionsData';

// Preload both Moon and Mars world models immediately
BODIES.forEach((body) => {
  useGLTF.preload(body.url);
});

export interface LoadingGateProps {
  isReady: boolean;
  onReady: () => void;
}

/**
 * Full-screen minimal loading gate displayed before the hub reveals.
 * Once the hub reveals (isReady === true), preloads all hardware machine models in the background.
 */
export function LoadingGate({ isReady, onReady }: LoadingGateProps) {
  const { active, progress, loaded, total, errors } = useProgress();
  const [displayProgress, setDisplayProgress] = useState<number>(0);

  useEffect(() => {
    setDisplayProgress((prev) => Math.max(prev, Math.min(100, Math.round(progress))));
  }, [progress]);

  useEffect(() => {
    if (isReady) {
      // Preload every hardware machine model after the hub appears
      BODIES.forEach((body) => {
        body.hardware.forEach((hw) => {
          useGLTF.preload(hw.url);
        });
      });
      return;
    }

    const finishedLoading = !active && (progress >= 100 || (total > 0 && loaded >= total));
    const hasError = errors.length > 0 && !active;

    if (finishedLoading || hasError) {
      setDisplayProgress(100);
      const timer = window.setTimeout(() => {
        onReady();
      }, 180);
      return () => window.clearTimeout(timer);
    }

    const fallbackTimer = window.setTimeout(() => {
      if (!active) {
        setDisplayProgress(100);
        onReady();
      }
    }, 1200);

    return () => window.clearTimeout(fallbackTimer);
  }, [active, progress, loaded, total, errors.length, isReady, onReady]);

  if (isReady) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0B0C10] px-6 select-none transition-opacity duration-500"
    >
      <div className="w-full max-w-md flex flex-col items-center gap-4">
        <p className="font-mono text-xs sm:text-sm tracking-widest text-[#ECEDEF] uppercase text-center">
          {MUSEUM_COPY.loadingText}
        </p>

        <div className="w-full h-[1px] bg-white/10 overflow-hidden relative">
          <div
            className="h-full bg-[#C9A45C] transition-all duration-200 ease-out"
            style={{ width: `${displayProgress}%` }}
          />
        </div>

        <div className="w-full flex items-center justify-between font-mono text-[11px] tracking-widest">
          <span className="text-[#6FB3C2] uppercase">TELEMETRY SYNC</span>
          <span className="text-[#ECEDEF] tabular-nums">{displayProgress}%</span>
        </div>
      </div>
    </div>
  );
}

/**
 * In-scene Suspense loading indicator while a hardware machine streams in.
 */
export function ArtifactTelemetrySuspenseFallback() {
  return (
    <Html center>
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none select-none flex flex-col items-center gap-2.5 px-5 py-3.5 rounded-xl bg-[rgba(20,22,28,0.82)] backdrop-blur-xl border border-[rgba(255,255,255,0.08)] min-w-[290px]"
      >
        <div className="w-4 h-4 rounded-full border border-[#6FB3C2]/40 border-t-[#C9A45C] animate-spin" />
        <p className="font-mono text-[11px] tracking-widest text-[#ECEDEF] uppercase text-center whitespace-nowrap">
          {MUSEUM_COPY.loadingText}
        </p>
      </div>
    </Html>
  );
}

interface ArtifactErrorBoundaryTarget {
  id: string;
  name: string;
  url: string;
}

interface WorldErrorBoundaryProps {
  body: ArtifactErrorBoundaryTarget;
  position?: [number, number, number];
  onErrorChange?: (id: string, hasError: boolean) => void;
  children: ReactNode;
}

interface WorldErrorBoundaryState {
  hasError: boolean;
  retryCount: number;
}

/**
 * Isolated Error Boundary for a 3D world or hardware machine model:
 * displays "ARTIFACT SIGNAL LOST: Unable to load {name}" with a Retry button
 * while keeping navigation usable.
 */
export class WorldModelErrorBoundary extends Component<
  WorldErrorBoundaryProps,
  WorldErrorBoundaryState
> {
  public state: WorldErrorBoundaryState = {
    hasError: false,
    retryCount: 0,
  };

  static getDerivedStateFromError(): Partial<WorldErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error(
      `[ArtifactErrorBoundary] Failed loading model "${this.props.body.id}":`,
      error
    );
    this.props.onErrorChange?.(this.props.body.id, true);
  }

  handleRetry = () => {
    useGLTF.clear(this.props.body.url);
    useGLTF.preload(this.props.body.url);
    this.setState(
      (prev) => ({
        hasError: false,
        retryCount: prev.retryCount + 1,
      }),
      () => {
        this.props.onErrorChange?.(this.props.body.id, false);
      }
    );
  };

  render() {
    if (this.state.hasError) {
      return (
        <group position={this.props.position ?? [0, 0, 0]}>
          <Html center>
            <div
              role="alert"
              className="pointer-events-auto flex flex-col items-center text-center gap-3 p-5 rounded-xl bg-[rgba(20,22,28,0.78)] backdrop-blur-xl border border-[rgba(255,255,255,0.08)] w-[280px] sm:w-[320px] animate-hud-fade-in"
            >
              <p className="font-mono text-xs text-[#ECEDEF] tracking-wider leading-relaxed">
                {MUSEUM_COPY.signalLostPrefix} {this.props.body.name}
              </p>
              <div className="w-full h-px bg-[#C9A45C]/30" />
              <button
                type="button"
                onClick={this.handleRetry}
                className="min-h-[44px] min-w-[110px] px-4 py-2 rounded-lg bg-transparent border border-[#C9A45C] hover:bg-[#C9A45C]/10 text-[#C9A45C] font-mono text-xs tracking-widest uppercase transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A45C]"
              >
                {MUSEUM_COPY.retryButton}
              </button>
            </div>
          </Html>
        </group>
      );
    }

    return <React.Fragment key={this.state.retryCount}>{this.props.children}</React.Fragment>;
  }
}
