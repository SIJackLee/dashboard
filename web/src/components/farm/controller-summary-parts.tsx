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
import { normalizeEqpmnNo } from "@/lib/data/controller-key";
import { stallKeyFromReading } from "@/lib/data/reading-hierarchy";
import { formatSensorNumberForDisplay } from "@/lib/data/reading-display";
import { BarnChannelTrendPanel } from "@/components/farm/barn-channel-trend-panel";
import { BarnListPanelShell } from "@/components/farm/barn-list-panel-shell";
import { VentGaugeV1 } from "@/components/farm/controller-summary-gauge-parts";
import { dashboardUi, dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import { motionClass } from "@/lib/ui/motion-classes";
import { ChevronDown, ChevronUp, LineChart, Settings } from "lucide-react";
import { ControllerDeviceIcon } from "@/components/icons/controller-device-icon";
import { StallUnitIcon } from "@/components/icons/stall-unit-icon";

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

/** 번호 오버레이 — 글자 둘레 아주 얇은 할로(카드 면색)로 아이콘 선과 분리 */
const noMarkDigitClass = cn(
  "pointer-events-none absolute bottom-0 right-0 z-[1]",
  "font-bold tabular-nums leading-none text-foreground",
  "text-[0.68em]",
  "[-webkit-text-stroke:1.5px_var(--card)]",
  "[paint-order:stroke_fill]",
);

/** 컨트롤러 번호 — 장치 아이콘 우하단에 번호 오버레이 (aria에 정식 명칭)
 *  B안: 아이콘 muted · 번호 foreground · 글자 둘레 얇은 할로
 */
export function ControllerNoMark({
  eqpmnNo,
  className,
  iconClassName,
}: {
  eqpmnNo: string | undefined;
  className?: string;
  iconClassName?: string;
}) {
  const eq = normalizeEqpmnNo(eqpmnNo ?? "01");
  const noLabel = formatControllerNoLabel(eqpmnNo);
  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      aria-label={`컨트롤러 ${noLabel}`}
      title={`컨트롤러 ${noLabel}`}
    >
      <ControllerDeviceIcon
        className={cn(
          "size-[1.35em] shrink-0 text-muted-foreground",
          iconClassName,
        )}
        numberCutout
        aria-hidden
      />
      <span className={noMarkDigitClass} aria-hidden>
        {eq}
      </span>
    </span>
  );
}

/** 축사 번호 — 박공 창고 아이콘 우하단 오버레이 (aria에 「N번 축사」)
 *  B안: 아이콘 muted · 번호 foreground · 글자 둘레 얇은 할로
 */
export function StallUnitNoMark({
  stallNo,
  className,
  iconClassName,
}: {
  stallNo: string | null | undefined;
  className?: string;
  iconClassName?: string;
}) {
  const key = stallKeyFromReading({ stallNo: stallNo ?? null });
  const display = key.startsWith("__") ? "—" : key;
  const unitLabel = formatControllerHeaderStallUnit({
    stallNo: stallNo ?? null,
    controllerKey: undefined,
    idx: undefined,
  });
  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      aria-label={unitLabel}
      title={unitLabel}
    >
      <StallUnitIcon
        className={cn(
          "size-[1.35em] shrink-0 text-muted-foreground",
          iconClassName,
        )}
        numberCutout
        aria-hidden
      />
      <span className={noMarkDigitClass} aria-hidden>
        {display}
      </span>
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
        <LineChart
          className="size-3.5"
          strokeWidth={dashboardUi.iconStroke}
          aria-hidden
        />
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
        <Settings
          className="size-3.5"
          strokeWidth={dashboardUi.iconStroke}
          aria-hidden
        />
      </button>
    </span>
  );
}

/**
 * 카드 패널 순환: 컨트롤러 → 그래프 → 설정 → 컨트롤러.
 * 버튼은 «다음에 갈 모드» 아이콘을 보여 줌.
 */
function nextCardPanelCycle(
  graphActive: boolean,
  settingsActive: boolean,
): {
  label: "그래프" | "설정" | "컨트롤러";
  kind: "graph" | "settings" | "controller";
} {
  if (settingsActive) {
    return { label: "컨트롤러", kind: "controller" };
  }
  if (graphActive) {
    return { label: "설정", kind: "settings" };
  }
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
    ? nextCardPanelCycle(Boolean(graphActive), Boolean(settingsActive))
    : null;

  if (!cycle && !showCardBodyToggle) return null;

  const onCycleClick = () => {
    if (!cycle) return;
    if (cycle.kind === "graph") {
      onToggleGraph?.();
      return;
    }
    if (cycle.kind === "settings") {
      onToggleSettings?.();
      return;
    }
    // 컨트롤러로 접기
    if (listMode === "settings" && settingsActive) {
      // 설정 전역 모드 — 설정Keys 토글만으로는 안 닫힘 → 그래프로 전환
      onToggleGraph?.();
      return;
    }
    if (settingsActive) onToggleSettings?.();
    else if (graphActive) onToggleGraph?.();
  };

  const cycleDisabled =
    cycle == null ||
    (cycle.kind === "graph"
      ? onToggleGraph == null
      : cycle.kind === "settings"
        ? onToggleSettings == null
        : onToggleGraph == null && onToggleSettings == null);

  const cycleAria =
    cycle?.kind === "graph"
      ? "그래프로 전환"
      : cycle?.kind === "settings"
        ? "설정으로 전환"
        : "컨트롤러로 접기";
  const CycleIcon =
    cycle?.kind === "graph"
      ? LineChart
      : cycle?.kind === "settings"
        ? Settings
        : ControllerDeviceIcon;

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
            <ChevronDown
              className="size-3.5"
              strokeWidth={dashboardUi.iconStroke}
              aria-hidden
            />
          ) : (
            <ChevronUp
              className="size-3.5"
              strokeWidth={dashboardUi.iconStroke}
              aria-hidden
            />
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
            <CycleIcon
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
                  "text-foreground",
                  dashboardTypography.cardTitle,
                )}
              />
              <div className="min-w-0 flex-1" />
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
