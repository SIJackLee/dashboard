"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Droplets, RotateCcw, Thermometer } from "lucide-react";
import { SectionCard } from "@/components/common/section-card";
import { SimpleSelect } from "@/components/common/filter-bar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageActionButton } from "@/components/common/page-action-button";
import { saveAlarmSettingsAction } from "@/app/(dashboard)/settings/actions";
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
import { dashboardTypography, dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  initialSettings: AlarmSettings;
  readings: BarnReading[];
};

const SCOPE_ALL = "__all__";

const tempFields: { key: keyof AlarmThresholds; label: string; unit: string }[] = [
  { key: "tempHigh", label: "상한", unit: "℃" },
  { key: "tempLow", label: "하한", unit: "℃" },
];

const humidityFields: { key: keyof AlarmThresholds; label: string; unit: string }[] = [
  { key: "humidityHigh", label: "상한", unit: "%" },
  { key: "humidityLow", label: "하한", unit: "%" },
];

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

function ThresholdFieldGroup({
  title,
  icon,
  fields,
  values,
  onChange,
  disabled,
}: {
  title: string;
  icon: React.ReactNode;
  fields: { key: keyof AlarmThresholds; label: string; unit: string }[];
  values: AlarmThresholds;
  onChange: (next: AlarmThresholds) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-background p-4",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <p className={cn(dashboardTypography.sectionTitle, "text-foreground")}>{title}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {fields.map((f) => (
          <div key={f.key} className="space-y-2">
            <Label size="dashboard">
              {f.label} ({f.unit})
            </Label>
            <Input
              type="number"
              uiSize="dashboard"
              step={f.unit === "℃" ? 0.5 : 1}
              value={values[f.key]}
              disabled={disabled}
              onChange={(e) => {
                const next = Number(e.target.value);
                onChange({
                  ...values,
                  [f.key]: Number.isFinite(next) ? next : values[f.key],
                });
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AlarmThresholdForm({ initialSettings, readings }: Props) {
  const [settings, setSettings] = useState<AlarmSettings>(initialSettings);
  const [draft, setDraft] = useState<AlarmThresholds>(initialSettings.global);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const farmOptions = useMemo(() => uniqueFarmOptions(readings), [readings]);

  const [farmId, setFarmId] = useState(() => farmOptions[0]?.value ?? "");
  const [spCode, setSpCode] = useState(SCOPE_ALL);
  const [stallKey, setStallKey] = useState(SCOPE_ALL);
  const [controllerReadingKey, setControllerReadingKey] = useState(SCOPE_ALL);

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

  const handleSaveScope = () => {
    if (!activeScopeKey) return;
    const err = validateAlarmThresholds(draft);
    if (err) {
      setValidationError(err);
      return;
    }
    const nextSettings = mergeScopeThreshold(settings, activeScopeKey, draft);
    setSettings(nextSettings);
    const formData = new FormData();
    formData.set("settings_json", JSON.stringify(nextSettings));
    startTransition(() => {
      void saveAlarmSettingsAction(formData);
    });
  };

  const handleClearScope = () => {
    if (!activeScopeKey) return;
    const nextSettings = clearScopeThreshold(settings, activeScopeKey);
    setSettings(nextSettings);
    setDraft(resolveThresholdsForScope(nextSettings, activeScopeKey));
    const formData = new FormData();
    formData.set("settings_json", JSON.stringify(nextSettings));
    startTransition(() => {
      void saveAlarmSettingsAction(formData);
    });
  };

  const handleResetDraft = () => {
    if (!activeScopeKey) return;
    updateDraft(resolveThresholdsForScope(settings, activeScopeKey));
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (scopeReady && activeScopeKey) handleSaveScope();
      }}
    >
      <input type="hidden" name="settings_json" value={JSON.stringify(settings)} />

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
        {validationError ? (
          <p
            className={cn(
              "mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700",
              dashboardUi.body
            )}
          >
            {validationError}
          </p>
        ) : null}

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

        {scopeReady ? (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex min-h-[2rem] items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-900",
                dashboardTypography.badge
              )}
            >
              {scopeDescription}
            </span>
            {stallKey === SCOPE_ALL ? (
              <span
                className={cn(
                  "inline-flex min-h-[2rem] items-center rounded-full border border-emerald-300 bg-emerald-50/80 px-3 py-1 text-emerald-800",
                  dashboardTypography.badge
                )}
              >
                축사유형 일괄
              </span>
            ) : null}
            <span className={cn("text-muted-foreground", dashboardTypography.meta)}>
              {scopeReadings.length}대
            </span>
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
                onClick={handleResetDraft}
              >
                <RotateCcw className={dashboardUi.iconSm} />
                값 되돌리기
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
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <ThresholdFieldGroup
            title="온도"
            icon={<Thermometer className={cn(dashboardUi.iconSm, "text-orange-600")} />}
            fields={tempFields}
            values={draft}
            onChange={updateDraft}
            disabled={!scopeReady || pending}
          />
          <ThresholdFieldGroup
            title="습도"
            icon={<Droplets className={cn(dashboardUi.iconSm, "text-sky-600")} />}
            fields={humidityFields}
            values={draft}
            onChange={updateDraft}
            disabled={!scopeReady || pending}
          />
        </div>
      </SectionCard>
    </form>
  );
}
