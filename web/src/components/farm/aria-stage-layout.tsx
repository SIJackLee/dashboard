"use client";

import type { ReactNode } from "react";
import type { AriaOrbMode } from "@/lib/aria/aria-mode";
import { dashboardAriaShell } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

/** 스테이지 포커스 — speak 때 지표 전면, 그 외 오브 중심 */
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
 * 모션: `.aria-stage-*` (globals.css). 디자인 Agent 조정 지점.
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
            ? dashboardAriaShell.orbSlotSide
            : dashboardAriaShell.orbSlotCenter,
        )}
        data-aria-slot="orb"
      >
        {orb}
        {!metricsFocus && hint ? hint : null}
      </div>
    </div>
  );
}
