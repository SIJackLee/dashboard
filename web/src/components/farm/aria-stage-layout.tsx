"use client";

import type { ReactNode } from "react";
import type { AriaOrbMode } from "@/lib/aria/aria-mode";
import { dashboardAriaShell } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

/** 스테이지 포커스 — speak/결과면이면 지표 전면, 그 외 오브 중심 */
export type AriaStageFocus = "orb" | "metrics";

export function ariaStageFocusFromOrbMode(mode: AriaOrbMode): AriaStageFocus {
  return mode === "speak" ? "metrics" : "orb";
}

type Props = {
  focus: AriaStageFocus;
  /** idle이면 지표 슬롯 접힘(애니메이션) */
  metricsVisible?: boolean;
  orb: ReactNode;
  metrics: ReactNode;
  hint?: ReactNode;
  className?: string;
};

/**
 * ARIA 스테이지 — 오브 ↔ 지표 포커스 전환.
 * speak: 오브 하단 도크 우측 축소·이동 + 결과면 중앙 scale-up (P1).
 */
export function AriaStageLayout({
  focus,
  metricsVisible = true,
  orb,
  metrics,
  hint,
  className,
}: Props) {
  const metricsFocus = focus === "metrics";
  const showMetrics = metricsVisible || metricsFocus;

  return (
    <div
      className={cn(dashboardAriaShell.stageBody, className)}
      data-aria-stage-focus={focus}
      data-aria-metrics={showMetrics ? "1" : "0"}
      data-aria-dock={metricsFocus ? "dock" : "center"}
      data-aria-reveal={metricsFocus ? "scale-up" : "none"}
      data-aria-answer-mode={metricsFocus ? "metrics" : "orb"}
      data-testid="aria-stage-layout"
    >
      <div
        className={cn(
          dashboardAriaShell.metricsSlot,
          !showMetrics && dashboardAriaShell.metricsSlotHidden,
          showMetrics &&
            (metricsFocus
              ? dashboardAriaShell.metricsSlotHero
              : dashboardAriaShell.metricsSlotRail),
        )}
        data-aria-slot="metrics"
        aria-hidden={!showMetrics}
      >
        {metrics}
      </div>

      <div
        className={cn(
          dashboardAriaShell.orbSlot,
          metricsFocus
            ? dashboardAriaShell.orbSlotCorner
            : dashboardAriaShell.orbSlotCenter,
        )}
        data-aria-slot="orb"
      >
        <div
          className={cn(
            dashboardAriaShell.orbStack,
            metricsFocus && "max-w-none gap-1 px-0",
          )}
        >
          {orb}
          {!metricsFocus && hint ? hint : null}
        </div>
      </div>
    </div>
  );
}
