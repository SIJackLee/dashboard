"use client";

import { useMemo, useState } from "react";
import { Fan, Loader2 } from "lucide-react";
import {
  AlarmThresholdForm,
  type AlarmThresholdHeaderState,
} from "@/components/settings/alarm-threshold-form";
import { ControllerTempDualSlider } from "@/components/controllers/controller-temp-dual-slider";
import { ThresholdRangeSlider } from "@/components/settings/threshold-range-slider";
import { useControllerDetail } from "@/components/controllers/use-controller-detail";
import { useControllerPanel } from "@/components/controllers/use-controller-panel";
import type { BarnReading } from "@/lib/data/iot";
import {
  type ControllerThermoSettings,
  resolveThermoSettings,
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
import { cn } from "@/lib/utils";

/** 목록 카드 설정 패널 — 그래프 패널 차트 라벨과 동일 스케일 */
const LIST_PANEL_LABEL = "text-xs font-semibold text-muted-foreground";
const LIST_PANEL_META = "text-xs tabular-nums text-muted-foreground";
const LIST_SLIDER_TITLE = "text-xs font-semibold";
const LIST_SLIDER_THUMB = "text-xs tabular-nums";
const LIST_SLIDER_AXIS = "text-[10px] leading-snug text-muted-foreground";

type Props = {
  reading: BarnReading;
  readings: BarnReading[];
  thermoSettings: Record<string, ControllerThermoSettings>;
  alarmSettings?: AlarmSettings;
  canCommand: boolean;
};

function SectionShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-background p-3">
      <p
        className={cn(
          "mb-2.5 border-b pb-1.5",
          LIST_PANEL_LABEL
        )}
      >
        {title}
      </p>
      {children}
    </section>
  );
}

export function BarnListAccordionPanel({
  reading,
  readings,
  thermoSettings,
  alarmSettings,
  canCommand,
}: Props) {
  const [thresholdHeader, setThresholdHeader] =
    useState<AlarmThresholdHeaderState | null>(null);
  const [activeChannel] = useState<ChannelSlot>("A");

  const { reading: detail, showLoading } = useControllerDetail(reading);
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

  const panel = useControllerPanel(
    detail,
    knownSettings,
    canCommand,
    hasChannels ? activeChannel : undefined,
    hasChannels ? channelEqpmnCode : undefined
  );

  const online = isReadingOnline(detail?.status);
  const controlsDisabled = !detail || !canCommand || panel.pending;

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

      <div className="barn-list-panel-stagger--settings flex flex-col gap-3">
        <SectionShell title="① 알람 허용 · 온도·습도">
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
        </SectionShell>

        <SectionShell title="② 설정온도 · ③ 편차 · 환기">
          <div className="space-y-3">
            <div>
              {panel.currentValues ? (
                <p className={cn("mb-2 text-right", LIST_PANEL_META)}>
                  현재 {panel.currentValues.setpoint}℃ +{panel.currentValues.deviation}℃
                </p>
              ) : null}
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
        </SectionShell>
      </div>

      <div className="mt-3 space-y-2 border-t pt-3">
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
            onClick={handleSaveAll}
            className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 sm:text-sm"
          >
            {isSaving ? "적용 중…" : "적용"}
          </button>
        </div>
        {!canCommand ? (
          <p className="text-xs text-amber-700">명령 권한이 없어 조작이 제한됩니다.</p>
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
