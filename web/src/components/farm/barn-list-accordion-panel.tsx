"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Thermometer } from "lucide-react";
import {
  AlarmThresholdForm,
  type AlarmThresholdHeaderState,
} from "@/components/settings/alarm-threshold-form";
import { ControllerTempDualSlider } from "@/components/controllers/controller-temp-dual-slider";
import { ThresholdRangeSlider } from "@/components/settings/threshold-range-slider";
import { useControllerDetail } from "@/components/controllers/use-controller-detail";
import { useControllerPanel } from "@/components/controllers/use-controller-panel";
import { useCommandPipelineTracker } from "@/components/controllers/use-command-pipeline-tracker";
import { CommandPipelineOverlay } from "@/components/farm/command-pipeline-overlay";
import { useSettingsApplyOverlay } from "@/components/farm/use-settings-apply-overlay";
import { SettingsCollapsibleSection } from "@/components/farm/settings-collapsible-section";
import { useFarmLiveRefreshOptional } from "@/lib/navigation/farm-live-refresh";
import type { BarnReading } from "@/lib/data/iot";
import type { ThermoCommand } from "@/lib/data/commands";
import {
  type ControllerThermoSettings,
  resolveThermoSettings,
  thermoFromDecoded,
} from "@/lib/controllers/controller-settings";
import { resolveReadingThermo } from "@/lib/farm/controller-summary-display";
import { DEFAULT_ALARM_SETTINGS, type AlarmSettings } from "@/lib/data/alarms";
import {
  CHANNEL_SLOT_LABELS,
  channelBySlot,
  DEFAULT_CHANNEL_EQPMN,
  type ChannelSlot,
} from "@/lib/data/iot-channel";
import { farmKeyId } from "@/lib/data/farm-key";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import { stallKeyFromReading } from "@/lib/data/reading-hierarchy";
import { isReadingOnline } from "@/lib/data/reading-display";
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
  const [activeChannel, setActiveChannel] = useState<ChannelSlot>("A");

  const { reading: detail, showLoading, refresh: refreshDetail } =
    useControllerDetail(reading);
  const channels = detail?.channels ?? reading.channels ?? [];
  const hasChannels = channels.length > 0;
  const channelSlots = useMemo(
    () => channels.map((c) => c.channel),
    [channels],
  );

  /** detail 로드·채널 구성 변경 시 가용 슬롯으로 맞춤 */
  useEffect(() => {
    if (!hasChannels) return;
    if (!channelSlots.includes(activeChannel)) {
      setActiveChannel(channelSlots[0] ?? "A");
    }
  }, [hasChannels, channelSlots, activeChannel]);

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

  const liveRefresh = useFarmLiveRefreshOptional();

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

  const registerCommand = useCallback(
    (cmd: ThermoCommand) => {
      liveRefresh?.patchThermoFromCommand(cmd);
      pipeline.registerCommand(cmd);
    },
    [liveRefresh, pipeline.registerCommand],
  );

  const panelTarget = detail ?? reading;

  const panel = useControllerPanel(
    panelTarget,
    knownSettings,
    canCommand,
    hasChannels ? activeChannel : undefined,
    hasChannels ? channelEqpmnCode : undefined,
    registerCommand,
  );

  /** 카드 LIVE 상태 우선 — detail API가 늦거나 offline이면 적용이 잠기지 않게 */
  const online =
    isReadingOnline(reading.status) || isReadingOnline(detail?.status);
  /** settings 미확인이어도 편집은 허용(기본 draft). 저장은 hasChanges 필요 */
  const controlsDisabled = !canCommand || panel.pending;

  const farmId = farmKeyId(reading.farmKey);
  const spCode = normalizeStallTyCode(reading.stallTyCode);
  const stallKey = stallKeyFromReading(reading);
  const effectiveAlarmSettings = alarmSettings ?? DEFAULT_ALARM_SETTINGS;
  const thresholdScope = useMemo(
    () => ({
      farmId,
      spCode,
      stallKey,
      readingKey: reading.key,
    }),
    [farmId, spCode, stallKey, reading.key],
  );

  const isSaving = panel.pending || Boolean(thresholdHeader?.pending);
  const canSaveControl =
    online && canCommand && !panel.pending && panel.hasChanges;
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
    if (!canCommand) return "명령 권한이 없습니다.";
    if (!online) return "오프라인이라 적용할 수 없습니다.";
    if (!panel.settingsKnown && !panel.hasEdited && !canSaveAlarm) {
      return "설정값을 불러오는 중…";
    }
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

  const panelError =
    panel.message?.tone === "error" ? panel.message.text : null;

  const { overlay, dismiss: dismissOverlay } = useSettingsApplyOverlay({
    isSaving,
    command: pipeline.command,
    liveConfirmed: pipeline.liveConfirmed,
    flash: pipeline.flash,
    panelError,
    isCommandOverlayDismissed: pipeline.isCommandOverlayDismissed,
    onAcknowledgeCommandOverlay: pipeline.acknowledgeCommandOverlay,
    isUserInitiatedCommand: pipeline.isUserInitiatedCommand,
  });

  const handleOverlayDismiss = useCallback(() => {
    dismissOverlay();
    pipeline.clearFlash();
  }, [dismissOverlay, pipeline.clearFlash]);

  const toggleSection = (id: SettingsSectionId) => {
    setOpenSection((prev) => (prev === id ? null : id));
  };

  const alarmSummary =
    thresholdHeader?.collapsedSummary ?? "온도 · 습도 알람";
  const controlSummary = formatControlCollapsedSummary(panel.sliderValues);
  const controlTitle = hasChannels
    ? `제어 · ${CHANNEL_SLOT_LABELS[activeChannel]}`
    : "제어";

  const channelPicker =
    hasChannels && channelSlots.length > 1 ? (
      <div
        role="tablist"
        aria-label="제어 채널"
        className="inline-flex overflow-hidden rounded-lg border bg-muted/30"
      >
        {channelSlots.map((slot, index) => {
          const selected = slot === activeChannel;
          return (
            <button
              key={slot}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={isSaving}
              className={cn(
                "inline-flex min-h-8 items-center justify-center px-3 py-1.5 text-xs font-medium transition-colors",
                index > 0 && "border-l border-border",
                selected
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                isSaving && "opacity-50",
              )}
              onClick={() => setActiveChannel(slot)}
            >
              {slot}
            </button>
          );
        })}
      </div>
    ) : null;

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
      {channelPicker}
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
        icon={
          <span
            className="inline-flex size-4 items-center justify-center text-sm font-bold text-sky-600"
            aria-hidden
          >
            %
          </span>
        }
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
        title={controlTitle}
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
      <SectionShell>
        {hasChannels ? (
          <p className={cn("mb-2 font-medium", LIST_SLIDER_TITLE)}>
            {controlTitle}
          </p>
        ) : null}
        {controlBody}
      </SectionShell>
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
      {canCommand && saveDisabled && saveDisabledReason ? (
        <p className="text-right text-xs text-muted-foreground">
          {saveDisabledReason}
        </p>
      ) : null}
      {!canCommand ? (
        <p className="text-xs text-amber-700">명령 권한이 없어 조작이 제한됩니다.</p>
      ) : null}
    </div>
  );

  const overlayNode = (
    <CommandPipelineOverlay
      {...overlay}
      onDismiss={handleOverlayDismiss}
    />
  );

  if (collapsibleSections) {
    return (
      <>
        {overlayNode}
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
      </>
    );
  }

  return (
    <>
      {overlayNode}
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
    </>
  );
}
