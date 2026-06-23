"use client";

import { useState, type ReactNode } from "react";
import { useCommandPipelineRefresh } from "@/components/controllers/use-command-pipeline-refresh";
import { ControllerTempTripleSlider } from "@/components/controllers/controller-temp-triple-slider";
import { ThresholdRangeSlider } from "@/components/settings/threshold-range-slider";
import {
  Activity,
  Droplets,
  Fan,
  Layers,
  Loader2,
  Power,
  Thermometer,
  Wind,
} from "lucide-react";
import { SectionCard } from "@/components/common/section-card";
import { PageActionButton } from "@/components/common/page-action-button";
import type { AlarmThresholdHeaderState } from "@/components/settings/alarm-threshold-form";
import { StatusBadge } from "@/components/common/status-badge";
import { ControllerListPanel } from "@/components/controllers/controller-list-panel";
import { ControllerNameLabel } from "@/components/common/controller-name-label";
import { useControllerMeta } from "@/components/controllers/controller-meta-provider";
import { useDisplayEnabled } from "@/components/display/display-settings-provider";
import { Button } from "@/components/ui/button";
import type { ControllerReading } from "@/lib/data/iot";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import { commandStatusLabel } from "@/lib/controllers/controller-settings";
import type { ThermoCommand } from "@/lib/data/commands";
import {
  pipelineDetailMessage,
  UNKNOWN_SETTINGS_HINT,
} from "@/lib/ui/controller-labels";
import { type PanelMenuId } from "@/lib/controllers/controller-panel-map";
import { useControllerPanel } from "./use-controller-panel";
import {
  CHANNEL_SLOT_LABELS,
  channelBySlot,
  DEFAULT_CHANNEL_EQPMN,
  formatChannelEquipmentLabel,
  type ChannelSlot,
} from "@/lib/data/iot-channel";
import { dashboardTypography, dashboardUi } from "@/lib/ui/dashboard-page-ui";
import {
  formatOperationPctForDisplay,
  formatPctForDisplay,
  formatTempForDisplay,
  isReadingOnline,
} from "@/lib/data/reading-display";
import { cn } from "@/lib/utils";

type PanelControlProps = {
  reading?: ControllerReading;
  detailLoading?: boolean;
  knownSettings: ControllerThermoSettings | null;
  latestCommand?: ThermoCommand | null;
  canCommand: boolean;
  controllerList?: ControllerReading[];
  selectedControllerKey?: string;
  onControllerSelect?: (key: string) => void;
  spLabel?: string;
  activeChannel?: ChannelSlot;
  onChannelChange?: (channel: ChannelSlot) => void;
  /** OpsScopeBar에서 컨트롤러 pill로 선택 — 중앙 목록 숨김 */
  hideControllerList?: boolean;
  /** 알람 임계값 — 병합「알림값」패널 슬롯 */
  alarmThresholdHeader?: AlarmThresholdHeaderState | null;
  alarmSettingsPanel?: ReactNode;
  /** 모바일 분할 셸 내장 — SectionCard·LiveMonitor 생략, 컴팩트 배치 */
  mobileSplit?: boolean;
};

function ChannelSlotIcon({
  slot,
  compact,
}: {
  slot: ChannelSlot;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "font-bold font-mono leading-none",
        compact ? "text-sm" : "text-3xl"
      )}
    >
      {slot}
    </span>
  );
}

function ChannelSettingsBar({
  reading,
  activeChannel,
  onChannelChange,
  compact = false,
}: {
  reading?: ControllerReading;
  activeChannel: ChannelSlot;
  onChannelChange?: (channel: ChannelSlot) => void;
  compact?: boolean;
}) {
  const slots: ChannelSlot[] = ["A", "B", "C"];
  const channels = reading?.channels ?? [];

  if (compact) {
    return (
      <div className="space-y-1">
        <p className="text-[10px] font-medium text-muted-foreground">채널</p>
        <div className="grid grid-cols-3 gap-1.5">
          {slots.map((slot) => {
            const ch = channelBySlot(channels, slot);
            const equipmentLabel = formatChannelEquipmentLabel(
              slot,
              ch?.eqpmnCode
            );
            const active = slot === activeChannel;
            return (
              <button
                key={slot}
                type="button"
                disabled={!onChannelChange}
                onClick={() => onChannelChange?.(slot)}
                aria-pressed={active}
                aria-label={`${CHANNEL_SLOT_LABELS[slot]} · ${equipmentLabel}`}
                className={cn(
                  "flex aspect-[4/3] min-h-0 w-full min-w-0 items-center justify-center rounded-lg border transition-colors",
                  active
                    ? "border-primary/50 bg-primary/10 ring-1 ring-primary/30"
                    : "border-border/70 bg-muted/15 hover:bg-muted/30",
                  !onChannelChange && "cursor-default opacity-70"
                )}
              >
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary",
                    active && "bg-primary/20"
                  )}
                >
                  <ChannelSlotIcon slot={slot} compact />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(dashboardUi.sectionMuted, "mb-3")}>
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-2",
            dashboardUi.sectionTitle
          )}
        >
          <Layers className={cn(dashboardUi.iconMd, "text-primary")} aria-hidden />
          채널 설정
        </span>
      </div>
      <div className={cn("mt-3 grid grid-cols-3", dashboardUi.gridGap)}>
        {slots.map((slot) => {
          const ch = channelBySlot(channels, slot);
          const equipmentLabel = formatChannelEquipmentLabel(
            slot,
            ch?.eqpmnCode
          );
          const active = slot === activeChannel;
          return (
            <button
              key={slot}
              type="button"
              disabled={!onChannelChange}
              onClick={() => onChannelChange?.(slot)}
              aria-pressed={active}
              aria-label={`${CHANNEL_SLOT_LABELS[slot]} · ${equipmentLabel}`}
              className={cn(
                dashboardUi.metricTile,
                "flex items-center gap-3 p-4 md:p-5 text-left transition-colors",
                active
                  ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30"
                  : "hover:bg-muted/40",
                !onChannelChange && "cursor-default opacity-70"
              )}
            >
              <span
                className={cn(
                  "flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary",
                  active && "bg-primary/20"
                )}
              >
                <ChannelSlotIcon slot={slot} />
              </span>
              <div className="min-w-0 flex-1">
                <p className={dashboardUi.label}>{CHANNEL_SLOT_LABELS[slot]}</p>
                <p className={cn("mt-1", dashboardUi.valueLg)}>{equipmentLabel}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CommandPipelineStatus({
  command,
}: {
  command: ThermoCommand | null | undefined;
}) {
  useCommandPipelineRefresh(command?.status, command?.id);

  if (!command) return null;

  const toneClass =
    command.status === "applied"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : command.status === "sent"
        ? "border-sky-200 bg-sky-50 text-sky-800"
        : command.status === "pending"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : command.status === "failed"
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-border bg-muted/40 text-muted-foreground";

  const detail = pipelineDetailMessage(command.status, command.errorMsg);

  return (
    <div className={cn(dashboardUi.banner, "text-left", toneClass)}>
      <p className={dashboardUi.bannerTitle}>{commandStatusLabel(command.status)}</p>
      {detail ? (
        <p className={cn("mt-0.5", dashboardUi.label)}>{detail}</p>
      ) : null}
    </div>
  );
}

function LiveMetricTile({
  label,
  value,
  icon,
  large = false,
}: {
  label: string;
  value: string | null;
  icon: ReactNode;
  large?: boolean;
}) {
  if (!value) return null;

  return (
    <div
      className={cn(
        dashboardUi.metricTile,
        "flex min-w-0 items-center gap-2 p-2 md:gap-3 md:p-4 lg:p-5"
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary md:rounded-xl",
          large
            ? "size-10 [&_svg]:size-5 md:size-14 md:[&_svg]:size-9"
            : "size-9 [&_svg]:size-4 md:size-12 md:[&_svg]:size-8"
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] text-muted-foreground md:text-base lg:text-2xl">
          {label}
        </p>
        <p
          className={cn(
            "mt-0.5 truncate tabular-nums text-sm md:mt-1 md:text-base",
            large && "md:text-2xl lg:text-4xl"
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function MobileMetricCell({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function LiveMonitor({
  reading,
  powerOn,
}: {
  reading?: ControllerReading;
  powerOn: boolean;
}) {
  return (
    <div className={dashboardUi.sectionMuted}>
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-2",
            dashboardUi.sectionTitle
          )}
        >
          <Activity className={cn(dashboardUi.iconMd, "text-primary")} aria-hidden />
          LIVE 모니터
        </span>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 text-xs font-medium md:gap-2 md:text-2xl",
            reading && powerOn ? "text-emerald-600" : "text-muted-foreground"
          )}
        >
          <Power className={dashboardUi.iconMd} aria-hidden />
          POWER {reading ? (powerOn ? "ON" : "OFF") : "--"}
        </span>
      </div>

      <div className={cn("mt-3 grid grid-cols-3", dashboardUi.gridGap)}>
        <LiveMetricTile
          label="현재 온도"
          value={formatTempForDisplay(reading?.status, reading?.tempC)}
          icon={<Thermometer className="size-full" aria-hidden />}
          large
        />
        <LiveMetricTile
          label="습도"
          value={formatPctForDisplay(reading?.status, reading?.humidityPct)}
          icon={<Droplets className="size-full" aria-hidden />}
          large
        />
        <LiveMetricTile
          label="원동작"
          value={formatOperationPctForDisplay(reading)}
          icon={<Activity className="size-full" aria-hidden />}
          large
        />
      </div>

      <div className={cn("mt-3 grid grid-cols-3", dashboardUi.gridGap)}>
        <LiveMetricTile
          label="송풍"
          value={formatPctForDisplay(reading?.status, reading?.fanSupply)}
          icon={<Wind className="size-full" aria-hidden />}
        />
        <LiveMetricTile
          label="배기"
          value={formatPctForDisplay(reading?.status, reading?.fanExhaust)}
          icon={<Fan className="size-full" aria-hidden />}
        />
        <LiveMetricTile
          label="입기"
          value={formatPctForDisplay(reading?.status, reading?.fanIntake)}
          icon={<Wind className="size-full" aria-hidden />}
        />
      </div>
    </div>
  );
}

type SliderGroupId = "temp" | "vent";

function DesktopGroupedSliders({
  sliderValues,
  currentValues,
  isFieldChanged,
  disabled,
  embedded = false,
  onTempChange,
  onVentChange,
}: {
  sliderValues: Record<PanelMenuId, number>;
  currentValues: Record<PanelMenuId, number> | null;
  isFieldChanged: (menu: PanelMenuId) => boolean;
  disabled?: boolean;
  embedded?: boolean;
  onTempChange: (setpoint: number, deviation: number) => void;
  onVentChange: (minVent: number, maxVent: number) => void;
}) {
  const tempChanged =
    isFieldChanged("setpoint") || isFieldChanged("deviation");
  const ventChanged =
    isFieldChanged("minVent") || isFieldChanged("maxVent");

  const grid = (
    <div className={dashboardUi.sliderGrid}>
        <div
          className={cn(
            dashboardUi.innerCard,
            "bg-background",
            tempChanged && "ring-1 ring-primary/20"
          )}
        >
          <div className="mb-1 flex items-center gap-2">
            <Thermometer
              className={cn(dashboardUi.iconSm, "text-orange-600")}
              aria-hidden
            />
            <p className={dashboardTypography.sectionTitle}>온도</p>
            {currentValues ? (
              <span className={cn("ml-auto tabular-nums", dashboardTypography.meta, "text-muted-foreground")}>
                현재 {currentValues.setpoint}℃ ±{currentValues.deviation}℃
              </span>
            ) : null}
          </div>
          <ControllerTempTripleSlider
            setpoint={sliderValues.setpoint}
            deviation={sliderValues.deviation}
            disabled={disabled}
            onChange={onTempChange}
          />
        </div>

        <div className={ventChanged ? "ring-1 ring-primary/20 rounded-xl" : undefined}>
          <ThresholdRangeSlider
            title="환기"
            icon={
              <Fan className={cn(dashboardUi.iconSm, "text-sky-600")} aria-hidden />
            }
            min={0}
            max={100}
            step={5}
            low={sliderValues.minVent}
            high={sliderValues.maxVent}
            unit="%"
            lowLabel="최저환기"
            highLabel="최고환기"
            accentClass="bg-sky-500/35"
            showAxis
            disabled={disabled}
            onChange={onVentChange}
          />
        </div>
      </div>
  );

  if (embedded) {
    return <div className="hidden md:block">{grid}</div>;
  }

  return (
    <div className={cn("hidden md:block", dashboardUi.section)}>
      <p className={dashboardTypography.sectionTitle}>알림값</p>
      {grid}
    </div>
  );
}

function MobileGroupedSliders({
  sliderValues,
  isFieldChanged,
  disabled,
  embedded = false,
  mobileSplit = false,
  onTempChange,
  onVentChange,
}: {
  sliderValues: Record<PanelMenuId, number>;
  isFieldChanged: (menu: PanelMenuId) => boolean;
  disabled?: boolean;
  embedded?: boolean;
  mobileSplit?: boolean;
  onTempChange: (setpoint: number, deviation: number) => void;
  onVentChange: (minVent: number, maxVent: number) => void;
}) {
  const [group, setGroup] = useState<SliderGroupId>("temp");
  const tempChanged =
    isFieldChanged("setpoint") || isFieldChanged("deviation");
  const ventChanged =
    isFieldChanged("minVent") || isFieldChanged("maxVent");

  const tabBtnClass = mobileSplit
    ? "h-8 min-h-8 px-3 text-sm"
    : dashboardUi.btnMenuTab;

  const tabs = (
    <>
      <div className={cn("flex flex-wrap", mobileSplit ? "gap-1.5" : dashboardUi.chipStripGap)}>
        <Button
          type="button"
          variant={group === "temp" ? "default" : "outline"}
          disabled={disabled}
          onClick={() => setGroup("temp")}
          className={cn(
            tabBtnClass,
            tempChanged &&
              group !== "temp" &&
              "border-amber-400/70 text-amber-900 dark:text-amber-100"
          )}
        >
          온도
          {tempChanged ? " · Δ" : null}
        </Button>
        <Button
          type="button"
          variant={group === "vent" ? "default" : "outline"}
          disabled={disabled}
          onClick={() => setGroup("vent")}
          className={cn(
            tabBtnClass,
            ventChanged &&
              group !== "vent" &&
              "border-amber-400/70 text-amber-900 dark:text-amber-100"
          )}
        >
          환기
          {ventChanged ? " · Δ" : null}
        </Button>
      </div>

      <div className={cn(mobileSplit ? "mt-2" : "mt-3", dashboardUi.swipePanel)}>
        {group === "temp" ? (
          <ControllerTempTripleSlider
            setpoint={sliderValues.setpoint}
            deviation={sliderValues.deviation}
            disabled={disabled}
            compact
            dense={mobileSplit}
            onChange={onTempChange}
          />
        ) : (
          <ThresholdRangeSlider
            title="환기"
            icon={
              <Fan className={cn("size-4", "text-sky-600")} aria-hidden />
            }
            min={0}
            max={100}
            step={5}
            low={sliderValues.minVent}
            high={sliderValues.maxVent}
            unit="%"
            lowLabel="최저환기"
            highLabel="최고환기"
            accentClass="bg-sky-500/35"
            showAxis
            disabled={disabled}
            compact
            onChange={onVentChange}
          />
        )}
      </div>
    </>
  );

  if (embedded && mobileSplit) {
    return (
      <div className="space-y-3">
        <ControllerTempTripleSlider
          setpoint={sliderValues.setpoint}
          deviation={sliderValues.deviation}
          disabled={disabled}
          compact
          dense
          framed
          title="온도 설정"
          onChange={onTempChange}
        />
        <ThresholdRangeSlider
          title="환기량"
          icon={<Fan className="size-4 text-sky-600" aria-hidden />}
          min={0}
          max={100}
          step={5}
          low={sliderValues.minVent}
          high={sliderValues.maxVent}
          unit="%"
          lowLabel="최저"
          highLabel="최고"
          accentClass="bg-sky-500/35"
          showAxis
          disabled={disabled}
          compact
          onChange={onVentChange}
        />
      </div>
    );
  }

  if (embedded) {
    return <div className="md:hidden">{tabs}</div>;
  }

  return (
    <div className={cn("md:hidden", dashboardUi.section)}>
      <p className={dashboardTypography.sectionTitle}>알림값</p>
      <div className="mt-3">{tabs}</div>
    </div>
  );
}

export function ControllerPanelFace({
  reading,
  detailLoading = false,
  knownSettings,
  latestCommand,
  canCommand,
  controllerList = [],
  selectedControllerKey,
  onControllerSelect,
  spLabel,
  activeChannel = "A",
  onChannelChange,
  hideControllerList = false,
  alarmThresholdHeader,
  alarmSettingsPanel,
  mobileSplit = false,
}: PanelControlProps) {
  const channelReading = channelBySlot(reading?.channels ?? [], activeChannel);
  const channelEqpmnCode =
    channelReading?.eqpmnCode ?? DEFAULT_CHANNEL_EQPMN[activeChannel];
  const panel = useControllerPanel(
    reading,
    knownSettings,
    canCommand,
    reading?.channels?.length ? activeChannel : undefined,
    reading?.channels?.length ? channelEqpmnCode : undefined
  );
  const { resolveName } = useControllerMeta();
  const showControllerList = useDisplayEnabled("controller.controllerList");
  const showLiveMonitor = useDisplayEnabled("controller.liveMonitor");
  const showSliders = useDisplayEnabled("controller.sliders");
  const mobileTemp = reading
    ? formatTempForDisplay(
        reading.status,
        channelReading?.tempC ?? reading.tempC
      )
    : null;
  const mobileHumidity = reading
    ? formatPctForDisplay(
        reading.status,
        channelReading?.humidityPct ?? reading.humidityPct
      )
    : null;
  const mobileOpPct = formatOperationPctForDisplay(reading);
  const powerOn = reading?.status === "normal" || reading?.status === "caution";
  const controllerOnline = isReadingOnline(reading?.status);
  const controlsDisabled = !reading || !canCommand || panel.pending;
  const showAlarmSettings = Boolean(alarmSettingsPanel);
  const showSettingsValues = showAlarmSettings || showSliders;
  const [mobileSettingsTab, setMobileSettingsTab] = useState<"alarm" | "control">(
    "control"
  );

  const isSaving =
    panel.pending || Boolean(alarmThresholdHeader?.pending);

  const canSaveAlarm =
    showAlarmSettings &&
    Boolean(alarmThresholdHeader) &&
    controllerOnline &&
    !alarmThresholdHeader!.pending &&
    !alarmThresholdHeader!.validationError &&
    alarmThresholdHeader!.scopeReady &&
    alarmThresholdHeader!.hasChanges;

  const canSaveControl =
    showSliders &&
    controllerOnline &&
    !controlsDisabled &&
    (!panel.settingsKnown || panel.hasChanges);

  const unifiedSaveDisabled =
    isSaving ||
    (showAlarmSettings && showSliders
      ? !canSaveAlarm && !canSaveControl
      : showAlarmSettings
        ? !canSaveAlarm
        : !canSaveControl);

  const defaultsDisabled =
    isSaving ||
    Boolean(
      showAlarmSettings &&
        alarmThresholdHeader &&
        (!alarmThresholdHeader.scopeReady || alarmThresholdHeader.pending)
    );

  const handleApplyDefaults = () => {
    if (showSliders) panel.applyDefaults();
    alarmThresholdHeader?.onApplyDefaults();
  };

  const handleSaveAll = () => {
    if (canSaveAlarm) {
      alarmThresholdHeader!.onSave();
    }
    if (canSaveControl) {
      panel.save();
    }
  };

  const actionBtnClass = mobileSplit ? "h-8 min-h-8 px-2.5 text-xs" : undefined;

  const settingsHeaderActions = showSettingsValues ? (
    <div className="flex flex-wrap items-center gap-1.5">
      <PageActionButton
        type="button"
        variant="outline"
        disabled={defaultsDisabled}
        onClick={handleApplyDefaults}
        className={actionBtnClass}
      >
        기본값
      </PageActionButton>
      {showAlarmSettings && alarmThresholdHeader?.scopeHasOverride ? (
        <PageActionButton
          type="button"
          variant="outline"
          disabled={alarmThresholdHeader.pending}
          onClick={alarmThresholdHeader.onClear}
          className={actionBtnClass}
        >
          삭제
        </PageActionButton>
      ) : null}
      <PageActionButton
        type="button"
        variant="primary"
        disabled={unifiedSaveDisabled}
        onClick={handleSaveAll}
        className={actionBtnClass}
      >
        {isSaving ? "적용 중…" : "적용"}
      </PageActionButton>
    </div>
  ) : null;

  const panelBody = (
    <>
      {showControllerList &&
      !hideControllerList &&
      !mobileSplit &&
      controllerList.length > 0 &&
      onControllerSelect ? (
        <div className="mb-3">
          <ControllerListPanel
            embedded
            items={controllerList}
            selectedKey={selectedControllerKey}
            onSelect={onControllerSelect}
            spLabel={spLabel}
          />
        </div>
      ) : !showControllerList || hideControllerList || mobileSplit ? null : (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <ControllerNameLabel
            className="text-base"
            name={
              reading
                ? resolveName(reading.controllerKey, reading.eqpmnNo)
                : null
            }
            label={reading?.label}
            stallNo={reading?.stallNo}
            eqpmnNo={reading?.eqpmnNo}
            controllerKey={reading?.controllerKey}
          />
        </div>
      )}

      {mobileSplit && reading ? (
        <div className="mb-2 flex flex-wrap items-center gap-2 border-b pb-2">
          <StatusBadge tone={reading.status} />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {showSettingsValues ? settingsHeaderActions : null}
          </div>
        </div>
      ) : null}

      <div className={cn(dashboardUi.stack, mobileSplit && "gap-3")}>
        {reading && !mobileSplit && (mobileTemp || mobileOpPct) ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/15 px-3 py-2 lg:hidden">
            {mobileTemp ? (
              <span className="text-sm font-semibold tabular-nums">{mobileTemp}</span>
            ) : null}
            {mobileOpPct ? (
              <span className="text-xs text-muted-foreground">운전 {mobileOpPct}</span>
            ) : null}
            {latestCommand ? (
              <span className="text-xs text-muted-foreground">
                {commandStatusLabel(latestCommand.status)}
              </span>
            ) : null}
          </div>
        ) : null}
        {reading && mobileSplit && (mobileTemp || mobileHumidity || mobileOpPct) ? (
          <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/15 px-2 py-2 text-center">
            <MobileMetricCell label="온도" value={mobileTemp} />
            <MobileMetricCell label="습도" value={mobileHumidity} />
            <MobileMetricCell label="팬출력" value={mobileOpPct} />
          </div>
        ) : null}
        {detailLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className={cn(dashboardUi.iconSm, "animate-spin")} />
            상세 데이터 불러오는 중…
          </p>
        ) : null}
        {reading?.channels?.length ? (
          <ChannelSettingsBar
            reading={reading}
            activeChannel={activeChannel}
            onChannelChange={onChannelChange}
            compact={mobileSplit}
          />
        ) : null}

        {showLiveMonitor && !mobileSplit ? (
          <LiveMonitor reading={reading} powerOn={powerOn} />
        ) : null}

        {showSettingsValues ? (
          mobileSplit ? (
            <div className="space-y-3">
              {showAlarmSettings && showSliders ? (
                <div
                  className="flex gap-1 rounded-lg bg-muted/30 p-1"
                  role="tablist"
                  aria-label="알림 및 제어 설정"
                >
                  <Button
                    type="button"
                    role="tab"
                    aria-selected={mobileSettingsTab === "alarm"}
                    variant={mobileSettingsTab === "alarm" ? "default" : "ghost"}
                    className={cn(
                      "h-8 min-h-8 flex-1 px-3 text-sm",
                      mobileSettingsTab !== "alarm" &&
                        alarmThresholdHeader?.hasChanges &&
                        "border-amber-400/70 text-amber-900 dark:text-amber-100"
                    )}
                    onClick={() => setMobileSettingsTab("alarm")}
                  >
                    알림
                    {alarmThresholdHeader?.hasChanges ? " · Δ" : null}
                  </Button>
                  <Button
                    type="button"
                    role="tab"
                    aria-selected={mobileSettingsTab === "control"}
                    variant={mobileSettingsTab === "control" ? "default" : "ghost"}
                    className={cn(
                      "h-8 min-h-8 flex-1 px-3 text-sm",
                      mobileSettingsTab !== "control" &&
                        panel.hasChanges &&
                        "border-amber-400/70 text-amber-900 dark:text-amber-100"
                    )}
                    onClick={() => setMobileSettingsTab("control")}
                  >
                    제어
                    {panel.hasChanges ? " · Δ" : null}
                  </Button>
                </div>
              ) : null}
              {showAlarmSettings &&
              (!showSliders || mobileSettingsTab === "alarm") ? (
                <div className="rounded-xl border border-border/60 bg-muted/15 p-3">
                  {alarmSettingsPanel}
                </div>
              ) : null}
              {showSliders &&
              (!showAlarmSettings || mobileSettingsTab === "control") ? (
                <div className="rounded-xl border border-border/60 bg-muted/15 p-3">
                  <MobileGroupedSliders
                    embedded
                    mobileSplit={mobileSplit}
                    sliderValues={panel.sliderValues}
                    isFieldChanged={panel.isFieldChanged}
                    disabled={controlsDisabled}
                    onTempChange={panel.setTempControl}
                    onVentChange={panel.setVentRange}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <div className={cn("mb-5", dashboardUi.sectionMuted)}>
              {!mobileSplit ? (
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className={dashboardTypography.sectionTitle}>알림값</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {settingsHeaderActions}
                  </div>
                </div>
              ) : null}
              {showAlarmSettings ? alarmSettingsPanel : null}
              {showSliders ? (
                <>
                  {showAlarmSettings && !mobileSplit ? (
                    <p
                      className={cn(
                        "mt-5 mb-3",
                        dashboardTypography.formLabel
                      )}
                    >
                      컨트롤러 제어값
                    </p>
                  ) : null}
                  {!mobileSplit ? (
                    <DesktopGroupedSliders
                      embedded
                      sliderValues={panel.sliderValues}
                      currentValues={panel.currentValues}
                      isFieldChanged={panel.isFieldChanged}
                      disabled={controlsDisabled}
                      onTempChange={panel.setTempControl}
                      onVentChange={panel.setVentRange}
                    />
                  ) : null}
                  <MobileGroupedSliders
                    embedded
                    mobileSplit={mobileSplit}
                    sliderValues={panel.sliderValues}
                    isFieldChanged={panel.isFieldChanged}
                    disabled={controlsDisabled}
                    onTempChange={panel.setTempControl}
                    onVentChange={panel.setVentRange}
                  />
                </>
              ) : null}
            </div>
          )
        ) : null}
      </div>

      <div className={cn(mobileSplit ? "mt-2 space-y-1 text-center" : "mt-3 space-y-2 text-center", dashboardUi.footer)}>
        <CommandPipelineStatus command={latestCommand} />
        {!panel.settingsKnown && (
          <p className="text-xs text-amber-700 md:text-sm">
            {UNKNOWN_SETTINGS_HINT}
          </p>
        )}
        {!canCommand && (
          <p className="text-xs text-amber-700 md:text-sm">명령 권한이 없어 조작이 제한됩니다.</p>
        )}
        {panel.message && (
          <p
            className={cn(
              "text-xs md:text-sm",
              panel.message.tone === "ok" ? "text-emerald-700" : "text-red-600"
            )}
          >
            {panel.message.text}
          </p>
        )}
      </div>
    </>
  );

  if (mobileSplit) {
    return <div className="min-w-0">{panelBody}</div>;
  }

  return (
    <SectionCard
      size="lg"
      title="컨트롤러 패널"
      action={
        reading ? (
          <StatusBadge tone={reading.status} large />
        ) : (
          <StatusBadge tone="offline" label="--" large />
        )
      }
    >
      {panelBody}
    </SectionCard>
  );
}
