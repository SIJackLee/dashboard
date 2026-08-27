"use client";

import { useCallback, useEffect, useState } from "react";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { BarnReading } from "@/lib/data/iot";
import {
  formatControllerHeaderStallType,
  formatControllerHeaderStallUnit,
  formatControllerNoLabel,
} from "@/lib/farm/controller-summary-display";
import {
  controllerEnvCoverInkClass,
  controllerEnvCoverLabel,
  controllerEnvCoverReason,
  type ControllerEnvCoverLevel,
} from "@/lib/farm/controller-env-cover";
import {
  ControllerNoMark,
  StallUnitNoMark,
} from "@/components/farm/controller-no-marks";
import {
  dashboardChroma,
  dashboardTypography,
} from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

const COVER_FILL: Record<ControllerEnvCoverLevel, string> = {
  ok: "bg-[var(--status-ok)]",
  warn: "bg-[var(--status-warn)]",
  danger: "bg-[var(--status-danger)]",
  offline: "bg-muted",
};

type Props = {
  reading: BarnReading;
  level: ControllerEnvCoverLevel;
  alarmSettings?: AlarmSettings;
  /** 상세를 닫고 다시 덮일 때만 enterFade. 첫 격자 등장은 카드 stagger. */
  animateEnter?: boolean;
  /** true면 걷힘 FLIP을 위해 즉시 연다 (exitFade 없음). */
  morphReveal?: boolean;
  /** 헤더 차트·설정 칸 수. 명칭·번호를 헤더와 같은 자리에 맞춤. */
  headerActionSlots?: number;
  onOpen: () => void;
};

function prefersCoverReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function coverExitDurationMs(): number {
  if (typeof window === "undefined") return 0;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--motion-duration-exit")
    .trim();
  const ms = Number.parseFloat(raw);
  return Number.isFinite(ms) ? ms : 0;
}

/** 상태색 덮개 — 위 명칭, 가운데 이탈 이유, 아래 판정. T2·E2·M3. */
export function ControllerEnvCover({
  reading,
  level,
  alarmSettings,
  animateEnter = false,
  morphReveal = false,
  headerActionSlots = 0,
  onOpen,
}: Props) {
  const [exiting, setExiting] = useState(false);
  const typeLabel = formatControllerHeaderStallType(reading);
  const stallLabel = formatControllerHeaderStallUnit(reading);
  const ctrlLabel = `컨트롤러 ${formatControllerNoLabel(reading.eqpmnNo)}`;
  const statusLabel = controllerEnvCoverLabel(level);
  const reason = controllerEnvCoverReason(reading, alarmSettings);
  const onFill = level !== "offline";
  const reasonAria = [reason.valueLabel, reason.bandLabel]
    .filter(Boolean)
    .join(" ");

  const finishOpen = useCallback(() => {
    onOpen();
  }, [onOpen]);

  useEffect(() => {
    if (!exiting) return;
    const id = window.setTimeout(finishOpen, coverExitDurationMs());
    return () => window.clearTimeout(id);
  }, [exiting, finishOpen]);

  const requestOpen = useCallback(() => {
    if (exiting) return;
    if (morphReveal || prefersCoverReducedMotion() || coverExitDurationMs() === 0) {
      finishOpen();
      return;
    }
    setExiting(true);
  }, [exiting, finishOpen, morphReveal]);

  return (
    <button
      type="button"
      data-farm-env-cover="on"
      aria-label={`${typeLabel} ${stallLabel} ${ctrlLabel}, ${statusLabel}${reasonAria ? `, ${reasonAria}` : ""}. 상세 보기`}
      onClick={(e) => {
        e.stopPropagation();
        requestOpen();
      }}
      className={cn(
        "absolute inset-0 z-10 flex flex-col justify-between gap-1 p-2.5 text-left sm:p-3",
        COVER_FILL[level],
        dashboardChroma.statusFilmGlassRim,
        controllerEnvCoverInkClass(level),
        exiting && "pointer-events-none",
        exiting ? motionClass.exitFade : animateEnter ? motionClass.enterFade : null,
      )}
    >
      <span className="flex min-w-0 flex-nowrap items-start gap-2">
        <span className="mt-1.5 size-2.5 shrink-0" aria-hidden />
        <span className="flex min-w-0 flex-1 flex-nowrap items-start gap-2">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span
              data-cover-morph="identity"
              className={cn(
                "break-keep",
                dashboardTypography.cardTitle,
                onFill && "text-current",
              )}
            >
              {typeLabel}
            </span>
            <span
              data-cover-morph="marks"
              className="mt-0.5 flex min-w-0 items-center gap-2"
            >
              <StallUnitNoMark
                stallNo={reading.stallNo}
                onFill={onFill}
                className={cn(
                  dashboardTypography.cardDesc,
                  onFill && "text-current",
                )}
              />
              <ControllerNoMark
                eqpmnNo={reading.eqpmnNo}
                onFill={onFill}
                className={cn(
                  dashboardTypography.cardDesc,
                  onFill && "text-current",
                )}
              />
            </span>
          </span>
          {headerActionSlots > 0 ? (
            <span
              className="flex shrink-0 flex-nowrap items-center gap-1"
              aria-hidden
            >
              {Array.from({ length: headerActionSlots }, (_, i) => (
                <span key={i} className="size-7" />
              ))}
            </span>
          ) : null}
        </span>
      </span>
      <span className="flex min-h-0 flex-1 flex-col justify-center gap-1">
        {reason.valueLabel ? (
          <>
            <span
              data-cover-morph="value"
              className={cn(
                dashboardTypography.valueLg,
                onFill && "text-current",
              )}
            >
              {reason.valueLabel}
            </span>
            {reason.bandLabel ? (
              <span
                data-cover-morph="band"
                className={cn(
                  dashboardTypography.envCoverMeta,
                  onFill && "text-current",
                )}
              >
                {reason.bandLabel}
              </span>
            ) : null}
          </>
        ) : null}
      </span>
      <span
        className={cn(
          "break-keep opacity-70",
          dashboardTypography.envCoverStatus,
          onFill && "text-current",
        )}
      >
        {statusLabel}
      </span>
    </button>
  );
}
