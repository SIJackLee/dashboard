"use client";

import { ChevronLeft, ChevronRight, LayoutGrid, LineChart, X } from "lucide-react";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { BarnReading, ControllerStatus } from "@/lib/data/iot";
import type {
  TrendControllerPeriodData,
  TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import { formatSensorNumberForDisplay } from "@/lib/data/reading-display";
import { formatStallTypeLabelCompact } from "@/lib/data/stall-type";
import type { StatusTone } from "@/components/common/status-badge";
import { StallUnitNoMark } from "@/components/farm/controller-summary-parts";
import { barnModelHud } from "@/lib/farm/barn-model-hud";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export type BarnModelLiveTrend = {
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  trendPeriod?: TrendPeriodId;
  onTrendPeriodChange?: (period: TrendPeriodId) => void;
  trendLoading?: boolean;
  trendStale?: boolean;
  alarmSettings?: AlarmSettings;
  thermoSettings?: Record<string, ControllerThermoSettings>;
};

/** 현장 전체보기 FarmMapCard statusCompact와 동일 */
const STATUS_ACCENT: Record<StatusTone, string> = {
  normal: "ring-1 ring-emerald-400/70",
  caution:
    "ring-2 ring-amber-400/80 shadow-[0_0_0_2px_rgba(245,158,11,0.16)]",
  warning:
    "ring-2 ring-red-500/90 shadow-[0_0_16px_2px_rgba(239,68,68,0.40)]",
  offline: "ring-1 ring-muted-foreground/30 opacity-70 saturate-50",
};

const STATUS_SURFACE: Record<StatusTone, string> = {
  normal: "bg-emerald-500/10",
  caution: "bg-amber-500/15",
  warning: "bg-red-500/15",
  offline: "bg-muted/40",
};

function roofStatusTone(status: ControllerStatus | "empty"): StatusTone {
  if (status === "caution") return "caution";
  if (status === "offline" || status === "empty") return "offline";
  return "normal";
}

export function BarnModelRoofCard({
  stallTyCode,
  stallNo,
  status,
  tempC,
  humidityPct,
  reading: _reading,
  trend: _trend,
  onDelete,
  onBackToField,
  onPrevBarn,
  onNextBarn,
  onCycleType,
  onPeekControllers,
  onTrend,
}: {
  stallTyCode: string;
  stallNo: string;
  status: ControllerStatus | "empty";
  tempC: number | null;
  humidityPct: number | null;
  reading: BarnReading | null;
  trend: BarnModelLiveTrend;
  onDelete?: () => void;
  onBackToField?: () => void;
  onPrevBarn?: () => void;
  onNextBarn?: () => void;
  onCycleType?: () => void;
  onPeekControllers?: () => void;
  onTrend?: () => void;
}) {
  const sensorStatus = status === "empty" ? "offline" : status;
  const tone = roofStatusTone(status);
  const typeName = formatStallTypeLabelCompact(stallTyCode);
  const no = stallNo.trim() || "01";
  const tempLabel = formatSensorNumberForDisplay(sensorStatus, tempC);
  const humLabel = formatSensorNumberForDisplay(sensorStatus, humidityPct);
  const hudBtn = barnModelHud.icon;

  const showTools = Boolean(onTrend || onDelete);

  return (
    <div
      className={cn(
        "flex w-[14rem] flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 text-center shadow-md",
        STATUS_SURFACE[tone],
        STATUS_ACCENT[tone],
      )}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {showTools ? (
        <div className="flex w-full items-center">
          <div className="flex items-center gap-0.5">
            {onTrend ? (
              <button
                type="button"
                className={hudBtn}
                aria-label="통합 추이"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onTrend();
                }}
              >
                <LineChart
                  className="size-3.5"
                  strokeWidth={dashboardUi.iconStroke}
                  aria-hidden
                />
              </button>
            ) : null}
          </div>
          <span className="min-w-0 flex-1" />
          {onDelete ? (
            <button
              type="button"
              className={hudBtn}
              aria-label="축사 삭제"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <X
                className="size-3.5"
                strokeWidth={dashboardUi.iconStroke}
                aria-hidden
              />
            </button>
          ) : null}
        </div>
      ) : null}
      <span
        className={cn(
          "flex w-full min-w-0 items-center gap-0.5",
          dashboardUi.gridCellValueCompact,
        )}
      >
        {onPrevBarn ? (
          <button
            type="button"
            className={hudBtn}
            aria-label="이전 축사"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onPrevBarn();
            }}
          >
            <ChevronLeft className="size-4" strokeWidth={dashboardUi.iconStroke} />
          </button>
        ) : null}
        <span className="flex min-w-0 flex-1 items-center justify-center gap-1">
          {onCycleType ? (
            <button
              type="button"
              className="min-w-0 truncate whitespace-nowrap rounded-sm hover:underline"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onCycleType();
              }}
            >
              {typeName}
            </button>
          ) : (
            <span className="min-w-0 truncate whitespace-nowrap">{typeName}</span>
          )}
          {onPeekControllers ? (
            <button
              type="button"
              className="shrink-0 rounded-sm"
              aria-label={`${no}번 컨트롤러 보기`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onPeekControllers();
              }}
            >
              <StallUnitNoMark stallNo={no} className="text-inherit" />
            </button>
          ) : (
            <StallUnitNoMark stallNo={no} className="shrink-0 text-inherit" />
          )}
        </span>
        {onNextBarn ? (
          <button
            type="button"
            className={hudBtn}
            aria-label="다음 축사"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onNextBarn();
            }}
          >
            <ChevronRight className="size-4" strokeWidth={dashboardUi.iconStroke} />
          </button>
        ) : null}
      </span>
      <span className="flex w-full flex-nowrap items-baseline justify-center gap-2 whitespace-nowrap leading-none">
        <span className="inline-flex shrink-0 items-baseline gap-px">
          <span
            className={cn(
              dashboardUi.gridCellValueCompact,
              dashboardUi.channelTextTemp,
            )}
          >
            {tempLabel != null && tempLabel !== "" ? tempLabel : "—"}
          </span>
          <span
            className={cn(
              "text-[0.65rem] font-medium",
              dashboardUi.channelTextTemp,
              "opacity-70",
            )}
          >
            ℃
          </span>
        </span>
        <span
          className="h-3 w-px shrink-0 self-center bg-border/60"
          aria-hidden
        />
        <span className="inline-flex shrink-0 items-baseline gap-px">
          <span
            className={cn(dashboardUi.gridCellValueCompact, "text-channel-info")}
          >
            {humLabel != null && humLabel !== "" ? humLabel : "—"}
          </span>
          <span className="text-[0.65rem] font-medium text-channel-info/70">
            %
          </span>
        </span>
      </span>
      {onBackToField ? (
        <button
          type="button"
          className={cn("mt-1", hudBtn)}
          aria-label="필드로"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onBackToField();
          }}
        >
          <LayoutGrid
            className="size-4"
            strokeWidth={dashboardUi.iconStroke}
            aria-hidden
          />
        </button>
      ) : null}
    </div>
  );
}
