"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Fan, Loader2, Power, Thermometer } from "lucide-react";
import {
  AlarmThresholdForm,
  type AlarmThresholdHeaderState,
} from "@/components/settings/alarm-threshold-form";
import { ControllerTempTripleSlider } from "@/components/controllers/controller-temp-triple-slider";
import { ThresholdRangeSlider } from "@/components/settings/threshold-range-slider";
import { useControllerDetail } from "@/components/controllers/use-controller-detail";
import { useControllerPanel } from "@/components/controllers/use-controller-panel";
import { useCommandPipelineRefresh } from "@/components/controllers/use-command-pipeline-refresh";
import type { ControllerReading } from "@/lib/data/iot";
import type { ThermoCommand } from "@/lib/data/commands";
import {
  type ControllerThermoSettings,
  commandStatusLabel,
  resolveThermoSettings,
} from "@/lib/controllers/controller-settings";
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

function StatusBanner({ command }: { command: ThermoCommand | null }) {
  useCommandPipelineRefresh(command?.status, command?.id);
  if (!command) return null;
  const tone =
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
    <div className={cn("rounded-md border px-3 py-1.5 text-left", tone)}>
      <p className="text-sm font-medium">{commandStatusLabel(command.status)}</p>
      {detail ? <p className="text-xs leading-snug">{detail}</p> : null}
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

  const { reading: detail, loading } = useControllerDetail(reading);
  const channels = detail?.channels ?? [];
  const hasChannels = channels.length > 0;
  const channelReading = channelBySlot(channels, activeChannel);
  const channelEqpmnCode =
    channelReading?.eqpmnCode ?? DEFAULT_CHANNEL_EQPMN[activeChannel];

  const knownSettings = useMemo(
    () =>
      resolveThermoSettings(
        thermoSettings,
        detail?.farmKey,
        detail?.moduleUid,
        detail?.controllerKey,
        hasChannels ? activeChannel : undefined
      ),
    [
      thermoSettings,
      detail?.farmKey,
      detail?.moduleUid,
      detail?.controllerKey,
      hasChannels,
      activeChannel,
    ]
  );

  const panel = useControllerPanel(
    detail,
    knownSettings,
    canCommand,
    hasChannels ? activeChannel : undefined,
    hasChannels ? channelEqpmnCode : undefined
  );

  const latestCommand = useMemo(() => {
    if (!detail) return null;
    return (
      commands.find(
        (c) =>
          farmKeyId(c.farmKey) === farmKeyId(detail.farmKey) &&
          c.moduleUid === detail.moduleUid &&
          c.controllerKey === detail.controllerKey &&
          (hasChannels ? c.channel === activeChannel : !c.channel)
      ) ?? null
    );
  }, [commands, detail, hasChannels, activeChannel]);

  const online = isReadingOnline(detail?.status);
  const powerOn = detail?.status === "normal" || detail?.status === "caution";
  const controlsDisabled = !detail || !canCommand || panel.pending;

  const farmId = farmKeyId(reading.farmKey);
  const spCode = normalizeStallTyCode(reading.stallTyCode);
  const stallKey = stallKeyFromReading(reading);
  const thresholdScope = alarmSettings
    ? { farmId, spCode, stallKey, readingKey: reading.key }
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border bg-card">
      {/* 헤더 */}
      <div className="flex items-center gap-2 border-b bg-muted/20 px-3 py-2.5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
          그래프
        </button>
        <span className="rounded bg-emerald-50 px-2 py-0.5 text-sm font-semibold text-emerald-700">
          {label}
        </span>
        <span
          className={cn(
            "ml-auto inline-flex items-center gap-1 text-sm font-medium",
            online && powerOn ? "text-emerald-600" : "text-muted-foreground"
          )}
        >
          <Power className="size-4" />
          {detail ? (powerOn ? "ON" : "OFF") : "--"}
        </span>
      </div>

      {/* 상단 고정 — 온/습 + 채널 (단일 출처) */}
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

      {/* 본문 — 모니터·설정값·알람값 한 화면 3열 (탭 없음) */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <p className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            상세 데이터 불러오는 중…
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* 모니터 */}
          <section className="rounded-lg border bg-background p-3">
            <p className="mb-2.5 border-b pb-1.5 text-sm font-semibold text-muted-foreground">
              모니터
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              <MetricCell
                label="송풍"
                value={formatPctForDisplay(detail?.status, detail?.fanSupply)}
                accent
              />
              <MetricCell
                label="배기"
                value={formatPctForDisplay(detail?.status, detail?.fanExhaust)}
              />
              <MetricCell
                label="입기"
                value={formatPctForDisplay(detail?.status, detail?.fanIntake)}
              />
            </div>
            <p className="mt-2.5 text-xs text-muted-foreground">
              온·습도는 상단에 표시됩니다.
            </p>
          </section>

          {/* 설정값 */}
          <section className="rounded-lg border bg-background p-3">
            <p className="mb-2.5 border-b pb-1.5 text-sm font-semibold text-muted-foreground">
              설정값
            </p>
            <div className="space-y-4">
              <div className="rounded-lg border bg-background p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Thermometer className="size-5 text-orange-600" aria-hidden />
                  <p className="text-base font-medium">온도</p>
                  {panel.currentValues ? (
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                      현재 {panel.currentValues.setpoint}℃ ±
                      {panel.currentValues.deviation}℃
                    </span>
                  ) : null}
                </div>
                <ControllerTempTripleSlider
                  setpoint={panel.sliderValues.setpoint}
                  deviation={panel.sliderValues.deviation}
                  disabled={controlsDisabled}
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
                showAxis
                disabled={controlsDisabled}
                onChange={panel.setVentRange}
              />
            </div>
          </section>

          {/* 알람값 */}
          <section className="rounded-lg border bg-background p-3">
            <p className="mb-2.5 border-b pb-1.5 text-sm font-semibold text-muted-foreground">
              알람값
            </p>
            {thresholdScope && alarmSettings ? (
              <AlarmThresholdForm
                key={`${reading.key}-${activeChannel}`}
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

      {/* 액션 + 상태 */}
      <div className="space-y-2 border-t px-3 py-2.5">
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
            className="inline-flex items-center rounded-md bg-emerald-600 px-5 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {isSaving ? "적용 중…" : "적용"}
          </button>
        </div>
        <StatusBanner command={latestCommand} />
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
    </div>
  );
}
