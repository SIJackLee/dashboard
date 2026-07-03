"use client";

import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { BarnReading, ControllerStatus } from "@/lib/data/iot";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { ChannelSlot } from "@/lib/data/iot-channel";
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
import { ChannelFanDropdown } from "@/components/farm/channel-fan-dropdown";
import { BarnListPanelShell } from "@/components/farm/barn-list-panel-shell";
import { VentGaugeV1 } from "@/components/farm/controller-summary-gauge-parts";
import { dashboardUi, dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export function statusRingClass(status: ControllerStatus): string {
  if (status === "normal") return "outline outline-2 outline-emerald-500/70 -outline-offset-1";
  if (status === "caution") return "outline outline-2 outline-amber-500/80 -outline-offset-1";
  return "outline outline-2 outline-muted-foreground/40 -outline-offset-1";
}

const headerTogglePillClass =
  "inline-flex min-h-9 shrink-0 items-center justify-center rounded-full border px-3.5 text-sm font-semibold leading-snug transition-colors";

type HeaderTogglePillProps = {
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
};

export function GraphTogglePill({
  active,
  onClick,
  disabled,
}: HeaderTogglePillProps) {
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
          ? "border-sky-500 bg-sky-500/10 text-sky-800 dark:text-sky-300"
          : "border-border bg-background text-muted-foreground hover:bg-muted",
        disabled && "pointer-events-none",
        disabled && !active && "opacity-50"
      )}
    >
      그래프
    </button>
  );
}

export function SettingsTogglePill({
  active,
  onClick,
  disabled,
}: HeaderTogglePillProps) {
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
          ? "border-violet-500 bg-violet-500/10 text-violet-800 dark:text-violet-300"
          : "border-border bg-background text-muted-foreground hover:bg-muted",
        disabled && "pointer-events-none",
        disabled && !active && "opacity-50"
      )}
    >
      {active ? "설정 중" : "설정"}
    </button>
  );
}

export function MotorTogglePill({
  active,
  onClick,
  disabled,
}: HeaderTogglePillProps) {
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
          ? "border-sky-500 bg-sky-500/10 text-sky-800 dark:text-sky-300"
          : "border-border bg-background text-muted-foreground hover:bg-muted",
        disabled && "pointer-events-none",
        disabled && !active && "opacity-50"
      )}
    >
      모터
    </button>
  );
}

export function ControllerSummaryHeader({
  reading,
  graphActive,
  settingsActive,
  motorActive,
  showGraphPill = true,
  showSettingsPill = true,
  showMotorPill = true,
  onToggleGraph,
  onToggleSettings,
  onToggleMotor,
  className,
}: {
  reading: BarnReading;
  graphActive?: boolean;
  settingsActive?: boolean;
  motorActive?: boolean;
  showGraphPill?: boolean;
  showSettingsPill?: boolean;
  showMotorPill?: boolean;
  onToggleGraph?: () => void;
  onToggleSettings?: () => void;
  onToggleMotor?: () => void;
  className?: string;
}) {
  const showPills = showGraphPill || showSettingsPill || showMotorPill;

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
      <span className={cn("truncate font-semibold", dashboardUi.sectionTitle)}>
        {formatControllerNoLabel(reading.eqpmnNo)}
      </span>
      {showPills ? (
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
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
          {showMotorPill ? (
            <MotorTogglePill
              active={motorActive}
              onClick={onToggleMotor}
              disabled={onToggleMotor == null}
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
  channelDetail,
  channelDetailLoading,
}: {
  reading: BarnReading;
  thermo?: ControllerThermoSettings | null;
  compact?: boolean;
  expandedChannel?: ChannelSlot | null;
  onToggleChannel?: (slot: ChannelSlot) => void;
  channelDetail?: BarnReading;
  channelDetailLoading?: boolean;
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
      <BarnListPanelShell
        open={Boolean(expandedChannel && interactive)}
        panelKind="motor"
        className="mt-2"
      >
        {expandedChannel && interactive ? (
          <ChannelFanDropdown
            slot={expandedChannel}
            reading={reading}
            detailReading={channelDetail}
            loading={channelDetailLoading}
          />
        ) : null}
      </BarnListPanelShell>
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
          "absolute top-1 left-1.5 leading-none sm:top-1.5 sm:left-2",
          compact ? dashboardUi.gridCellMetaCompact : dashboardTypography.meta
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
