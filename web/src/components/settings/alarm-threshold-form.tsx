"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { SectionCard } from "@/components/common/section-card";
import { SimpleSelect } from "@/components/common/filter-bar";
import { Label } from "@/components/ui/label";
import { PageActionButton } from "@/components/common/page-action-button";
import { AlarmDomainIcon } from "@/components/settings/alarm-domain-icon";
import {
  saveAlarmSettingsAction,
  saveAlarmSettingsInlineAction,
} from "@/lib/actions/app-settings-actions";
import type { BarnReading } from "@/lib/data/iot";
import {
  activeScopeKeyFromSelection,
  clearScopeThreshold,
  describeAlarmScope,
  filterReadingsForAlarmScope,
  hasScopeOverride,
  mergeScopeThreshold,
  resolveThresholdsForScope,
} from "@/lib/data/alarm-scope";
import {
  DEFAULT_ALARM_THRESHOLDS,
  validateAlarmThresholds,
  type AlarmSettings,
  type AlarmThresholds,
} from "@/lib/data/alarms";
import { farmKeyId } from "@/lib/data/farm-key";
import { farmShortLabel } from "@/lib/data/farm-summaries";
import {
  filterReadingsByHierarchy,
  stallLabelFromKey,
  uniqueSpCodes,
  uniqueStallKeys,
} from "@/lib/data/reading-hierarchy";
import { formatStallTypeLabel } from "@/lib/data/stall-type";
import { ThresholdRangeSlider } from "@/components/settings/threshold-range-slider";
import {
  ThresholdFieldGroup,
  tempFields,
  humidityFields,
} from "@/components/settings/alarm-threshold-fields";
import { useFarmLiveRefreshOptional } from "@/lib/navigation/farm-live-refresh";
import { dashboardTypography, dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export type AlarmThresholdHeaderState = {
  scopeDescription: string;
  scopeHasOverride: boolean;
  scopeReady: boolean;
  hasChanges: boolean;
  pending: boolean;
  validationError: string | null;
  /** 모바일 접이식 summary — draft 기준 */
  collapsedSummary: string;
  onSave: () => void;
  onApplyDefaults: () => void;
  onClear: () => void;
};

function formatAlarmCollapsedSummary(draft: AlarmThresholds): string {
  return `온도 ${draft.tempLow}–${draft.tempHigh}℃ · 습도 ${draft.humidityLow}–${draft.humidityHigh}%`;
}

type Props = {
  initialSettings: AlarmSettings;
  readings: BarnReading[];
  /** 3열 우측 — 선택 컨트롤러 scope 고정 */
  fixedScope?: {
    farmId: string;
    spCode: string;
    stallKey: string;
    readingKey: string;
  } | null;
  /** SectionCard 없이 필드만 (부모가 제목·카드 제공) */
  embedded?: boolean;
  /** embedded 시 compact(우측 사이드) | default(중앙 패널) */
  density?: "compact" | "default" | "mobileSplit";
  /** embedded + SectionCard 헤더에 저장·scope 상태 위임 */
  onHeaderState?: (state: AlarmThresholdHeaderState | null) => void;
  /** mobileSplit ThresholdRangeSlider typography (목록 카드 등) */
  sliderTitleClassName?: string;
  sliderThumbLabelClassName?: string;
  sliderAxisClassName?: string;
};

const SCOPE_ALL = "__all__";

function uniqueFarmOptions(readings: BarnReading[]) {
  const seen = new Map<string, string>();
  for (const r of readings) {
    const id = farmKeyId(r.farmKey);
    if (!seen.has(id)) seen.set(id, farmShortLabel(r.farmKey));
  }
  return [...seen.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, label]) => ({ value, label }));
}

export function AlarmThresholdForm({
  initialSettings,
  readings,
  fixedScope = null,
  embedded = false,
  density = "compact",
  onHeaderState,
  sliderTitleClassName,
  sliderThumbLabelClassName,
  sliderAxisClassName,
}: Props) {
  const compact = embedded && density === "compact";
  const mobileSplit = embedded && density === "mobileSplit";
  const hideScopeSelectors = embedded && Boolean(fixedScope);
  const externalHeader = embedded && Boolean(onHeaderState);
  const [settings, setSettings] = useState<AlarmSettings>(initialSettings);
  const [draft, setDraft] = useState<AlarmThresholds>(initialSettings.global);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const liveRefresh = useFarmLiveRefreshOptional();

  const farmOptions = useMemo(() => uniqueFarmOptions(readings), [readings]);

  const [farmId, setFarmId] = useState(() => farmOptions[0]?.value ?? "");
  const [spCode, setSpCode] = useState(SCOPE_ALL);
  const [stallKey, setStallKey] = useState(SCOPE_ALL);
  const [controllerReadingKey, setControllerReadingKey] = useState(
    () => fixedScope?.readingKey ?? SCOPE_ALL
  );

  useEffect(() => {
    if (!fixedScope) return;
    // Parent often passes a fresh object each render — depend on primitives
    // and skip setState when values are unchanged to avoid update loops.
    setFarmId((prev) => (prev === fixedScope.farmId ? prev : fixedScope.farmId));
    setSpCode((prev) => (prev === fixedScope.spCode ? prev : fixedScope.spCode));
    setStallKey((prev) =>
      prev === fixedScope.stallKey ? prev : fixedScope.stallKey,
    );
    setControllerReadingKey((prev) =>
      prev === fixedScope.readingKey ? prev : fixedScope.readingKey,
    );
  }, [
    fixedScope?.farmId,
    fixedScope?.spCode,
    fixedScope?.stallKey,
    fixedScope?.readingKey,
  ]);

  const spOptions = useMemo(() => {
    if (!farmId) return [];
    return uniqueSpCodes(readings, farmId).map((code) => ({
      value: code,
      label: formatStallTypeLabel(code),
    }));
  }, [readings, farmId]);

  const stallOptions = useMemo(() => {
    if (!farmId || spCode === SCOPE_ALL) return [];
    const stalls = uniqueStallKeys(readings, farmId, spCode).map((key) => ({
      value: key,
      label: stallLabelFromKey(key),
    }));
    return [{ value: SCOPE_ALL, label: "전체 (축사유형 일괄)" }, ...stalls];
  }, [readings, farmId, spCode]);

  const controllerList = useMemo(() => {
    if (!farmId || spCode === SCOPE_ALL || stallKey === SCOPE_ALL) return [];
    return filterReadingsByHierarchy(readings, farmId, spCode, stallKey);
  }, [readings, farmId, spCode, stallKey]);

  const controllerOptions = useMemo(
    () => [
      { value: SCOPE_ALL, label: "전체 (축사)" },
      ...controllerList.map((r) => ({
        value: r.key,
        label: r.label || r.eqpmnNo || r.controllerKey,
      })),
    ],
    [controllerList]
  );

  const resolvedStallKey = stallKey === SCOPE_ALL ? "" : stallKey;
  const resolvedCtrlKey =
    controllerReadingKey === SCOPE_ALL ? "" : controllerReadingKey;

  const activeScopeKey = useMemo(
    () =>
      activeScopeKeyFromSelection(
        farmId,
        spCode === SCOPE_ALL ? "" : spCode,
        resolvedStallKey,
        resolvedCtrlKey,
        readings
      ),
    [farmId, spCode, resolvedStallKey, resolvedCtrlKey, readings]
  );

  const scopeReady = Boolean(farmId && spCode !== SCOPE_ALL);

  useEffect(() => {
    if (!scopeReady || !activeScopeKey) {
      setDraft(settings.global);
      return;
    }
    setDraft(resolveThresholdsForScope(settings, activeScopeKey));
    setValidationError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scope 전환 시에만 상속값 로드
  }, [activeScopeKey, scopeReady]);

  const scopeReadings = useMemo(
    () =>
      filterReadingsForAlarmScope(
        readings,
        farmId,
        spCode === SCOPE_ALL ? "" : spCode,
        resolvedStallKey,
        resolvedCtrlKey
      ),
    [readings, farmId, spCode, resolvedStallKey, resolvedCtrlKey]
  );

  const scopeHasOverride = hasScopeOverride(settings, activeScopeKey);

  const savedThresholds = useMemo(
    () =>
      scopeReady && activeScopeKey
        ? resolveThresholdsForScope(settings, activeScopeKey)
        : null,
    [settings, activeScopeKey, scopeReady]
  );

  const hasChanges = useMemo(() => {
    if (!savedThresholds) return false;
    return (
      draft.tempHigh !== savedThresholds.tempHigh ||
      draft.tempLow !== savedThresholds.tempLow ||
      draft.humidityHigh !== savedThresholds.humidityHigh ||
      draft.humidityLow !== savedThresholds.humidityLow
    );
  }, [draft, savedThresholds]);

  const scopeDescription = describeAlarmScope(
    farmId,
    spCode === SCOPE_ALL ? "" : spCode,
    resolvedStallKey,
    resolvedCtrlKey,
    readings
  );

  const handleFarmChange = (id: string | null) => {
    if (!id) return;
    setFarmId(id);
    setSpCode(SCOPE_ALL);
    setStallKey(SCOPE_ALL);
    setControllerReadingKey(SCOPE_ALL);
  };

  const handleSpChange = (code: string | null) => {
    if (!code) return;
    setSpCode(code);
    setStallKey(SCOPE_ALL);
    setControllerReadingKey(SCOPE_ALL);
  };

  const handleStallChange = (key: string | null) => {
    if (!key) return;
    setStallKey(key);
    setControllerReadingKey(SCOPE_ALL);
  };

  const updateDraft = (next: AlarmThresholds) => {
    setValidationError(validateAlarmThresholds(next));
    setDraft(next);
  };

  const persistSettings = (
    nextSettings: AlarmSettings,
    rollbackSettings?: AlarmSettings,
  ) => {
    const formData = new FormData();
    formData.set("settings_json", JSON.stringify(nextSettings));

    if (embedded) {
      startTransition(async () => {
        const result = await saveAlarmSettingsInlineAction(formData);
        if (!result.ok) {
          setValidationError(result.error ?? "저장 실패");
          if (rollbackSettings) setSettings(rollbackSettings);
          return;
        }
        setValidationError(null);
        liveRefresh?.patchAlarmSettings(nextSettings);
      });
      return;
    }

    startTransition(() => {
      void saveAlarmSettingsAction(formData);
    });
  };

  const handleSaveScope = () => {
    if (!activeScopeKey) return;
    const err = validateAlarmThresholds(draft);
    if (err) {
      setValidationError(err);
      return;
    }
    const previousSettings = settings;
    const nextSettings = mergeScopeThreshold(settings, activeScopeKey, draft);
    setSettings(nextSettings);
    persistSettings(nextSettings, previousSettings);
  };

  const handleClearScope = () => {
    if (!activeScopeKey) return;
    const previousSettings = settings;
    const nextSettings = clearScopeThreshold(settings, activeScopeKey);
    setSettings(nextSettings);
    setDraft(resolveThresholdsForScope(nextSettings, activeScopeKey));
    persistSettings(nextSettings, previousSettings);
  };

  const handleApplyDefaults = () => {
    updateDraft({ ...DEFAULT_ALARM_THRESHOLDS });
  };

  useEffect(() => {
    if (!onHeaderState) return;
    if (!scopeReady || !activeScopeKey) {
      onHeaderState(null);
      return;
    }
    onHeaderState({
      scopeDescription,
      scopeHasOverride,
      scopeReady,
      hasChanges,
      pending,
      validationError,
      collapsedSummary: formatAlarmCollapsedSummary(draft),
      onSave: handleSaveScope,
      onApplyDefaults: handleApplyDefaults,
      onClear: handleClearScope,
    });
    return () => onHeaderState(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- header action sync
  }, [
    onHeaderState,
    scopeDescription,
    scopeHasOverride,
    scopeReady,
    pending,
    validationError,
    activeScopeKey,
    draft,
    settings,
    hasChanges,
  ]);

  const formBody = (
    <>
      {validationError ? (
        <p
          className={cn(
            "mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700",
            embedded ? dashboardUi.opsSideBody : dashboardUi.body
          )}
        >
          {validationError}
        </p>
      ) : null}

      {!hideScopeSelectors ? (
        <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label size="dashboard">농장</Label>
            <SimpleSelect
              options={farmOptions}
              value={farmId || undefined}
              onValueChange={handleFarmChange}
              triggerClassName="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label size="dashboard">축사유형</Label>
            <SimpleSelect
              placeholder="선택"
              options={spOptions}
              value={spCode === SCOPE_ALL ? undefined : spCode}
              onValueChange={handleSpChange}
              triggerClassName="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label size="dashboard">축사번호</Label>
            <SimpleSelect
              placeholder={spCode === SCOPE_ALL ? "—" : "전체 (축사유형 일괄)"}
              options={stallOptions}
              value={stallOptions.length > 0 ? stallKey : undefined}
              onValueChange={handleStallChange}
              triggerClassName="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label size="dashboard">컨트롤러</Label>
            <SimpleSelect
              placeholder={stallKey === SCOPE_ALL ? "—" : "전체 (축사)"}
              options={controllerOptions}
              value={
                controllerOptions.length > 0 ? controllerReadingKey : undefined
              }
              onValueChange={(v) => v && setControllerReadingKey(v)}
              triggerClassName="w-full"
            />
          </div>
        </div>
      ) : null}

      {scopeReady && !externalHeader ? (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex min-h-[2rem] items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-900",
              dashboardTypography.badge
            )}
          >
            {scopeDescription}
          </span>
          {!hideScopeSelectors && stallKey === SCOPE_ALL ? (
            <span
              className={cn(
                "inline-flex min-h-[2rem] items-center rounded-full border border-emerald-300 bg-emerald-50/80 px-3 py-1 text-emerald-800",
                dashboardTypography.badge
              )}
            >
              축사유형 일괄
            </span>
          ) : null}
          {!hideScopeSelectors ? (
            <span className={cn("text-muted-foreground", dashboardTypography.meta)}>
              {scopeReadings.length}대
            </span>
          ) : null}
          {scopeHasOverride ? (
            <span className={cn("text-amber-700", dashboardTypography.meta)}>
              저장됨
            </span>
          ) : (
            <span className={cn("text-muted-foreground", dashboardTypography.meta)}>
              상위/기본값 상속
            </span>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            <PageActionButton
              type="button"
              variant="outline"
              onClick={handleApplyDefaults}
            >
              기본값
            </PageActionButton>
            {scopeHasOverride ? (
              <PageActionButton
                type="button"
                variant="outline"
                disabled={pending}
                onClick={handleClearScope}
              >
                설정 삭제
              </PageActionButton>
            ) : null}
            {embedded ? (
              <PageActionButton
                type="submit"
                variant="primary"
                disabled={pending || !!validationError || !scopeReady || !hasChanges}
              >
                {pending ? "저장 중…" : "저장"}
              </PageActionButton>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          mobileSplit ? "space-y-3" : "grid gap-4",
          !mobileSplit && "grid-cols-1 lg:grid-cols-2"
        )}
      >
        {mobileSplit ? (
          <>
            <ThresholdRangeSlider
              title="온도 알림"
              icon={<AlarmDomainIcon domain="temp" />}
              min={10}
              max={35}
              step={0.5}
              low={draft.tempLow}
              high={draft.tempHigh}
              unit="℃"
              accentClass="bg-orange-500/35"
              disabled={!scopeReady || pending}
              compact
              titleClassName={sliderTitleClassName}
              thumbLabelClassName={
                sliderThumbLabelClassName ?? "md:text-[1.75rem]"
              }
              axisClassName={sliderAxisClassName}
              axisInputSize={mobileSplit ? "compact" : "dashboard"}
              axisMode={mobileSplit ? "editable" : "hidden"}
              onChange={(low, high) =>
                updateDraft({ ...draft, tempLow: low, tempHigh: high })
              }
            />
            <ThresholdRangeSlider
              title="습도 알림"
              icon={<AlarmDomainIcon domain="humidity" />}
              min={0}
              max={100}
              step={1}
              low={draft.humidityLow}
              high={draft.humidityHigh}
              unit="%"
              accentClass="bg-sky-500/35"
              disabled={!scopeReady || pending}
              compact
              titleClassName={sliderTitleClassName}
              thumbLabelClassName={
                sliderThumbLabelClassName ?? "md:text-[1.75rem]"
              }
              axisClassName={sliderAxisClassName}
              axisInputSize={mobileSplit ? "compact" : "dashboard"}
              axisMode={mobileSplit ? "editable" : "hidden"}
              onChange={(low, high) =>
                updateDraft({ ...draft, humidityLow: low, humidityHigh: high })
              }
            />
          </>
        ) : compact ? (
          <>
            <ThresholdFieldGroup
              title="온도"
              icon={<AlarmDomainIcon domain="temp" />}
              fields={tempFields}
              values={draft}
              onChange={updateDraft}
              disabled={!scopeReady || pending}
              compact
            />
            <ThresholdFieldGroup
              title="습도"
              icon={<AlarmDomainIcon domain="humidity" />}
              fields={humidityFields}
              values={draft}
              onChange={updateDraft}
              disabled={!scopeReady || pending}
              compact
            />
          </>
        ) : (
          <>
            <ThresholdRangeSlider
              title="온도"
              icon={
                <AlarmDomainIcon domain="temp" sizeClass={dashboardUi.iconSm} />
              }
              min={10}
              max={35}
              step={0.5}
              low={draft.tempLow}
              high={draft.tempHigh}
              unit="℃"
              accentClass="bg-orange-500/35"
              disabled={!scopeReady || pending}
              onChange={(tempLow, tempHigh) =>
                updateDraft({ ...draft, tempLow, tempHigh })
              }
            />
            <ThresholdRangeSlider
              title="습도"
              icon={
                <AlarmDomainIcon
                  domain="humidity"
                  sizeClass={dashboardUi.iconSm}
                />
              }
              min={0}
              max={100}
              step={1}
              low={draft.humidityLow}
              high={draft.humidityHigh}
              unit="%"
              accentClass="bg-sky-500/35"
              disabled={!scopeReady || pending}
              onChange={(humidityLow, humidityHigh) =>
                updateDraft({ ...draft, humidityLow, humidityHigh })
              }
            />
          </>
        )}
      </div>
    </>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (scopeReady && activeScopeKey) handleSaveScope();
      }}
    >
      <input type="hidden" name="settings_json" value={JSON.stringify(settings)} />

      {embedded ? (
        formBody
      ) : (
        <SectionCard
          title="알람 임계값"
          action={
            <PageActionButton
              type="submit"
              variant="primary"
              disabled={pending || !!validationError || !scopeReady}
            >
              {pending ? "저장 중…" : "저장"}
            </PageActionButton>
          }
        >
          {formBody}
        </SectionCard>
      )}
    </form>
  );
}
