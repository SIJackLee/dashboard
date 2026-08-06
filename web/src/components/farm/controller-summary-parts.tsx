"use client";

import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { BarnReading, ControllerStatus } from "@/lib/data/iot";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { ChannelSlot } from "@/lib/data/iot-channel";
import type {
  TrendControllerPeriodData,
  TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import type { BarnListViewMode } from "@/lib/farm/farm-view-url";
import {
  CHANNELS,
  channelPercentsFromReading,
  formatChannelPercent,
  formatControllerHeaderStallType,
  formatControllerHeaderStallUnit,
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
import { BarnChannelTrendPanel } from "@/components/farm/barn-channel-trend-panel";
import { BarnListPanelShell } from "@/components/farm/barn-list-panel-shell";
import { VentGaugeV1 } from "@/components/farm/controller-summary-gauge-parts";
import { dashboardUi, dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import { motionClass } from "@/lib/ui/motion-classes";
import { ChevronDown, ChevronUp, Cpu, LineChart, Settings } from "lucide-react";

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

const cardActionSelectedClass =
  "bg-background text-foreground dark:bg-primary/10 dark:text-primary";
const cardActionIdleClass =
  "text-muted-foreground hover:bg-muted/50 hover:text-foreground";

/** 컨트롤러 번호 — Cpu 아이콘 + N번 (aria에 정식 명칭) */
function ControllerNoMark({
  eqpmnNo,
  className,
  iconClassName,
}: {
  eqpmnNo: string | undefined;
  className?: string;
  iconClassName?: string;
}) {
  const noLabel = formatControllerNoLabel(eqpmnNo);
  return (
    <span
      className={cn("inline-flex min-w-0 items-center gap-1.5", className)}
      aria-label={`컨트롤러 ${noLabel}`}
      title={`컨트롤러 ${noLabel}`}
    >
      <Cpu className={cn("size-[1em] shrink-0", iconClassName)} aria-hidden />
      <span className="min-w-0 truncate tabular-nums">{noLabel}</span>
    </span>
  );
}

type HeaderTogglePillProps = {
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
};

/** @deprecated 카드 헤더는 단일 순환 버튼 사용 */
export function GraphTogglePill(props: HeaderTogglePillProps) {
  return (
    <span className="inline-flex overflow-hidden rounded-md border bg-muted/30">
      <button
        type="button"
        disabled={props.disabled}
        aria-label="그래프"
        title="그래프"
        onClick={(e) => {
          e.stopPropagation();
          props.onClick?.();
        }}
        className={cn(
          cardActionBtnClass,
          props.active ? cardActionSelectedClass : cardActionIdleClass,
        )}
      >
        <LineChart className="size-3.5" aria-hidden />
      </button>
    </span>
  );
}

/** @deprecated 카드 헤더는 단일 순환 버튼 사용 */
export function SettingsTogglePill({
  active,
  ...props
}: HeaderTogglePillProps) {
  return (
    <span className="inline-flex overflow-hidden rounded-md border bg-muted/30">
      <button
        type="button"
        disabled={props.disabled}
        aria-label={active ? "설정 중" : "설정"}
        title={active ? "설정 중" : "설정"}
        onClick={(e) => {
          e.stopPropagation();
          props.onClick?.();
        }}
        className={cn(
          cardActionBtnClass,
          active ? cardActionSelectedClass : cardActionIdleClass,
        )}
      >
        <Settings className="size-3.5" aria-hidden />
      </button>
    </span>
  );
}

/** 다음 패널 액션 — 목록 모드별 단일 버튼 순환 */
function nextCardPanelCycle(
  listMode: BarnListViewMode,
  graphActive: boolean,
  settingsActive: boolean,
): { label: "그래프" | "설정"; kind: "graph" | "settings" } {
  if (listMode === "graph") {
    // 설정 → 그래프 → 설정
    if (settingsActive) return { label: "그래프", kind: "graph" };
    return { label: "설정", kind: "settings" };
  }
  if (listMode === "settings") {
    // 그래프 → 설정 → 그래프 (그래프 오버레이 중이면 설정으로)
    if (graphActive && !settingsActive) {
      return { label: "설정", kind: "settings" };
    }
    return { label: "그래프", kind: "graph" };
  }
  // 컨트롤러: 그래프 → 설정 → 그래프
  if (settingsActive) return { label: "그래프", kind: "graph" };
  if (graphActive) return { label: "설정", kind: "settings" };
  return { label: "그래프", kind: "graph" };
}

function CardPanelModeToggle({
  listMode,
  hideGraphToggle,
  graphActive,
  settingsActive,
  onToggleGraph,
  onToggleSettings,
  showCardBodyToggle,
  cardBodyCollapsed,
  onToggleCardBody,
}: {
  listMode: BarnListViewMode;
  hideGraphToggle?: boolean;
  graphActive?: boolean;
  settingsActive?: boolean;
  onToggleGraph?: () => void;
  onToggleSettings?: () => void;
  showCardBodyToggle?: boolean;
  cardBodyCollapsed?: boolean;
  onToggleCardBody?: () => void;
}) {
  const canCycle =
    (onToggleGraph != null || onToggleSettings != null) &&
    !(hideGraphToggle && listMode === "controller");
  const cycle = canCycle
    ? nextCardPanelCycle(
        listMode,
        Boolean(graphActive),
        Boolean(settingsActive),
      )
    : null;

  if (!cycle && !showCardBodyToggle) return null;

  const onCycleClick = () => {
    if (!cycle) return;
    if (cycle.kind === "graph") onToggleGraph?.();
    else onToggleSettings?.();
  };

  const cycleDisabled =
    cycle == null ||
    (cycle.kind === "graph" ? onToggleGraph == null : onToggleSettings == null);

  const cycleAria =
    cycle?.kind === "graph" ? "그래프로 전환" : "설정으로 전환";
  const CycleIcon = cycle?.kind === "graph" ? LineChart : Settings;

  return (
    <div className="flex shrink-0 items-center gap-1">
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
            "inline-flex size-7 items-center justify-center rounded-md border bg-muted/30",
            !cardBodyCollapsed
              ? cardActionSelectedClass
              : cardActionIdleClass,
            motionClass.microHover,
          )}
        >
          {cardBodyCollapsed ? (
            <ChevronDown className="size-3.5" aria-hidden />
          ) : (
            <ChevronUp className="size-3.5" aria-hidden />
          )}
        </button>
      ) : null}
      {cycle ? (
        <div
          className="inline-flex overflow-hidden rounded-md border bg-muted/30"
          data-tour-id="panel-pills"
        >
          <button
            type="button"
            disabled={cycleDisabled}
            aria-label={cycleAria}
            title={cycle.label}
            onClick={(e) => {
              e.stopPropagation();
              onCycleClick();
            }}
            className={cn(
              cardActionBtnClass,
              cardActionIdleClass,
              cycleDisabled && "pointer-events-none opacity-50",
            )}
          >
            <CycleIcon className="size-3.5" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ControllerSummaryHeader({
  reading,
  graphActive,
  settingsActive,
  listMode = "controller",
  hideGraphToggle = false,
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
  /** 목록 전역 모드 — 카드 액션 순환 기준 */
  listMode?: BarnListViewMode;
  /** 그리드 등 — 그래프 토글 숨김 */
  hideGraphToggle?: boolean;
  /**
   * true(일반 보기): 축사유형·축사번호·컨트롤러.
   * false(그룹별 보기): 구역 헤더와 중복되므로 컨트롤러만.
   */
  showAffiliation?: boolean;
  /** 그래프 모드 — 본문 접힘 시 chevron·상태 힌트 */
  cardBodyCollapsed?: boolean;
  onToggleGraph?: () => void;
  onToggleSettings?: () => void;
  onToggleCardBody?: () => void;
  className?: string;
}) {
  const showCardBodyToggle = onToggleCardBody != null;
  const stallTypeLabel = formatControllerHeaderStallType(reading);
  const stallUnitLabel = formatControllerHeaderStallUnit(reading);
  const offline = reading.status === "offline";
  const caution = reading.status === "caution";

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
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0">
                <span
                  className={cn(
                    "break-keep text-foreground",
                    dashboardTypography.cardTitle,
                  )}
                >
                  {stallTypeLabel}
                </span>
                <span
                  className={cn(
                    "break-keep text-foreground/85",
                    dashboardTypography.sectionTitle,
                  )}
                >
                  {stallUnitLabel}
                </span>
              </div>
              <div className="mt-0.5 flex min-w-0 items-center gap-2">
                <ControllerNoMark
                  eqpmnNo={reading.eqpmnNo}
                  className={cn(
                    "min-w-0 flex-1 text-muted-foreground",
                    dashboardTypography.cardDesc,
                  )}
                />
                <CardPanelModeToggle
                  listMode={listMode}
                  hideGraphToggle={hideGraphToggle}
                  graphActive={graphActive}
                  settingsActive={settingsActive}
                  onToggleGraph={onToggleGraph}
                  onToggleSettings={onToggleSettings}
                  showCardBodyToggle={showCardBodyToggle}
                  cardBodyCollapsed={cardBodyCollapsed}
                  onToggleCardBody={onToggleCardBody}
                />
              </div>
            </>
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              <ControllerNoMark
                eqpmnNo={reading.eqpmnNo}
                className={cn(
                  "min-w-0 flex-1 text-foreground",
                  dashboardTypography.cardTitle,
                )}
              />
              <CardPanelModeToggle
                listMode={listMode}
                hideGraphToggle={hideGraphToggle}
                graphActive={graphActive}
                settingsActive={settingsActive}
                onToggleGraph={onToggleGraph}
                onToggleSettings={onToggleSettings}
                showCardBodyToggle={showCardBodyToggle}
                cardBodyCollapsed={cardBodyCollapsed}
                onToggleCardBody={onToggleCardBody}
              />
            </div>
          )}
          {cardBodyCollapsed && (offline || caution) ? (
            <span
              className={cn(
                "block break-keep",
                offline
                  ? "text-muted-foreground"
                  : "text-amber-700 dark:text-amber-400",
                dashboardTypography.cardDesc,
              )}
            >
              {offline ? "오프라인" : "수신 지연"}
            </span>
          ) : null}
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
  /** 모바일 sheet — 채널 탭 시 BarnChannelTrendPanel 펼침 비활성. */
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
