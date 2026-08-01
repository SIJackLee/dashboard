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

const RING_BARS = 28;

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

/** speak/think 보조 바 — listen은 외곽 링 RMS가 주인공 */
function barHeight(
  mode: AriaOrbMode,
  index: number,
  level: number,
): number {
  const phase = index / RING_BARS;
  if (mode === "idle" || mode === "error" || mode === "listen") return 0;
  if (mode === "think") return 4 + (index % 4) * 1.1;
  const amp = 0.35 + level * 0.55;
  const peak = Math.abs(Math.sin(phase * Math.PI * 7 + index * 0.31));
  return (7 + peak * peak * 28) * amp;
}

/**
 * DELIN 오브 — idle 위상 호흡 · listen 외곽 링←RMS.
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
  const showWave = mode === "speak" || mode === "think";
  const accentClass =
    mode === "error"
      ? "text-destructive"
      : mode === "think"
        ? "text-channel-info"
        : "text-primary";

  const bars = useMemo(() => {
    if (!showWave) return [] as number[];
    return Array.from({ length: RING_BARS }, (_, i) =>
      barHeight(mode, i, mode === "think" ? 0.5 : lv),
    );
  }, [mode, lv, showWave]);

  /** listen: 전체 scale 대신 외곽 링만 키움 — 중심 안정 */
  const ringMidR = mode === "listen" ? 70 + lv * 5 : 68;
  const ringOuterR = mode === "listen" ? 84 + lv * 10 : 82;
  const ringFarR = mode === "listen" ? 98 + lv * 16 : 96;
  const ringMidOp = mode === "listen" ? 0.32 + lv * 0.4 : 0.4;
  const ringOuterOp = mode === "listen" ? 0.16 + lv * 0.5 : 0.22;
  const ringFarOp = mode === "listen" ? 0.08 + lv * 0.55 : 0.12;
  const ringFarWidth = mode === "listen" ? 0.75 + lv * 1.1 : 0.75;

  const heroScale =
    mode === "speak" ? 1 + lv * 0.06 : mode === "listen" ? 1 + lv * 0.02 : 1;

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
        style={{ transform: `scale(${heroScale})` }}
      >
        <svg
          viewBox="0 0 200 200"
          className="size-full overflow-visible"
          role="presentation"
        >
          {mode === "idle" ? (
            <>
              <g
                className={cn(motionClass.ariaOrbRings, motionClass.ariaOrbBreathe)}
                style={{ transformOrigin: `${cx}px ${cy}px` }}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={68}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.25}
                  opacity={0.42}
                />
              </g>
              <g
                className={cn(
                  motionClass.ariaOrbRings,
                  motionClass.ariaOrbBreatheAlt,
                )}
                style={{ transformOrigin: `${cx}px ${cy}px` }}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={82}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1}
                  opacity={0.24}
                />
              </g>
              <g
                className={cn(
                  motionClass.ariaOrbRings,
                  motionClass.ariaOrbBreatheLag,
                )}
                style={{ transformOrigin: `${cx}px ${cy}px` }}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={96}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={0.75}
                  opacity={0.14}
                />
              </g>
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
                  opacity={0.26}
                />
              </g>
            </>
          ) : null}

          {mode === "listen" ? (
            <g
              className={motionClass.ariaOrbListenAmbient}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            >
              <circle
                cx={cx}
                cy={cy}
                r={ringMidR}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.35}
                opacity={ringMidOp}
                style={{
                  transition:
                    "r 80ms linear, opacity 80ms linear, stroke-width 80ms linear",
                }}
              />
              <circle
                cx={cx}
                cy={cy}
                r={ringOuterR}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.1}
                opacity={ringOuterOp}
                style={{
                  transition:
                    "r 80ms linear, opacity 80ms linear, stroke-width 80ms linear",
                }}
              />
              <circle
                cx={cx}
                cy={cy}
                r={ringFarR}
                fill="none"
                stroke="currentColor"
                strokeWidth={ringFarWidth}
                opacity={ringFarOp}
                style={{
                  transition:
                    "r 80ms linear, opacity 80ms linear, stroke-width 80ms linear",
                }}
              />
            </g>
          ) : null}

          {mode === "speak" || mode === "think" || mode === "error" ? (
            <g
              className={cn(
                motionClass.ariaOrbRings,
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
          ) : null}

          {mode === "think" ? (
            <g className="aria-orb-think-morph">
              <g className="aria-orb-analyze-ring">
                <circle
                  cx={cx}
                  cy={cy}
                  r={74}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeDasharray="12 52"
                  opacity={0.55}
                />
              </g>
              <g className="aria-orb-analyze-ring-rev">
                <circle
                  cx={cx}
                  cy={cy}
                  r={88}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1}
                  strokeDasharray="8 28"
                  opacity={0.28}
                />
              </g>
              <g
                className={motionClass.ariaOrbSpin}
                style={{ transformOrigin: `${cx}px ${cy}px` }}
              >
                {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
                  const rad = (deg * Math.PI) / 180;
                  return (
                    <circle
                      key={deg}
                      cx={cx + Math.cos(rad) * 64}
                      cy={cy + Math.sin(rad) * 64}
                      r={deg % 90 === 0 ? 3.1 : 2.2}
                      fill="currentColor"
                      opacity={deg % 90 === 0 ? 0.95 : 0.55}
                    />
                  );
                })}
              </g>
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
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    opacity={0.4 + (h / 40) * 0.45}
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
