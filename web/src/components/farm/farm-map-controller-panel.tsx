"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  Fan,
  Loader2,
  Power,
  Thermometer,
} from "lucide-react";
import {
  AlarmThresholdForm,
  type AlarmThresholdHeaderState,
} from "@/components/settings/alarm-threshold-form";
import { ControllerTempDualSlider } from "@/components/controllers/controller-temp-dual-slider";
import { ThresholdRangeSlider } from "@/components/settings/threshold-range-slider";
import { useControllerDetail } from "@/components/controllers/use-controller-detail";
import { useControllerPanel } from "@/components/controllers/use-controller-panel";
import { useCommandPipelineTracker } from "@/components/controllers/use-command-pipeline-tracker";
import type { ControllerReading } from "@/lib/data/iot";
import type { ThermoCommand } from "@/lib/data/commands";
import {
  type ControllerThermoSettings,
  commandStatusLabel,
  resolveThermoSettings,
  thermoFromDecoded,
} from "@/lib/controllers/controller-settings";
import { resolveReadingThermo } from "@/lib/farm/controller-summary-display";
import type { AlarmSettings } from "@/lib/data/alarms";
import {
  channelBySlot,
  DEFAULT_CHANNEL_EQPMN,
  formatChannelEquipmentLabel,
  type ChannelSlot,
} from "@/lib/data/iot-channel";
import { farmKeyId } from "@/lib/data/farm-key";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import { stallKeyFromReading } from "@/lib/data/reading-hierarchy";
import {
  formatPctForDisplay,
  formatTempForDisplay,
  isReadingOnline,
} from "@/lib/data/reading-display";
import { pipelineDetailMessage } from "@/lib/ui/controller-labels";
import { cn } from "@/lib/utils";
import { InlineStatusToast } from "@/components/common/inline-status-toast";

/** 그리드 in-grid 컨트롤러 패널 구동용 데이터 번들 (서버 → 그래프 스테이지). */
export type ControllerGridData = {
  readings: ControllerReading[];
  thermoSettings: Record<string, ControllerThermoSettings>;
  commands: ThermoCommand[];
  canCommand: boolean;
  alarmSettings?: AlarmSettings;
};

type Props = {
  /** 선택된 stall 의 컨트롤러 (목록 reading — detail 은 클라이언트에서 보강) */
  reading: ControllerReading;
  /** 알람 폼 scope 해석용 전체 readings */
  readings: ControllerReading[];
  thermoSettings: Record<string, ControllerThermoSettings>;
  commands: ThermoCommand[];
  canCommand: boolean;
  alarmSettings?: AlarmSettings;
  /** 헤더 표기 (예: SP01-01) */
  label: string;
  onBack: () => void;
};

function StatusBanner({
  command,
  liveConfirmed,
  flash,
}: {
  command: ThermoCommand | null;
  liveConfirmed: boolean;
  flash: { tone: "ok" | "info" | "error"; text: string } | null;
}) {
  if (!command && !flash) return null;
  const tone = !command
    ? flash?.tone === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : flash?.tone === "ok"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-border bg-muted/40 text-muted-foreground"
    : command.status === "applied" || liveConfirmed
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : command.status === "sent"
        ? "border-sky-200 bg-sky-50 text-sky-800"
        : command.status === "pending"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : command.status === "failed"
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-border bg-muted/40 text-muted-foreground";
  const detail = command
    ? pipelineDetailMessage(command.status, command.errorMsg)
    : null;
  return (
    <div className={cn("space-y-1.5 rounded-md border px-3 py-1.5 text-left", tone)}>
      {command ? (
        <>
          <p className="text-sm font-medium">
            {liveConfirmed
              ? "현장 반영 확인"
              : commandStatusLabel(command.status)}
            <span className="ml-1.5 text-xs font-normal tabular-nums opacity-80">
              설정 {command.setpointTemp}℃
            </span>
          </p>
          {liveConfirmed ? (
            <p className="text-xs leading-snug">
              LIVE 설정값이 명령과 일치합니다. 장치에 반영된 것으로 확인됩니다.
            </p>
          ) : detail ? (
            <p className="text-xs leading-snug">{detail}</p>
          ) : null}
        </>
      ) : null}
      {flash && (!command || flash.text !== detail) ? (
        <p
          className={cn(
            "text-xs leading-snug",
            flash.tone === "error"
              ? "text-red-700"
              : flash.tone === "ok"
                ? "text-emerald-800"
                : "text-muted-foreground"
          )}
        >
          {flash.text}
        </p>
      ) : null}
    </div>
  );
}

function MetricCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | null;
  accent?: boolean;
}) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-2xl font-semibold leading-tight tabular-nums",
          accent && "text-primary"
        )}
      >
        {value ?? "--"}
      </p>
    </div>
  );
}

export function FarmMapControllerPanel({
  reading,
  readings,
  thermoSettings,
  commands,
  canCommand,
  alarmSettings,
  label,
  onBack,
}: Props) {
  const [activeChannel, setActiveChannel] = useState<ChannelSlot>("A");
  const [thresholdHeader, setThresholdHeader] =
    useState<AlarmThresholdHeaderState | null>(null);
  const [activeKey, setActiveKey] = useState<string>(reading.key);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const stallControllers = useMemo(() => {
    const targetFarm = farmKeyId(reading.farmKey);
    const targetSp = normalizeStallTyCode(reading.stallTyCode);
    const targetStall = reading.stallNo ?? "";
    return readings
      .filter(
        (r) =>
          farmKeyId(r.farmKey) === targetFarm &&
          normalizeStallTyCode(r.stallTyCode) === targetSp &&
          (r.stallNo ?? "") === targetStall
      )
      .sort((a, b) =>
        (a.eqpmnNo ?? "").localeCompare(b.eqpmnNo ?? "", "ko", {
          numeric: true,
        })
      );
  }, [readings, reading.farmKey, reading.stallTyCode, reading.stallNo]);

  const activeReading =
    stallControllers.find((r) => r.key === activeKey) ?? reading;
  const hasSwitcher = stallControllers.length > 1;

  const { reading: detail, showLoading, refresh: refreshDetail } =
    useControllerDetail(activeReading);
  const channels = detail?.channels ?? [];
  const hasChannels = channels.length > 0;
  const channelReading = channelBySlot(channels, activeChannel);
  const channelEqpmnCode =
    channelReading?.eqpmnCode ?? DEFAULT_CHANNEL_EQPMN[activeChannel];

  const knownSettings = useMemo(() => {
    const fromMap = resolveThermoSettings(
      thermoSettings,
      detail?.farmKey,
      detail?.moduleUid,
      detail?.controllerKey,
      hasChannels ? activeChannel : undefined
    );
    if (fromMap) return fromMap;
    return resolveReadingThermo(detail ?? reading, thermoSettings);
  }, [
    thermoSettings,
    detail,
    reading,
    detail?.farmKey,
    detail?.moduleUid,
    detail?.controllerKey,
    hasChannels,
    activeChannel,
  ]);

  const liveThermo = useMemo(() => {
    const raw = hasChannels
      ? channelReading?.thermo
      : (detail?.thermo ?? reading.thermo);
    return thermoFromDecoded(raw);
  }, [hasChannels, channelReading?.thermo, detail?.thermo, reading.thermo]);

  const onRefreshLive = useCallback(() => {
    refreshDetail();
  }, [refreshDetail]);

  const pipeline = useCommandPipelineTracker({
    commands,
    farmKey: detail?.farmKey ?? activeReading.farmKey,
    moduleUid: detail?.moduleUid ?? activeReading.moduleUid,
    controllerKey: detail?.controllerKey ?? activeReading.controllerKey,
    hasChannels,
    activeChannel: hasChannels ? activeChannel : undefined,
    knownSettings,
    liveThermo,
    onRefreshLive,
  });

  const panelTarget = detail ?? activeReading;

  const panel = useControllerPanel(
    panelTarget,
    knownSettings,
    canCommand,
    hasChannels ? activeChannel : undefined,
    hasChannels ? channelEqpmnCode : undefined,
    pipeline.registerCommand
  );

  const online = isReadingOnline(detail?.status ?? activeReading.status);
  const powerOn = detail?.status === "normal" || detail?.status === "caution";
  const controlsDisabled =
    !canCommand || panel.pending || !panel.settingsKnown;

  const farmId = farmKeyId(activeReading.farmKey);
  const spCode = normalizeStallTyCode(activeReading.stallTyCode);
  const stallKey = stallKeyFromReading(activeReading);
  const thresholdScope = alarmSettings
    ? { farmId, spCode, stallKey, readingKey: activeReading.key }
    : null;

  const tempC = formatTempForDisplay(
    detail?.status,
    channelReading?.tempC ?? detail?.tempC
  );
  const humidity = formatPctForDisplay(
    detail?.status,
    channelReading?.humidityPct ?? detail?.humidityPct
  );

  const isSaving = panel.pending || Boolean(thresholdHeader?.pending);
  const canSaveControl =
    online && !controlsDisabled && (!panel.settingsKnown || panel.hasChanges);
  const canSaveAlarm =
    Boolean(thresholdHeader) &&
    online &&
    !thresholdHeader!.pending &&
    !thresholdHeader!.validationError &&
    thresholdHeader!.scopeReady &&
    thresholdHeader!.hasChanges;
  const saveDisabled = isSaving || (!canSaveControl && !canSaveAlarm);
  const saveDisabledReason = (() => {
    if (isSaving) return "저장 중…";
    if (!panel.settingsKnown) return "설정값을 불러오는 중…";
    if (!canCommand) return "명령 권한이 없습니다.";
    if (!online) return "오프라인이라 적용할 수 없습니다.";
    if (!canSaveControl && !canSaveAlarm) return "변경된 설정이 없습니다.";
    return null;
  })();
  const defaultsDisabled =
    isSaving ||
    Boolean(thresholdHeader && (!thresholdHeader.scopeReady || thresholdHeader.pending));

  const handleSaveAll = () => {
    if (canSaveAlarm) thresholdHeader!.onSave();
    if (canSaveControl) panel.save();
  };
  const handleApplyDefaults = () => {
    panel.applyDefaults();
    thresholdHeader?.onApplyDefaults();
  };

  const slots: ChannelSlot[] = ["A", "B", "C"];

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border bg-card"
      data-audit-region="farm-map-controller"
    >
      <div className="border-b bg-muted/20 px-3 py-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted sm:px-3"
          >
            <ArrowLeft className="size-4 shrink-0" />
            그래프
          </button>
          {hasSwitcher ? (
            <button
              type="button"
              onClick={() => setSwitcherOpen((v) => !v)}
              aria-expanded={switcherOpen}
              className="inline-flex min-w-0 max-w-full items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              <span className="truncate">
                {label} · 컨트롤러 {activeReading.eqpmnNo}
              </span>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 transition-transform",
                  switcherOpen && "rotate-180"
                )}
              />
            </button>
          ) : (
            <span className="min-w-0 truncate rounded bg-emerald-50 px-2 py-0.5 text-sm font-semibold text-emerald-700">
              {label}
            </span>
          )}
          <span
            className={cn(
              "ml-auto inline-flex shrink-0 items-center gap-1 text-sm font-medium",
              online && powerOn ? "text-emerald-600" : "text-muted-foreground"
            )}
          >
            <Power className="size-4" />
            {detail ? (powerOn ? "ON" : "OFF") : "--"}
          </span>
        </div>

        {hasSwitcher && switcherOpen ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {stallControllers.map((r, i) => {
              const active = r.key === activeReading.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => {
                    setActiveKey(r.key);
                    setSwitcherOpen(false);
                  }}
                  aria-pressed={active}
                  className={cn(
                    "rounded-md border px-3 py-1 text-sm transition-colors",
                    active
                      ? "border-primary/50 bg-primary/10 font-medium text-primary"
                      : "border-border/70 hover:bg-muted"
                  )}
                >
                  컨트롤러 {r.eqpmnNo ?? i + 1}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2 border-b px-3 py-2">
        <div className="grid flex-1 grid-cols-2 gap-2">
          <MetricCell label="온도" value={tempC} accent />
          <MetricCell label="습도" value={humidity} />
        </div>
        {hasChannels ? (
          <div className="flex items-center gap-1">
            {slots.map((slot) => {
              const ch = channelBySlot(channels, slot);
              const active = slot === activeChannel;
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setActiveChannel(slot)}
                  aria-pressed={active}
                  title={formatChannelEquipmentLabel(slot, ch?.eqpmnCode)}
                  className={cn(
                    "size-9 rounded-md border text-sm font-bold transition-colors",
                    active
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border/70 bg-muted/15 hover:bg-muted/30"
                  )}
                >
                  {slot}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {showLoading ? (
          <p className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            상세 데이터 불러오는 중…
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <section className="rounded-lg border bg-background p-3">
            <p className="mb-2.5 border-b pb-1.5 text-sm font-semibold text-muted-foreground">
              설정값
            </p>
            <div className="space-y-4">
              <div className="rounded-lg border bg-background p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Thermometer className="size-5 text-orange-600" aria-hidden />
                  <p className="text-base font-medium">설정온도 · 편차</p>
                  {panel.currentValues ? (
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                      현재 {panel.currentValues.setpoint}℃ +
                      {panel.currentValues.deviation}℃
                    </span>
                  ) : null}
                </div>
                <ControllerTempDualSlider
                  setpoint={panel.sliderValues.setpoint}
                  deviation={panel.sliderValues.deviation}
                  disabled={controlsDisabled}
                  axisMode="editable"
                  axisInputSize="dashboard"
                  onChange={panel.setTempControl}
                />
              </div>
              <ThresholdRangeSlider
                title="환기"
                icon={<Fan className="size-5 text-sky-600" aria-hidden />}
                min={0}
                max={100}
                step={5}
                low={panel.sliderValues.minVent}
                high={panel.sliderValues.maxVent}
                unit="%"
                lowLabel="최저환기"
                highLabel="최고환기"
                accentClass="bg-sky-500/35"
                axisMode="editable"
                axisInputSize="dashboard"
                disabled={controlsDisabled}
                onChange={panel.setVentRange}
              />
            </div>
          </section>

          <section className="rounded-lg border bg-background p-3">
            <p className="mb-2.5 border-b pb-1.5 text-sm font-semibold text-muted-foreground">
              알람값
            </p>
            {thresholdScope && alarmSettings ? (
              <AlarmThresholdForm
                key={`${activeReading.key}-${activeChannel}`}
                initialSettings={alarmSettings}
                readings={readings}
                fixedScope={thresholdScope}
                embedded
                density="mobileSplit"
                onHeaderState={setThresholdHeader}
              />
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                알람 설정을 불러올 수 없습니다.
              </p>
            )}
          </section>
        </div>
      </div>

      <div className="space-y-2 border-t px-3 py-2.5">
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={defaultsDisabled}
              onClick={handleApplyDefaults}
              className="inline-flex items-center rounded-md border px-4 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
            >
              기본값
            </button>
            <button
              type="button"
              disabled={saveDisabled}
              onClick={handleSaveAll}
              title={saveDisabledReason ?? undefined}
              className="inline-flex items-center rounded-md bg-emerald-600 px-5 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSaving ? "적용 중…" : "적용"}
            </button>
          </div>
          {saveDisabled && saveDisabledReason ? (
            <p className="text-xs text-muted-foreground">{saveDisabledReason}</p>
          ) : null}
        </div>
        <StatusBanner
          command={pipeline.command}
          liveConfirmed={pipeline.liveConfirmed}
          flash={pipeline.flash}
        />
        {!canCommand ? (
          <p className="text-xs text-amber-700">
            명령 권한이 없어 조작이 제한됩니다.
          </p>
        ) : null}
        {panel.message ? (
          <p
            className={cn(
              "text-xs",
              panel.message.tone === "ok" ? "text-emerald-700" : "text-red-600"
            )}
          >
            {panel.message.text}
          </p>
        ) : null}
      </div>
      <InlineStatusToast
        message={pipeline.flash?.text ?? null}
        onDismiss={pipeline.clearFlash}
        durationMs={4500}
      />
    </div>
  );
}
