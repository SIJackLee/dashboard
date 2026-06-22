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
import { ctrlUi } from "@/lib/ui/controller-page-ui";
import { dashboardTypography, dashboardUi } from "@/lib/ui/dashboard-page-ui";
import {
  isReadingOnline,
  sensorValueForDisplay,
} from "@/lib/data/reading-display";
import { cn } from "@/lib/utils";

function operationPct(reading?: ControllerReading): number {
  if (!reading) return 0;
  const vals = [reading.fanSupply, reading.fanExhaust, reading.fanIntake].filter(
    (v): v is number => v != null
  );
  if (vals.length === 0) return 0;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.max(0, Math.min(100, Math.round(avg)));
}

function fmtPct(value: number | null | undefined): string {
  return value != null ? `${Math.round(value)}%` : "--";
}

function fmtTemp(value: number | null | undefined): string {
  return value != null ? `${value.toFixed(1)}℃` : "--";
}

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
};

function ChannelSlotIcon({ slot }: { slot: ChannelSlot }) {
  return (
    <span className="text-3xl font-bold font-mono leading-none">{slot}</span>
  );
}

function ChannelSettingsBar({
  reading,
  activeChannel,
  onChannelChange,
}: {
  reading?: ControllerReading;
  activeChannel: ChannelSlot;
  onChannelChange?: (channel: ChannelSlot) => void;
}) {
  const slots: ChannelSlot[] = ["A", "B", "C"];
  const channels = reading?.channels ?? [];

  return (
    <div className={cn(ctrlUi.sectionMuted, "mb-3")}>
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-2",
            ctrlUi.sectionTitle
          )}
        >
          <Layers className={cn(ctrlUi.iconMd, "text-primary")} aria-hidden />
          채널 설정
        </span>
      </div>
      <div className={cn("mt-3 grid grid-cols-3", ctrlUi.gridGap)}>
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
                ctrlUi.metricTile,
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
                <p className={ctrlUi.label}>{CHANNEL_SLOT_LABELS[slot]}</p>
                <p className={cn("mt-1", ctrlUi.valueLg)}>{equipmentLabel}</p>
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
    <div className={cn(ctrlUi.banner, "text-left", toneClass)}>
      <p className={ctrlUi.bannerTitle}>{commandStatusLabel(command.status)}</p>
      {detail ? (
        <p className={cn("mt-0.5", ctrlUi.label)}>{detail}</p>
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
  value: string;
  icon: ReactNode;
  large?: boolean;
}) {
  return (
    <div className={cn(ctrlUi.metricTile, "flex items-center gap-3 p-4 md:p-5")}>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary",
          large ? "size-14 [&_svg]:size-9" : "size-12 [&_svg]:size-8"
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className={ctrlUi.label}>{label}</p>
        <p className={cn("mt-1 tabular-nums", large ? ctrlUi.valueLg : ctrlUi.value)}>
          {value}
        </p>
      </div>
    </div>
  );
}

function LiveMonitor({
  reading,
  opPct,
  powerOn,
}: {
  reading?: ControllerReading;
  opPct: number;
  powerOn: boolean;
}) {
  const online = isReadingOnline(reading?.status);

  return (
    <div className={ctrlUi.sectionMuted}>
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-2",
            ctrlUi.sectionTitle
          )}
        >
          <Activity className={cn(ctrlUi.iconMd, "text-primary")} aria-hidden />
          LIVE 모니터
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-2 text-2xl font-medium",
            reading && powerOn ? "text-emerald-600" : "text-muted-foreground"
          )}
        >
          <Power className={ctrlUi.iconMd} aria-hidden />
          POWER {reading ? (powerOn ? "ON" : "OFF") : "--"}
        </span>
      </div>

      <div className={cn("mt-3 grid grid-cols-3", ctrlUi.gridGap)}>
        <LiveMetricTile
          label="현재 온도"
          value={fmtTemp(sensorValueForDisplay(reading?.status, reading?.tempC))}
          icon={<Thermometer className="size-full" aria-hidden />}
          large
        />
        <LiveMetricTile
          label="습도"
          value={fmtPct(
            sensorValueForDisplay(reading?.status, reading?.humidityPct)
          )}
          icon={<Droplets className="size-full" aria-hidden />}
          large
        />
        <LiveMetricTile
          label="원동작"
          value={reading && online ? `${opPct}%` : "--"}
          icon={<Activity className="size-full" aria-hidden />}
          large
        />
      </div>

      <div className={cn("mt-3 grid grid-cols-3", ctrlUi.gridGap)}>
        <LiveMetricTile
          label="송풍"
          value={fmtPct(sensorValueForDisplay(reading?.status, reading?.fanSupply))}
          icon={<Wind className="size-full" aria-hidden />}
        />
        <LiveMetricTile
          label="배기"
          value={fmtPct(sensorValueForDisplay(reading?.status, reading?.fanExhaust))}
          icon={<Fan className="size-full" aria-hidden />}
        />
        <LiveMetricTile
          label="입기"
          value={fmtPct(sensorValueForDisplay(reading?.status, reading?.fanIntake))}
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
    <div className={ctrlUi.sliderGrid}>
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
    <div className={cn("hidden md:block", ctrlUi.section)}>
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
  onTempChange,
  onVentChange,
}: {
  sliderValues: Record<PanelMenuId, number>;
  isFieldChanged: (menu: PanelMenuId) => boolean;
  disabled?: boolean;
  embedded?: boolean;
  onTempChange: (setpoint: number, deviation: number) => void;
  onVentChange: (minVent: number, maxVent: number) => void;
}) {
  const [group, setGroup] = useState<SliderGroupId>("temp");
  const tempChanged =
    isFieldChanged("setpoint") || isFieldChanged("deviation");
  const ventChanged =
    isFieldChanged("minVent") || isFieldChanged("maxVent");

  const tabs = (
    <>
      <div className={cn("flex flex-wrap", ctrlUi.chipStripGap)}>
        <Button
          type="button"
          variant={group === "temp" ? "default" : "outline"}
          disabled={disabled}
          onClick={() => setGroup("temp")}
          className={cn(
            ctrlUi.btnMenuTab,
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
            ctrlUi.btnMenuTab,
            ventChanged &&
              group !== "vent" &&
              "border-amber-400/70 text-amber-900 dark:text-amber-100"
          )}
        >
          환기
          {ventChanged ? " · Δ" : null}
        </Button>
      </div>

      <div className={cn("mt-3", ctrlUi.swipePanel)}>
        {group === "temp" ? (
          <ControllerTempTripleSlider
            setpoint={sliderValues.setpoint}
            deviation={sliderValues.deviation}
            disabled={disabled}
            compact
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

  if (embedded) {
    return <div className="md:hidden">{tabs}</div>;
  }

  return (
    <div className={cn("md:hidden", ctrlUi.section)}>
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
  const opPct = operationPct(reading);
  const powerOn = reading?.status === "normal" || reading?.status === "caution";
  const controlsDisabled = !reading || !canCommand || panel.pending;
  const showAlarmSettings = Boolean(alarmSettingsPanel);
  const showSettingsValues = showAlarmSettings || showSliders;

  const isSaving =
    panel.pending || Boolean(alarmThresholdHeader?.pending);

  const canSaveAlarm =
    showAlarmSettings &&
    Boolean(alarmThresholdHeader) &&
    !alarmThresholdHeader!.pending &&
    !alarmThresholdHeader!.validationError &&
    alarmThresholdHeader!.scopeReady &&
    alarmThresholdHeader!.hasChanges;

  const canSaveControl =
    showSliders &&
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

  const settingsHeaderActions = showSettingsValues ? (
    <div className="flex flex-wrap items-center gap-2">
      <PageActionButton
        type="button"
        variant="outline"
        disabled={defaultsDisabled}
        onClick={handleApplyDefaults}
      >
        기본값
      </PageActionButton>
      {showAlarmSettings && alarmThresholdHeader?.scopeHasOverride ? (
        <PageActionButton
          type="button"
          variant="outline"
          disabled={alarmThresholdHeader.pending}
          onClick={alarmThresholdHeader.onClear}
        >
          삭제
        </PageActionButton>
      ) : null}
      <PageActionButton
        type="button"
        variant="primary"
        disabled={unifiedSaveDisabled}
        onClick={handleSaveAll}
      >
        {isSaving ? "저장 중…" : "저장"}
      </PageActionButton>
    </div>
  ) : null;

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
      {showControllerList &&
      !hideControllerList &&
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
      ) : !showControllerList || hideControllerList ? null : (
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

      <div className={ctrlUi.stack}>
        {detailLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className={cn(ctrlUi.iconSm, "animate-spin")} />
            상세 데이터 불러오는 중…
          </p>
        ) : null}
        {reading?.channels?.length ? (
          <ChannelSettingsBar
            reading={reading}
            activeChannel={activeChannel}
            onChannelChange={onChannelChange}
          />
        ) : null}

        {showLiveMonitor ? (
          <LiveMonitor
            reading={reading}
            opPct={opPct}
            powerOn={powerOn}
          />
        ) : null}

        {showSettingsValues ? (
          <div className={cn("mb-5", dashboardUi.sectionMuted)}>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className={dashboardTypography.sectionTitle}>알림값</p>
              <div className="flex flex-wrap items-center gap-2">
                {settingsHeaderActions}
              </div>
            </div>
            {showAlarmSettings ? alarmSettingsPanel : null}
            {showSliders ? (
              <>
                {showAlarmSettings ? (
                  <p
                    className={cn(
                      "mt-5 mb-3",
                      dashboardTypography.formLabel
                    )}
                  >
                    컨트롤러 제어값
                  </p>
                ) : null}
                <DesktopGroupedSliders
                  embedded
                  sliderValues={panel.sliderValues}
                  currentValues={panel.currentValues}
                  isFieldChanged={panel.isFieldChanged}
                  disabled={controlsDisabled}
                  onTempChange={panel.setTempControl}
                  onVentChange={panel.setVentRange}
                />
                <MobileGroupedSliders
                  embedded
                  sliderValues={panel.sliderValues}
                  isFieldChanged={panel.isFieldChanged}
                  disabled={controlsDisabled}
                  onTempChange={panel.setTempControl}
                  onVentChange={panel.setVentRange}
                />
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={cn("mt-3 space-y-2 text-center", ctrlUi.footer)}>
        <CommandPipelineStatus command={latestCommand} />
        {!panel.settingsKnown && (
          <p className="text-amber-700">
            {UNKNOWN_SETTINGS_HINT}
          </p>
        )}
        {!canCommand && (
          <p className="text-amber-700">명령 권한이 없어 조작이 제한됩니다.</p>
        )}
        {panel.message && (
          <p
            className={
              panel.message.tone === "ok" ? "text-emerald-700" : "text-red-600"
            }
          >
            {panel.message.text}
          </p>
        )}
      </div>
    </SectionCard>
  );
}
