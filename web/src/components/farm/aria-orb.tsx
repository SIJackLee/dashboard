"use client";

import { useMemo } from "react";
import {
  ARIA_ORB_MODE_LABEL,
  type AriaOrbMode,
} from "@/lib/aria/aria-mode";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

type Props = {
  mode: AriaOrbMode;
  /** 0~1 — 청취/발화 파동 진폭 (마이크 RMS 등) */
  level?: number;
  className?: string;
  announce?: boolean;
};

const RING_BARS = 32;

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function barHeight(
  mode: AriaOrbMode,
  index: number,
  level: number,
): number {
  const phase = index / RING_BARS;
  if (mode === "idle" || mode === "error") return 0;
  if (mode === "think") return 5 + (index % 4) * 1.2;
  const amp = 0.4 + level * 0.6;
  if (mode === "listen") {
    return (10 + Math.abs(Math.sin(phase * Math.PI * 5)) * 26) * amp;
  }
  const peak = Math.abs(Math.sin(phase * Math.PI * 7 + index * 0.31));
  return (8 + peak * peak * 32) * amp;
}

/**
 * ARIA 중심 오브 — 호흡·청취·분석·발화.
 * level로 실시간 파동 진폭 (P2).
 */
export function AriaOrb({
  mode,
  level = 0,
  className,
  announce = true,
}: Props) {
  const cx = 100;
  const cy = 100;
  const lv = clamp01(level);
  const showWave = mode === "listen" || mode === "speak" || mode === "think";
  /* idle/listen/speak=primary · think=channel-info · error=destructive */
  const accentClass =
    mode === "error"
      ? "text-destructive"
      : mode === "think"
        ? "text-channel-info"
        : "text-primary";

  const bars = useMemo(() => {
    if (!showWave) return [] as number[];
    return Array.from({ length: RING_BARS }, (_, i) =>
      barHeight(mode, i, mode === "think" ? 0.55 : lv),
    );
  }, [mode, lv, showWave]);

  const listenBoost =
    mode === "listen" || mode === "speak" ? 1 + lv * 0.12 : 1;

  return (
    <div
      className={cn("relative flex flex-col items-center gap-2", className)}
      data-testid="aria-orb"
      data-aria-mode={mode}
    >
      <div
        className={cn(
          "relative size-[min(62vw,19rem)] md:size-[19rem]",
          accentClass,
          motionClass.ariaOrbHero,
        )}
        aria-hidden
        style={{ transform: `scale(${listenBoost})` }}
      >
        <svg
          viewBox="0 0 200 200"
          className="size-full overflow-visible"
          role="presentation"
        >
          {/* layered breath rings */}
          <g
            className={cn(
              motionClass.ariaOrbRings,
              mode === "idle" && motionClass.ariaOrbBreathe,
              mode === "listen" && motionClass.ariaOrbPulseListen,
              mode === "speak" && motionClass.ariaOrbPulseSpeak,
              mode === "think" && motionClass.ariaOrbSpin,
              mode === "error" && motionClass.ariaOrbStatic,
            )}
            style={{ transformOrigin: `${cx}px ${cy}px` }}
          >
            <circle
              cx={cx}
              cy={cy}
              r={68}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.25}
              opacity={0.4}
            />
            <circle
              cx={cx}
              cy={cy}
              r={82}
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
              opacity={0.22}
            />
            <circle
              cx={cx}
              cy={cy}
              r={96}
              fill="none"
              stroke="currentColor"
              strokeWidth={0.75}
              opacity={0.12}
            />
          </g>

          {mode === "idle" ? (
            <g
              className={motionClass.ariaOrbBreatheAlt}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            >
              <circle
                cx={cx}
                cy={cy}
                r={54}
                fill="none"
                stroke="currentColor"
                strokeWidth={1}
                opacity={0.28}
              />
            </g>
          ) : null}

          {mode === "think" ? (
            <g
              className={motionClass.ariaOrbSpin}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            >
              {[0, 60, 120, 180, 240, 300].map((deg) => {
                const rad = (deg * Math.PI) / 180;
                return (
                  <circle
                    key={deg}
                    cx={cx + Math.cos(rad) * 64}
                    cy={cy + Math.sin(rad) * 64}
                    r={2.75}
                    fill="currentColor"
                    opacity={0.9}
                  />
                );
              })}
            </g>
          ) : null}

          {showWave ? (
            <g>
              {bars.map((h, i) => {
                if (h <= 0.5) return null;
                const angle = (i / RING_BARS) * Math.PI * 2 - Math.PI / 2;
                const inner = 40;
                return (
                  <line
                    key={i}
                    x1={cx + Math.cos(angle) * inner}
                    y1={cy + Math.sin(angle) * inner}
                    x2={cx + Math.cos(angle) * (inner + h)}
                    y2={cy + Math.sin(angle) * (inner + h)}
                    stroke="currentColor"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    opacity={0.45 + (h / 45) * 0.5}
                  />
                );
              })}
            </g>
          ) : null}

          <g
            className={cn(
              mode === "error"
                ? motionClass.ariaOrbStatic
                : mode === "listen"
                  ? motionClass.ariaOrbCoreListen
                  : mode === "speak"
                    ? motionClass.ariaOrbCoreSpeak
                    : motionClass.ariaOrbCore,
            )}
            style={{ transformOrigin: `${cx}px ${cy}px` }}
          >
            <circle
              cx={cx}
              cy={cy}
              r={32}
              className="fill-card"
              stroke="currentColor"
              strokeWidth={2.25}
            />
            <circle
              cx={cx}
              cy={cy}
              r={17}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              opacity={0.7}
            />
            <circle cx={cx} cy={cy} r={5} fill="currentColor" />
          </g>

          {mode === "error" ? (
            <circle
              cx={cx}
              cy={cy}
              r={48}
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
              strokeDasharray="3 5"
              opacity={0.5}
            />
          ) : null}
        </svg>
      </div>

      {announce ? (
        <p
          className="text-xs font-medium tracking-wide text-muted-foreground"
          aria-live="polite"
        >
          {ARIA_ORB_MODE_LABEL[mode]}
        </p>
      ) : null}
    </div>
  );
}
