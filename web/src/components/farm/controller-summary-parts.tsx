"use client";

import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { BarnReading, ControllerStatus } from "@/lib/data/iot";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { ChannelSlot } from "@/lib/data/iot-channel";
import type {
  TrendControllerPeriodData,
  TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import {
  CHANNELS,
  channelPercentsFromReading,
  formatChannelPercent,
  formatControllerHeaderStallType,
  formatHumidityAlarmRange,
  formatSetpointDisplay,
  formatTempAlarmRange,
  humidityAlarmBreached,
  resolveReadingAlarmThresholds,
  resolveReadingThermo,
  tempAlarmBreached,
} from "@/lib/farm/controller-summary-display";
import { formatSensorNumberForDisplay } from "@/lib/data/reading-display";
import { BarnChannelTrendPanel } from "@/components/farm/barn-channel-trend-panel";
import { BarnListPanelShell } from "@/components/farm/barn-list-panel-shell";
import { VentGaugeV1 } from "@/components/farm/controller-summary-gauge-parts";
import { dashboardUi, dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import { motionClass } from "@/lib/ui/motion-classes";
import { LineChart, Settings } from "lucide-react";
import { ControllerDeviceIcon } from "@/components/icons/controller-device-icon";
import {
  ControllerAffiliationMarks,
  ControllerNoMark,
  StallUnitNoMark,
} from "@/components/farm/controller-no-marks";

export function statusRingClass(status: ControllerStatus): string {
  if (status === "normal") return "outline outline-2 outline-emerald-500/70 -outline-offset-1";
  if (status === "caution") return "outline outline-2 outline-amber-500/80 -outline-offset-1";
  return "outline outline-2 outline-muted-foreground/40 -outline-offset-1";
}

const cardActionBtnClass = cn(
  "inline-flex size-7 shrink-0 items-center justify-center p-0 font-medium",
  dashboardTypography.badge,
  motionClass.microHover,
);

const cardActionWellClass =
  "inline-flex overflow-hidden rounded-md border bg-muted/60 shadow-sm dark:bg-background dark:shadow-none dark:ring-1 dark:ring-border";
const cardActionSelectedClass =
  "bg-background text-foreground dark:bg-primary/10 dark:text-foreground";
const cardActionIdleClass =
  "text-muted-foreground hover:bg-muted/50 hover:text-foreground";

export { ControllerAffiliationMarks, ControllerNoMark, StallUnitNoMark };

/**
 * 카드 헤더 액션: «차트에서 보기»(차트 탭 이동) + 설정 순환(컨트롤러 ↔ 설정).
 * 그래프 모드는 은퇴 — 이력은 차트 탭에서 확인.
 */
function CardPanelModeToggle({
  hideActions,
  settingsActive,
  onToggleSettings,
  onOpenChart,
}: {
  hideActions?: boolean;
  settingsActive?: boolean;
  onToggleSettings?: () => void;
  onOpenChart?: () => void;
}) {
  if (hideActions) return null;
  const canSettings = onToggleSettings != null;
  const canChart = onOpenChart != null;
  if (!canSettings && !canChart) return null;

  const settingsAria = settingsActive ? "컨트롤러로 접기" : "설정으로 전환";
  const SettingsIcon = settingsActive ? ControllerDeviceIcon : Settings;

  return (
    <div className="flex shrink-0 items-center gap-1">
      {canChart ? (
        <div
          className={cardActionWellClass}
          data-tour-id="panel-chart"
        >
          <button
            type="button"
            aria-label="차트에서 보기"
            title="차트에서 보기"
            onClick={(e) => {
              e.stopPropagation();
              onOpenChart?.();
            }}
            className={cn(cardActionBtnClass, cardActionIdleClass)}
          >
            <LineChart
              className="size-3.5"
              strokeWidth={dashboardUi.iconStroke}
              aria-hidden
            />
          </button>
        </div>
      ) : null}
      {canSettings ? (
        <div
          className={cardActionWellClass}
          data-tour-id="panel-pills"
        >
          <button
            type="button"
            aria-label={settingsAria}
            title={settingsActive ? "컨트롤러" : "설정"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSettings?.();
            }}
            className={cn(
              cardActionBtnClass,
              settingsActive ? cardActionSelectedClass : cardActionIdleClass,
            )}
          >
            <SettingsIcon
              className="size-3.5"
              strokeWidth={dashboardUi.iconStroke}
              aria-hidden
            />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ControllerSummaryHeader({
  reading,
  settingsActive,
  hideActions = false,
  showAffiliation = false,
  onToggleSettings,
  onOpenChart,
  className,
}: {
  reading: BarnReading;
  settingsActive?: boolean;
  /** 그리드 상세 등 — 카드 헤더 액션(차트/설정) 숨김 */
  hideActions?: boolean;
  /**
   * true(일반 보기): 축사유형·축사번호·컨트롤러.
   * false(그룹별 보기): 구역 헤더와 중복되므로 컨트롤러만.
   */
  showAffiliation?: boolean;
  onToggleSettings?: () => void;
  /** «차트에서 보기» — 해당 컨트롤러 스코프로 차트 탭 이동 */
  onOpenChart?: () => void;
  className?: string;
}) {
  const stallTypeLabel = formatControllerHeaderStallType(reading);

  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", className)}>
      <div className="flex min-w-0 items-start gap-2">
        <span
          className={cn(
            "mt-1.5 size-2.5 shrink-0 rounded-sm",
            reading.status === "normal" && "bg-emerald-500",
            reading.status === "caution" && "bg-amber-500",
            reading.status === "offline" && "bg-muted-foreground"
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          {showAffiliation ? (
            <>
              <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0">
                <span
                  className={cn(
                    "break-keep text-foreground",
                    dashboardTypography.cardTitle,
                  )}
                >
                  {stallTypeLabel}
                </span>
              </div>
              <div className="mt-0.5 flex min-w-0 items-center gap-2">
                <StallUnitNoMark
                  stallNo={reading.stallNo}
                  className={cn(
                    "text-muted-foreground",
                    dashboardTypography.cardDesc,
                  )}
                />
                <ControllerNoMark
                  eqpmnNo={reading.eqpmnNo}
                  className={cn(
                    "text-muted-foreground",
                    dashboardTypography.cardDesc,
                  )}
                />
                <div className="min-w-0 flex-1" />
                <CardPanelModeToggle
                  hideActions={hideActions}
                  settingsActive={settingsActive}
                  onToggleSettings={onToggleSettings}
                  onOpenChart={onOpenChart}
                />
              </div>
            </>
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              <ControllerNoMark
                eqpmnNo={reading.eqpmnNo}
                className={cn(
                  "text-foreground",
                  dashboardTypography.cardTitle,
                )}
              />
              <div className="min-w-0 flex-1" />
              <CardPanelModeToggle
                hideActions={hideActions}
                settingsActive={settingsActive}
                onToggleSettings={onToggleSettings}
                onOpenChart={onOpenChart}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function MetricValue({
  label,
  value,
  unit,
  accentClass,
  muted,
  alarmRange,
  alarmBreached,
}: {
  label: string;
  value: string;
  unit?: string;
  accentClass?: string;
  muted?: boolean;
  /** 해당 측정값(온도/습도)의 임계 가이드 상·하한 */
  alarmRange?: string;
  alarmBreached?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className={cn("text-muted-foreground", dashboardTypography.formLabel)}>{label}</div>
      <div className="mt-0.5 flex items-end gap-0.5 tabular-nums">
        <span
          className={cn(
            dashboardUi.valueLg,
            muted ? "text-muted-foreground" : accentClass ?? "text-foreground"
          )}
        >
          {value}
        </span>
        {unit ? (
          <span className={cn("pb-0.5 text-muted-foreground", dashboardUi.value)}>
            {unit}
          </span>
        ) : null}
      </div>
      {alarmRange ? (
        <div
          className={cn(
            "mt-0.5 tabular-nums",
            dashboardTypography.meta,
            alarmBreached
              ? "font-semibold text-amber-700 dark:text-amber-400"
              : "text-muted-foreground"
          )}
        >
          임계 {alarmRange}
        </div>
      ) : null}
    </div>
  );
}

export function SetpointBlock({
  thermo,
}: {
  thermo: ControllerThermoSettings | null;
}) {
  const { main, sub } = formatSetpointDisplay(thermo);
  return (
    <div className="min-w-0">
      <div className={cn("text-muted-foreground", dashboardTypography.formLabel)}>설정</div>
      <div className={cn("mt-0.5 font-bold tabular-nums", dashboardUi.sectionTitle)}>
        {main}
        {main !== "—" ? "℃" : null}
      </div>
      {sub ? (
        <div className={cn("mt-0.5 text-muted-foreground", dashboardTypography.meta)}>{sub}</div>
      ) : null}
    </div>
  );
}

export function ChannelStrip({
  reading,
  thermo,
  compact,
  expandedChannel,
  onToggleChannel,
  controllerTrendByPeriod = null,
  period = "24h",
  thermoSettings = {},
  hideChannelTrendExpand = false,
}: {
  reading: BarnReading;
  thermo?: ControllerThermoSettings | null;
  compact?: boolean;
  expandedChannel?: ChannelSlot | null;
  onToggleChannel?: (slot: ChannelSlot) => void;
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  period?: TrendPeriodId;
  thermoSettings?: Record<string, ControllerThermoSettings>;
  /** 표시 전용. 탭 시 채널 그래프는 차트 탭. */
  hideChannelTrendExpand?: boolean;
}) {
  const channels = channelPercentsFromReading(reading);
  const offline = reading.status === "offline";
  const interactive = onToggleChannel != null && !offline;

  return (
    <div className="min-w-0">
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {CHANNELS.map((slot) => (
          <ChannelCell
            key={slot}
            slot={slot}
            value={formatChannelPercent(channels[slot])}
            compact={compact}
            expanded={expandedChannel === slot}
            interactive={interactive}
            onToggle={onToggleChannel}
          />
        ))}
      </div>
      {!hideChannelTrendExpand ? (
      <BarnListPanelShell
        open={Boolean(expandedChannel && interactive)}
        panelKind="channelTrend"
        className="mt-2"
      >
        {expandedChannel && interactive ? (
          <BarnChannelTrendPanel
            reading={reading}
            controllerTrendByPeriod={controllerTrendByPeriod}
            period={period}
            thermoSettings={thermoSettings}
            layout="single"
            slot={expandedChannel}
            compact
          />
        ) : null}
      </BarnListPanelShell>
      ) : null}
      {thermo ? (
        <VentGaugeV1
          min={thermo.minVentPct}
          max={thermo.maxVentPct}
          compact={compact}
          className="mt-2"
        />
      ) : null}
    </div>
  );
}

function ChannelCell({
  slot,
  value,
  compact,
  expanded,
  interactive,
  onToggle,
}: {
  slot: ChannelSlot;
  value: string;
  compact?: boolean;
  expanded?: boolean;
  interactive?: boolean;
  onToggle?: (slot: ChannelSlot) => void;
}) {
  const label = `채널 ${slot} ${value}${value !== "—" ? "%" : ""}`;
  const cellClass = cn(
    "relative min-h-[3rem] rounded-md border bg-background/80 sm:min-h-[3.25rem]",
    compact ? "p-1.5 sm:p-2" : "p-2 sm:p-2.5",
    expanded &&
      "border-channel-info/60 bg-channel-info/5 ring-1 ring-channel-info/30",
    interactive &&
      cn(
        "cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        motionClass.microHover,
      )
  );

  const inner = (
    <>
      <span
        className={cn(
          "absolute top-1 left-1.5 font-semibold leading-none sm:top-1.5 sm:left-2",
          compact
            ? dashboardUi.gridCellMetaCompact
            : "text-[10px] sm:text-[11px]",
          "text-channel-info",
        )}
      >
        {slot}
      </span>
      <div className="flex h-full min-h-[2.25rem] items-center justify-center pt-2 sm:min-h-[2.5rem]">
        <span
          className={cn(
            compact ? dashboardUi.gridCellValueCompact : dashboardUi.gridCellValueDefault
          )}
        >
          {value}
        </span>
      </div>
      {expanded && interactive ? (
        <span
          className="absolute right-1.5 bottom-1 text-[10px] font-semibold text-channel-info"
          aria-hidden
        >
          ▼
        </span>
      ) : null}
    </>
  );

  if (interactive && onToggle) {
    return (
      <button
        type="button"
        className={cellClass}
        aria-label={label}
        aria-expanded={expanded}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(slot);
        }}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={cellClass} aria-label={label}>
      {inner}
    </div>
  );
}

export function useControllerSummaryData(
  reading: BarnReading,
  thermoSettings: Record<string, ControllerThermoSettings>,
  alarmSettings?: AlarmSettings
) {
  const offline = reading.status === "offline";
  const thermo = resolveReadingThermo(reading, thermoSettings);
  const thresholds = resolveReadingAlarmThresholds(reading, alarmSettings);
  const temp = formatSensorNumberForDisplay(reading.status, reading.tempC);
  const humidity = formatSensorNumberForDisplay(reading.status, reading.humidityPct);
  const tempBreached = tempAlarmBreached(reading, thresholds);
  const humidityBreached = humidityAlarmBreached(reading, thresholds);
  return {
    offline,
    thermo,
    thresholds,
    temp,
    humidity,
    tempAlarmRange: formatTempAlarmRange(thresholds),
    humidityAlarmRange: formatHumidityAlarmRange(thresholds),
    tempAlarmBreached: tempBreached != null,
    humidityAlarmBreached: humidityBreached != null,
  };
}
