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
  formatControllerNoLabel,
  formatHumidityAlarmRange,
  formatSetpointDisplay,
  formatTempAlarmRange,
  humidityAlarmBreached,
  resolveReadingAlarmThresholds,
  resolveReadingThermo,
  tempAlarmBreached,
} from "@/lib/farm/controller-summary-display";
import { formatSensorNumberForDisplay } from "@/lib/data/reading-display";
import { formatStallTypeLabel } from "@/lib/data/stall-type";
import {
  stallKeyFromReading,
  stallLabelFromKey,
} from "@/lib/data/reading-hierarchy";
import { BarnMotorTrendPanel } from "@/components/farm/barn-motor-trend-panel";
import { BarnListPanelShell } from "@/components/farm/barn-list-panel-shell";
import { VentGaugeV1 } from "@/components/farm/controller-summary-gauge-parts";
import { dashboardUi, dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

export function statusRingClass(status: ControllerStatus): string {
  if (status === "normal") return "outline outline-2 outline-emerald-500/70 -outline-offset-1";
  if (status === "caution") return "outline outline-2 outline-amber-500/80 -outline-offset-1";
  return "outline outline-2 outline-muted-foreground/40 -outline-offset-1";
}

const headerTogglePillClass =
  "inline-flex min-h-9 shrink-0 items-center justify-center rounded-full border px-3.5 text-sm font-semibold leading-snug transition-colors";

const headerTogglePillActiveClass = {
  motor: "border-sky-500 bg-sky-500/10 text-sky-800 dark:text-sky-300",
  settings: "border-violet-500 bg-violet-500/10 text-violet-800 dark:text-violet-300",
} as const;

type HeaderTogglePillProps = {
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
};

function HeaderTogglePill({
  active,
  onClick,
  disabled,
  label,
  activeClass,
}: HeaderTogglePillProps & { label: string; activeClass: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        headerTogglePillClass,
        active
          ? activeClass
          : "border-border bg-background text-muted-foreground hover:bg-muted",
        disabled && "pointer-events-none",
        disabled && !active && "opacity-50"
      )}
    >
      {label}
    </button>
  );
}

export function GraphTogglePill(props: HeaderTogglePillProps) {
  return (
    <HeaderTogglePill
      {...props}
      label="그래프"
      activeClass={headerTogglePillActiveClass.motor}
    />
  );
}

export function SettingsTogglePill({
  active,
  ...props
}: HeaderTogglePillProps) {
  return (
    <HeaderTogglePill
      {...props}
      active={active}
      label={active ? "설정 중" : "설정"}
      activeClass={headerTogglePillActiveClass.settings}
    />
  );
}

export function ControllerSummaryHeader({
  reading,
  graphActive,
  settingsActive,
  showGraphPill = true,
  showSettingsPill = true,
  showAffiliation = false,
  cardBodyCollapsed = false,
  onToggleGraph,
  onToggleSettings,
  onToggleCardBody,
  className,
}: {
  reading: BarnReading;
  graphActive?: boolean;
  settingsActive?: boolean;
  showGraphPill?: boolean;
  showSettingsPill?: boolean;
  showAffiliation?: boolean;
  /** 그래프 모드 — 본문 접힘 시 chevron·상태 힌트 */
  cardBodyCollapsed?: boolean;
  onToggleGraph?: () => void;
  onToggleSettings?: () => void;
  onToggleCardBody?: () => void;
  className?: string;
}) {
  const showCardBodyToggle = onToggleCardBody != null;
  const showPills = showGraphPill || showSettingsPill || showCardBodyToggle;
  const affiliationLabel = showAffiliation
    ? `${formatStallTypeLabel(reading.stallTyCode)} · ${stallLabelFromKey(stallKeyFromReading(reading))}`
    : null;
  const offline = reading.status === "offline";
  const caution = reading.status === "caution";

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <span
        className={cn(
          "size-2.5 shrink-0 rounded-sm",
          reading.status === "normal" && "bg-emerald-500",
          reading.status === "caution" && "bg-amber-500",
          reading.status === "offline" && "bg-muted-foreground"
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <span className={cn("block truncate font-semibold", dashboardUi.sectionTitle)}>
          {formatControllerNoLabel(reading.eqpmnNo)}
        </span>
        {affiliationLabel ? (
          <span
            className={cn(
              "block truncate text-muted-foreground",
              dashboardTypography.meta
            )}
          >
            {affiliationLabel}
          </span>
        ) : null}
        {cardBodyCollapsed && (offline || caution) ? (
          <span
            className={cn(
              "block truncate",
              offline
                ? "text-muted-foreground"
                : "text-amber-700 dark:text-amber-400",
              dashboardTypography.meta,
            )}
          >
            {offline ? "오프라인" : "알람"}
          </span>
        ) : null}
      </div>
      {showPills ? (
        <div
          className="ml-auto flex shrink-0 items-center gap-1.5"
          data-tour-id="panel-pills"
        >
          {showCardBodyToggle ? (
            <button
              type="button"
              aria-expanded={!cardBodyCollapsed}
              aria-label={
                cardBodyCollapsed
                  ? "컨트롤러 본문 펼치기"
                  : "컨트롤러 본문 접기"
              }
              onClick={(e) => {
                e.stopPropagation();
                onToggleCardBody?.();
              }}
              className={cn(
                headerTogglePillClass,
                "px-2.5",
                !cardBodyCollapsed
                  ? "border-sky-500 bg-sky-500/10 text-sky-800 dark:text-sky-300"
                  : "border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {cardBodyCollapsed ? (
                <ChevronDown className="size-4" aria-hidden />
              ) : (
                <ChevronUp className="size-4" aria-hidden />
              )}
            </button>
          ) : null}
          {showGraphPill ? (
            <GraphTogglePill
              active={graphActive}
              onClick={onToggleGraph}
              disabled={onToggleGraph == null}
            />
          ) : null}
          {showSettingsPill ? (
            <SettingsTogglePill
              active={settingsActive}
              onClick={onToggleSettings}
              disabled={onToggleSettings == null}
            />
          ) : null}
        </div>
      ) : null}
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
  /** 해당 측정값(온도/습도)의 알람 상·하한 */
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
          알람 {alarmRange}
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
  hideMotorExpand = false,
}: {
  reading: BarnReading;
  thermo?: ControllerThermoSettings | null;
  compact?: boolean;
  expandedChannel?: ChannelSlot | null;
  onToggleChannel?: (slot: ChannelSlot) => void;
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  period?: TrendPeriodId;
  thermoSettings?: Record<string, ControllerThermoSettings>;
  /** 모바일 sheet — 채널 탭 시 BarnMotorTrendPanel 펼침 비활성. */
  hideMotorExpand?: boolean;
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
      {!hideMotorExpand ? (
      <BarnListPanelShell
        open={Boolean(expandedChannel && interactive)}
        panelKind="motor"
        className="mt-2"
      >
        {expandedChannel && interactive ? (
          <BarnMotorTrendPanel
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
      "border-sky-500/60 bg-sky-500/5 ring-1 ring-sky-500/30",
    interactive &&
      "cursor-pointer transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
  );

  const inner = (
    <>
      <span
        className={cn(
          "absolute top-1 left-1.5 font-semibold leading-none sm:top-1.5 sm:left-2",
          compact
            ? dashboardUi.gridCellMetaCompact
            : "text-[10px] sm:text-[11px]",
          "text-sky-700 dark:text-sky-300",
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
          className="absolute right-1.5 bottom-1 text-[10px] font-semibold text-sky-600 dark:text-sky-400"
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
