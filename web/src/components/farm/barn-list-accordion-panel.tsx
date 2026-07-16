"use client";

import { useCallback, useMemo, useState } from "react";
import { Fan, Loader2, Thermometer } from "lucide-react";
import {
  AlarmThresholdForm,
  type AlarmThresholdHeaderState,
} from "@/components/settings/alarm-threshold-form";
import { ControllerTempDualSlider } from "@/components/controllers/controller-temp-dual-slider";
import { ThresholdRangeSlider } from "@/components/settings/threshold-range-slider";
import { useControllerDetail } from "@/components/controllers/use-controller-detail";
import { useControllerPanel } from "@/components/controllers/use-controller-panel";
import { useCommandPipelineTracker } from "@/components/controllers/use-command-pipeline-tracker";
import { SettingsCollapsibleSection } from "@/components/farm/settings-collapsible-section";
import type { BarnReading } from "@/lib/data/iot";
import type { ThermoCommand } from "@/lib/data/commands";
import {
  type ControllerThermoSettings,
  commandStatusLabel,
  resolveThermoSettings,
  thermoFromDecoded,
} from "@/lib/controllers/controller-settings";
import { resolveReadingThermo } from "@/lib/farm/controller-summary-display";
import { DEFAULT_ALARM_SETTINGS, type AlarmSettings } from "@/lib/data/alarms";
import {
  channelBySlot,
  DEFAULT_CHANNEL_EQPMN,
  type ChannelSlot,
} from "@/lib/data/iot-channel";
import { farmKeyId } from "@/lib/data/farm-key";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import { stallKeyFromReading } from "@/lib/data/reading-hierarchy";
import { isReadingOnline } from "@/lib/data/reading-display";
import { pipelineStatusDetail } from "@/lib/ui/controller-labels";
import { cn } from "@/lib/utils";

/** 목록 카드 설정 패널 — 그래프 패널 차트 라벨과 동일 스케일 */
const LIST_PANEL_META = "text-xs tabular-nums text-muted-foreground";
const LIST_SLIDER_TITLE = "text-xs font-semibold";
const LIST_SLIDER_THUMB = "text-xs tabular-nums";
const LIST_SLIDER_AXIS = "text-[11px] leading-snug text-muted-foreground";

type SettingsSectionId = "alarm" | "control";

type Props = {
  reading: BarnReading;
  readings: BarnReading[];
  thermoSettings: Record<string, ControllerThermoSettings>;
  commands?: ThermoCommand[];
  alarmSettings?: AlarmSettings;
  canCommand: boolean;
  /** 모바일 sheet — 섹션 접이식 (PC 목록·그리드는 false) */
  collapsibleSections?: boolean;
};

function SectionShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-background p-3">{children}</section>
  );
}

function formatControlCollapsedSummary(values: {
  setpoint: number;
  deviation: number;
  minVent: number;
  maxVent: number;
}): string {
  return `${values.setpoint}±${values.deviation}℃ · 환기 ${values.minVent}–${values.maxVent}%`;
}

function ListStatusBanner({
  command,
  liveConfirmed,
  flash,
}: {
  command: ThermoCommand | null;
  liveConfirmed: boolean;
  flash: { tone: "ok" | "info" | "error"; text: string } | null;
}) {
  if (!command && !flash) return null;
  const detail = command
    ? pipelineStatusDetail(command.status, command.errorMsg, liveConfirmed)
    : null;
  return (
    <div
      className={cn(
        "rounded-md border px-2.5 py-1.5 text-left",
        liveConfirmed || command?.status === "applied"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : command?.status === "sent"
            ? "border-sky-200 bg-sky-50 text-sky-800"
            : command?.status === "pending"
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : command?.status === "failed" || flash?.tone === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      {command ? (
        <p className="text-xs font-medium">
          {liveConfirmed ? "현장 반영 확인" : commandStatusLabel(command.status)}
          <span className="ml-1 font-normal tabular-nums opacity-80">
            {command.setpointTemp}℃
          </span>
        </p>
      ) : null}
      {liveConfirmed ? (
        <p className="text-[11px] leading-snug">
          LIVE 설정값이 명령과 일치합니다.
        </p>
      ) : detail ? (
        <p className="text-[11px] leading-snug">{detail}</p>
      ) : flash ? (
        <p className="text-[11px] leading-snug">{flash.text}</p>
      ) : null}
    </div>
  );
}

export function BarnListAccordionPanel({
  reading,
  readings,
  thermoSettings,
  commands = [],
  alarmSettings,
  canCommand,
  collapsibleSections = false,
}: Props) {
  const [thresholdHeader, setThresholdHeader] =
    useState<AlarmThresholdHeaderState | null>(null);
  const [openSection, setOpenSection] = useState<SettingsSectionId | null>(
    null,
  );
  const [activeChannel] = useState<ChannelSlot>("A");

  const { reading: detail, showLoading, refresh: refreshDetail } =
    useControllerDetail(reading);
  const channels = detail?.channels ?? [];
  const hasChannels = channels.length > 0;
  const channelEqpmnCode =
    channelBySlot(channels, activeChannel)?.eqpmnCode ??
    DEFAULT_CHANNEL_EQPMN[activeChannel];

  const knownSettings = useMemo(() => {
    const fromMap = resolveThermoSettings(
      thermoSettings,
      detail?.farmKey,
      detail?.moduleUid,
      detail?.controllerKey,
      hasChannels ? activeChannel : undefined,
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
      ? channelBySlot(channels, activeChannel)?.thermo
      : (detail?.thermo ?? reading.thermo);
    return thermoFromDecoded(raw);
  }, [hasChannels, channels, activeChannel, detail?.thermo, reading.thermo]);

  const onRefreshLive = useCallback(() => {
    refreshDetail();
  }, [refreshDetail]);

  const pipeline = useCommandPipelineTracker({
    commands,
    farmKey: detail?.farmKey ?? reading.farmKey,
    moduleUid: detail?.moduleUid ?? reading.moduleUid,
    controllerKey: detail?.controllerKey ?? reading.controllerKey,
    hasChannels,
    activeChannel: hasChannels ? activeChannel : undefined,
    knownSettings,
    liveThermo,
    onRefreshLive,
  });

  const panelTarget = detail ?? reading;

  const panel = useControllerPanel(
    panelTarget,
    knownSettings,
    canCommand,
    hasChannels ? activeChannel : undefined,
    hasChannels ? channelEqpmnCode : undefined,
    pipeline.registerCommand,
  );

  const online = isReadingOnline(detail?.status ?? reading.status);
  const controlsDisabled =
    !canCommand || panel.pending || !panel.settingsKnown;

  const farmId = farmKeyId(reading.farmKey);
  const spCode = normalizeStallTyCode(reading.stallTyCode);
  const stallKey = stallKeyFromReading(reading);
  const effectiveAlarmSettings = alarmSettings ?? DEFAULT_ALARM_SETTINGS;
  const thresholdScope = {
    farmId,
    spCode,
    stallKey,
    readingKey: reading.key,
  };

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

  const toggleSection = (id: SettingsSectionId) => {
    setOpenSection((prev) => (prev === id ? null : id));
  };

  const alarmSummary =
    thresholdHeader?.collapsedSummary ?? "온도 · 습도 알람";
  const controlSummary = formatControlCollapsedSummary(panel.sliderValues);

  const alarmForm = (
    <AlarmThresholdForm
      key={reading.key}
      initialSettings={effectiveAlarmSettings}
      readings={readings}
      fixedScope={thresholdScope}
      embedded
      density="mobileSplit"
      sliderTitleClassName={LIST_SLIDER_TITLE}
      sliderThumbLabelClassName={LIST_SLIDER_THUMB}
      sliderAxisClassName={LIST_SLIDER_AXIS}
      onHeaderState={setThresholdHeader}
    />
  );

  const controlBody = (
    <div className="space-y-3">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Thermometer className="size-4 text-orange-600" aria-hidden />
          <p className={LIST_SLIDER_TITLE}>설정온도 · 편차</p>
          {panel.currentValues ? (
            <span
              className={cn(
                "ml-auto tabular-nums text-muted-foreground",
                LIST_PANEL_META,
              )}
            >
              현재 {panel.currentValues.setpoint}℃ +
              {panel.currentValues.deviation}℃
            </span>
          ) : null}
        </div>
        <ControllerTempDualSlider
          setpoint={panel.sliderValues.setpoint}
          deviation={panel.sliderValues.deviation}
          disabled={controlsDisabled}
          compact
          dense
          axisMode="editable"
          axisInputSize="compact"
          axisClassName={LIST_SLIDER_AXIS}
          thumbLabelClassName={LIST_SLIDER_THUMB}
          onChange={panel.setTempControl}
        />
      </div>
      <ThresholdRangeSlider
        title="환기"
        icon={<Fan className="size-4 text-sky-600" aria-hidden />}
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
        axisInputSize="compact"
        compact
        bare
        titleClassName={LIST_SLIDER_TITLE}
        thumbLabelClassName={LIST_SLIDER_THUMB}
        axisClassName={LIST_SLIDER_AXIS}
        disabled={controlsDisabled}
        onChange={panel.setVentRange}
      />
    </div>
  );

  const settingsSections = collapsibleSections ? (
    <div className="flex flex-col gap-2">
      <SettingsCollapsibleSection
        id="alarm"
        title="알람"
        summary={alarmSummary}
        changed={Boolean(thresholdHeader?.hasChanges)}
        open={openSection === "alarm"}
        onToggle={() => toggleSection("alarm")}
      >
        {alarmForm}
      </SettingsCollapsibleSection>
      <SettingsCollapsibleSection
        id="control"
        title="제어"
        summary={controlSummary}
        changed={panel.hasChanges}
        open={openSection === "control"}
        onToggle={() => toggleSection("control")}
      >
        {controlBody}
      </SettingsCollapsibleSection>
    </div>
  ) : (
    <div className="barn-list-panel-stagger--settings flex flex-col gap-3">
      <SectionShell>{alarmForm}</SectionShell>
      <SectionShell>{controlBody}</SectionShell>
    </div>
  );

  const footer = (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          disabled={defaultsDisabled}
          onClick={handleApplyDefaults}
          className="inline-flex items-center rounded-md border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50 sm:text-sm"
        >
          기본값
        </button>
        <button
          type="button"
          disabled={saveDisabled}
          title={saveDisabledReason ?? undefined}
          onClick={handleSaveAll}
          className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 sm:text-sm"
        >
          {isSaving ? "적용 중…" : "적용"}
        </button>
      </div>
      {saveDisabled && saveDisabledReason ? (
        <p className="text-xs text-muted-foreground">{saveDisabledReason}</p>
      ) : null}
      <ListStatusBanner
        command={pipeline.command}
        liveConfirmed={pipeline.liveConfirmed}
        flash={pipeline.flash}
      />
      {!canCommand ? (
        <p className="text-xs text-amber-700">명령 권한이 없어 조작이 제한됩니다.</p>
      ) : null}
      {panel.message ? (
        <p
          className={cn(
            "text-xs",
            panel.message.tone === "ok" ? "text-emerald-700" : "text-red-600",
          )}
        >
          {panel.message.text}
        </p>
      ) : null}
    </div>
  );

  if (collapsibleSections) {
    return (
      <div
        className="bg-muted/20"
        data-audit-region="barn-list-accordion-panel"
        data-settings-layout="collapsible"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {showLoading ? (
          <p
            className={cn(
              "flex shrink-0 items-center gap-1.5 px-3 py-2",
              LIST_PANEL_META,
            )}
          >
            <Loader2 className="size-3.5 animate-spin" />
            상세 데이터 불러오는 중…
          </p>
        ) : null}
        <div className="space-y-2 px-3 py-2 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
          {settingsSections}
          <div className="space-y-2 border-t pt-3">{footer}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="border-t bg-muted/20 px-3 py-3 sm:px-4"
      data-audit-region="barn-list-accordion-panel"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {showLoading ? (
        <p className={cn("mb-2 flex items-center gap-1.5", LIST_PANEL_META)}>
          <Loader2 className="size-3.5 animate-spin" />
          상세 데이터 불러오는 중…
        </p>
      ) : null}
      {settingsSections}
      <div className="mt-3 space-y-2 border-t pt-3">{footer}</div>
    </div>
  );
}
