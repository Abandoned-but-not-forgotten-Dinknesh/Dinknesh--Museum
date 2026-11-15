import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Body, MUSEUM_COPY } from '../data/missionsData';

export interface ChapterBarProps {
  body: Body;
  activeHardwareId: string | null;
  isTransitioning: boolean;
  onSelectHardware: (hardwareId: string) => void;
  onStepChapter: (direction: 'prev' | 'next') => void;
}

export function ChapterBar({
  body,
  activeHardwareId,
  isTransitioning,
  onSelectHardware,
  onStepChapter,
}: ChapterBarProps) {
  const [hoveredHardwareId, setHoveredHardwareId] = useState<string | null>(null);

  const hardwareList = body.hardware;
  const activeIndex = hardwareList.findIndex((h) => h.id === activeHardwareId);
  const total = hardwareList.length;

  const chapterLabel = MUSEUM_COPY.getChapterLabel(activeIndex, total);

  return (
    <nav
      aria-label="Chronological Hardware Chapters"
      className="pointer-events-auto flex flex-col items-center gap-1.5 max-w-[calc(100vw-32px)] animate-hud-fade-in select-none"
    >
      {/* Chapter Label ("CHAPTER 1 OF N" in JetBrains Mono, tracking-widest) */}
      <div className="font-mono text-[10px] uppercase tracking-widest text-[#9096A2]">
        {chapterLabel}
      </div>

      {/* Bottom-center glass bar */}
      <div className="flex items-center gap-1 sm:gap-2 px-2 py-1.5 rounded-xl bg-[rgba(20,22,28,0.78)] backdrop-blur-xl border border-[rgba(255,255,255,0.08)]">
        {/* Previous Button (>= 44px touch target) */}
        <button
          type="button"
          disabled={isTransitioning}
          onClick={() => onStepChapter('prev')}
          aria-label="Previous chapter"
          className="min-w-[44px] min-h-[44px] px-2.5 rounded-lg bg-transparent border border-transparent hover:border-[#C9A45C]/50 hover:bg-[#C9A45C]/10 text-[#C9A45C] font-mono text-[11px] uppercase tracking-wider inline-flex items-center justify-center gap-1 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A45C]"
        >
          <ChevronLeft className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">{MUSEUM_COPY.previousChapter}</span>
        </button>

        {/* Thin Vertical Brass Divider */}
        <div className="h-5 w-px bg-[#C9A45C]/25" />

        {/* Chronological Machine Markers with Sliding Brass Underline */}
        <div className="relative flex items-center">
          {hardwareList.map((hw, idx) => {
            const isActive = hw.id === activeHardwareId;
            const isHovered = hw.id === hoveredHardwareId;

            return (
              <div key={hw.id} className="relative flex flex-col items-center">
                {/* Hover Tooltip with Machine Name */}
                <div
                  role="tooltip"
                  aria-hidden={!isHovered}
                  className={`pointer-events-none absolute bottom-full mb-2.5 px-2.5 py-1 rounded-lg bg-[rgba(20,22,28,0.92)] backdrop-blur-xl border border-[rgba(255,255,255,0.08)] whitespace-nowrap font-sans text-xs text-[#ECEDEF] transition-all duration-200 ${
                    isHovered
                      ? 'opacity-100 translate-y-0'
                      : 'opacity-0 translate-y-1'
                  }`}
                >
                  <span className="font-mono text-[10px] text-[#6FB3C2] mr-1.5">
                    0{idx + 1}
                  </span>
                  <span>{hw.name}</span>
                </div>

                <button
                  type="button"
                  disabled={isTransitioning}
                  onClick={() => onSelectHardware(hw.id)}
                  onMouseEnter={() => setHoveredHardwareId(hw.id)}
                  onMouseLeave={() => setHoveredHardwareId(null)}
                  onFocus={() => setHoveredHardwareId(hw.id)}
                  onBlur={() => setHoveredHardwareId(null)}
                  aria-label={`Chapter ${idx + 1}: ${hw.name} (${hw.year})`}
                  aria-current={isActive ? 'step' : undefined}
                  className={`relative min-w-[54px] sm:min-w-[68px] min-h-[44px] px-2.5 sm:px-3.5 rounded-lg flex flex-col items-center justify-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A45C] ${
                    isActive ? 'bg-[#C9A45C]/10' : 'hover:bg-white/5'
                  }`}
                >
                  <span
                    className={`font-mono text-xs tabular-nums tracking-wider transition-colors ${
                      isActive ? 'text-[#ECEDEF] font-medium' : 'text-[#6FB3C2]'
                    }`}
                  >
                    {hw.year}
                  </span>
                </button>
              </div>
            );
          })}

          {/* Sliding Brass Underline for the Active Marker */}
          {activeIndex >= 0 && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0.5 left-0 h-[2px] bg-[#C9A45C] rounded-full transition-transform duration-300 ease-out"
              style={{
                width: `${100 / total}%`,
                transform: `translateX(${activeIndex * 100}%)`,
              }}
            />
          )}
        </div>

        {/* Thin Vertical Brass Divider */}
        <div className="h-5 w-px bg-[#C9A45C]/25" />

        {/* Next Button (>= 44px touch target) */}
        <button
          type="button"
          disabled={isTransitioning}
          onClick={() => onStepChapter('next')}
          aria-label="Next chapter"
          className="min-w-[44px] min-h-[44px] px-2.5 rounded-lg bg-transparent border border-transparent hover:border-[#C9A45C]/50 hover:bg-[#C9A45C]/10 text-[#C9A45C] font-mono text-[11px] uppercase tracking-wider inline-flex items-center justify-center gap-1 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A45C]"
        >
          <span className="hidden sm:inline">{MUSEUM_COPY.nextChapter}</span>
          <ChevronRight className="w-4 h-4 shrink-0" />
        </button>
      </div>
    </nav>
  );
}
