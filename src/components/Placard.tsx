import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Hardware, MUSEUM_COPY } from '../data/missionsData';

export interface PlacardProps {
  hardware: Hardware;
  hudCollapsed: boolean;
  isMobileOrPortrait: boolean;
  prefersReducedMotion: boolean;
}

export function Placard({
  hardware,
  hudCollapsed,
  isMobileOrPortrait,
  prefersReducedMotion,
}: PlacardProps) {
  const [collapsed, setCollapsed] = useState<boolean>(isMobileOrPortrait);
  const { placard, sites } = hardware;

  // Reset mobile collapse state when switching machines
  useEffect(() => {
    setCollapsed(isMobileOrPortrait);
  }, [hardware.id, isMobileOrPortrait]);

  // Split story into sentences for sentence-by-sentence fade-in
  const sentences = useMemo(() => {
    const matches = placard.story.match(/[^.!?]+[.!?]+(\s|$)/g);
    return matches ? matches.map((s) => s.trim()) : [placard.story];
  }, [placard.story]);

  // Line-by-line character typing effect (~40ms per character) for telemetry values
  const totalChars = useMemo(
    () => placard.telemetry.reduce((acc, item) => acc + item.value.length, 0),
    [placard.telemetry]
  );

  const [typedCharCount, setTypedCharCount] = useState<number>(() =>
    prefersReducedMotion ? totalChars : 0
  );
  const [revealedSentences, setRevealedSentences] = useState<number>(() =>
    prefersReducedMotion ? sentences.length : 0
  );

  useEffect(() => {
    if (prefersReducedMotion) {
      setTypedCharCount(totalChars);
      setRevealedSentences(sentences.length);
      return;
    }

    setTypedCharCount(0);
    setRevealedSentences(0);

    const charInterval = window.setInterval(() => {
      setTypedCharCount((prev) => {
        if (prev >= totalChars) {
          window.clearInterval(charInterval);
          return totalChars;
        }
        return prev + 1;
      });
    }, 40);

    const sentenceTimers = sentences.map((_, idx) =>
      window.setTimeout(() => {
        setRevealedSentences((prev) => Math.max(prev, idx + 1));
      }, 280 + idx * 420)
    );

    return () => {
      window.clearInterval(charInterval);
      sentenceTimers.forEach((t) => window.clearTimeout(t));
    };
  }, [hardware.id, prefersReducedMotion, totalChars, sentences]);

  // Compute substring per telemetry line based on cumulative typedCharCount
  const typedTelemetryValues = useMemo(() => {
    let remaining = typedCharCount;
    return placard.telemetry.map((item) => {
      if (prefersReducedMotion) return item.value;
      const len = item.value.length;
      if (remaining <= 0) return '';
      if (remaining >= len) {
        remaining -= len;
        return item.value;
      }
      const slice = item.value.slice(0, remaining);
      remaining = 0;
      return slice;
    });
  }, [placard.telemetry, typedCharCount, prefersReducedMotion]);

  return (
    <section
      aria-label={`${hardware.name} Curatorial Placard`}
      className={`pointer-events-auto w-full sm:w-[340px] max-w-[340px] rounded-xl bg-[rgba(20,22,28,0.78)] backdrop-blur-xl border border-[rgba(255,255,255,0.08)] p-4 sm:p-5 animate-hud-fade-in transition-opacity duration-300 ${
        hudCollapsed ? 'opacity-0 pointer-events-none hidden sm:block' : 'opacity-100'
      }`}
    >
      {/* Header Row: One-line collapsible header on mobile, full title when expanded */}
      <div
        onClick={() => {
          if (isMobileOrPortrait) setCollapsed((prev) => !prev);
        }}
        className={`flex items-start justify-between gap-2.5 ${
          isMobileOrPortrait ? 'cursor-pointer' : ''
        }`}
      >
        <div className="min-w-0 flex-1">
          <h2
            className={`font-display text-sm sm:text-base font-semibold text-[#ECEDEF] tracking-tight leading-snug ${
              collapsed ? 'truncate' : ''
            }`}
          >
            {placard.title}
          </h2>

          {/* Two small site chips under the placard title when the model has two sites (Spirit & Opportunity) */}
          {!collapsed && sites.length > 1 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {sites.map((s) => (
                <span
                  key={s.label}
                  className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#0B0C10]/60 border border-[#C9A45C]/40 font-mono text-[10px] text-[#C9A45C] tracking-wider"
                >
                  {s.label}
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setCollapsed((prev) => !prev);
          }}
          aria-expanded={!collapsed}
          aria-label={collapsed ? MUSEUM_COPY.expandPlacard : MUSEUM_COPY.collapsePlacard}
          className="shrink-0 min-w-[44px] min-h-[44px] -my-1 -mr-1 inline-flex items-center justify-center gap-1 px-2.5 rounded-lg bg-transparent border border-transparent hover:border-[#C9A45C]/50 hover:bg-[#C9A45C]/10 text-[#C9A45C] font-mono text-[10px] uppercase tracking-wider transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A45C]"
        >
          <span className="sm:hidden">
            {collapsed ? MUSEUM_COPY.expandPlacard : MUSEUM_COPY.collapsePlacard}
          </span>
          {collapsed ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Expanded Placard Body */}
      {!collapsed && (
        <div>
          {/* Thin Brass Divider Line */}
          <div className="my-3 h-px w-full bg-[#C9A45C]/35" />

          {/* Telemetry Rows (Teal labels, JetBrains Mono values typed line by line) */}
          <dl className="space-y-1.5">
            {placard.telemetry.map((item, idx) => (
              <div
                key={item.label}
                className="flex items-baseline justify-between gap-3 text-xs"
              >
                <dt className="font-mono text-[10px] uppercase tracking-widest text-[#6FB3C2] shrink-0">
                  {item.label}
                </dt>
                <dd className="font-mono text-[11px] text-[#ECEDEF] text-right">
                  <span>{typedTelemetryValues[idx]}</span>
                </dd>
              </div>
            ))}
          </dl>

          {/* Thin Brass Divider Line */}
          <div className="my-3 h-px w-full bg-[#C9A45C]/25" />

          {/* Story in Inter Muted Text fading in sentence by sentence */}
          <p className="font-sans text-xs text-[#9096A2] leading-relaxed">
            {sentences.map((sentence, idx) => {
              const isVisible = prefersReducedMotion || idx < revealedSentences;
              return (
                <span
                  key={idx}
                  className={`inline transition-opacity duration-500 ${
                    isVisible ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  {sentence}{' '}
                </span>
              );
            })}
          </p>
        </div>
      )}
    </section>
  );
}
