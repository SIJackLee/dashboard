"use client";

import { useMemo, useState, useTransition } from "react";
import { Droplets, RotateCcw, Thermometer, WifiOff } from "lucide-react";
import { SectionCard } from "@/components/common/section-card";
import { SimpleSelect } from "@/components/common/filter-bar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageActionButton } from "@/components/common/page-action-button";
import { saveAlarmSettingsAction } from "@/app/(dashboard)/settings/actions";
import type { BarnReading } from "@/lib/data/iot";
import {
  deriveAlarmsFromReadings,
  validateAlarmThresholds,
  DEFAULT_ALARM_THRESHOLDS,
  type AlarmSettings,
  type AlarmThresholds,
} from "@/lib/data/alarms";
import type { StallCatalogEntry } from "@/lib/data/stall-catalog";
import { formatStallTypeLabel } from "@/lib/data/stall-type";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  initialSettings: AlarmSettings;
  stallCatalog: StallCatalogEntry[];
  readings: BarnReading[];
};

const tempFields: { key: keyof AlarmThresholds; label: string; unit: string }[] = [
  { key: "tempHigh", label: "온도 상한", unit: "℃" },
  { key: "tempLow", label: "온도 하한", unit: "℃" },
];

const humidityFields: { key: keyof AlarmThresholds; label: string; unit: string }[] = [
  { key: "humidityHigh", label: "습도 상한", unit: "%" },
  { key: "humidityLow", label: "습도 하한", unit: "%" },
];

function formatThresholdSummary(t: AlarmThresholds) {
  return `온도 ${t.tempLow}~${t.tempHigh}℃ · 습도 ${t.humidityLow}~${t.humidityHigh}%`;
}

function ThresholdFieldGroup({
  title,
  icon,
  fields,
  values,
  onChange,
}: {
  title: string;
  icon: React.ReactNode;
  fields: { key: keyof AlarmThresholds; label: string; unit: string }[];
  values: AlarmThresholds;
  onChange: (next: AlarmThresholds) => void;
}) {
  return (
    <div className="rounded-xl border bg-muted/10 p-4">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <p className={cn("font-medium", dashboardUi.body)}>{title}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key} className="space-y-1.5 rounded-lg border bg-background p-4">
            <Label className={dashboardUi.tableMeta}>
              {f.label} ({f.unit})
            </Label>
            <Input
              type="number"
              step={f.unit === "℃" ? 0.5 : 1}
              className="h-11 text-xl"
              value={values[f.key]}
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

export function AlarmThresholdForm({
  initialSettings,
  stallCatalog,
  readings,
}: Props) {
  const [scope, setScope] = useState<string>("global");
  const [settings, setSettings] = useState<AlarmSettings>(initialSettings);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const spOptions = useMemo(
    () => [
      { value: "global", label: "전체 (기본)" },
      ...stallCatalog
        .filter((s): s is typeof s & { stallTyCode: string } => !!s.stallTyCode)
        .map((s) => ({
          value: s.stallTyCode,
          label: formatStallTypeLabel(s.stallTyCode),
        })),
    ],
    [stallCatalog]
  );

  const activeThresholds =
    scope === "global"
      ? settings.global
      : (settings.byStallTyCode[scope] ?? { ...settings.global });

  const previewAlarms = useMemo(
    () => deriveAlarmsFromReadings(readings, settings),
    [readings, settings]
  );

  const previewCount = previewAlarms.length;
  const overrideSpList = Object.keys(settings.byStallTyCode);
  const hasScopeOverride = scope !== "global" && settings.byStallTyCode[scope] != null;

  const updateActive = (next: AlarmThresholds) => {
    setValidationError(validateAlarmThresholds(next));
    if (scope === "global") {
      setSettings((prev) => ({ ...prev, global: next }));
      return;
    }
    setSettings((prev) => ({
      ...prev,
      byStallTyCode: { ...prev.byStallTyCode, [scope]: next },
    }));
  };

  const resetActiveToDefaults = () => {
    if (scope === "global") {
      updateActive({ ...DEFAULT_ALARM_THRESHOLDS });
      return;
    }
    updateActive({ ...settings.global });
  };

  const clearScopeOverride = () => {
    if (scope === "global") return;
    setSettings((prev) => {
      const next = { ...prev.byStallTyCode };
      delete next[scope];
      return { ...prev, byStallTyCode: next };
    });
    setValidationError(null);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const err =
      validateAlarmThresholds(settings.global) ??
      Object.values(settings.byStallTyCode)
        .map(validateAlarmThresholds)
        .find(Boolean) ??
      null;
    if (err) {
      setValidationError(err);
      return;
    }
    const formData = new FormData(e.currentTarget);
    startTransition(() => {
      void saveAlarmSettingsAction(formData);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="settings_json" value={JSON.stringify(settings)} />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={cn(dashboardUi.metricTile, "space-y-1")}>
          <p className={dashboardUi.tableMeta}>기본 임계값</p>
          <p className={cn("font-medium leading-snug", dashboardUi.body)}>
            {formatThresholdSummary(settings.global)}
          </p>
        </div>
        <div className={cn(dashboardUi.metricTile, "space-y-1")}>
          <p className={dashboardUi.tableMeta}>축사유형별 오버라이드</p>
          <p className={cn("font-medium", dashboardUi.body)}>
            {overrideSpList.length > 0
              ? `${overrideSpList.length}개 유형`
              : "없음"}
          </p>
          {overrideSpList.length > 0 ? (
            <p className={cn("truncate text-muted-foreground", dashboardUi.tableMeta)}>
              {overrideSpList.map((c) => formatStallTypeLabel(c)).join(", ")}
            </p>
          ) : null}
        </div>
        <div
          className={cn(
            dashboardUi.metricTile,
            "space-y-1",
            previewCount > 0 && "border-amber-300 bg-amber-50/80"
          )}
        >
          <p className={dashboardUi.tableMeta}>LIVE 예상 알람</p>
          <p
            className={cn(
              "font-semibold tabular-nums",
              dashboardUi.body,
              previewCount > 0 ? "text-amber-800" : "text-emerald-800"
            )}
          >
            {previewCount}건
          </p>
        </div>
      </div>

      <SectionCard
        title="알람 임계값"
        description="온·습도 임계값 초과 및 통신 두절 시 알람 페이지·TopBar 알림에 표시됩니다."
        action={
          <PageActionButton
            type="submit"
            variant="primary"
            disabled={pending || !!validationError}
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

        <div className="mb-5 rounded-xl border bg-muted/15 p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-md space-y-1.5">
              <Label className={dashboardUi.filterLabel}>적용 범위</Label>
              <SimpleSelect
                options={spOptions}
                value={scope}
                onValueChange={(v) => v && setScope(v)}
              />
              <p className={cn("text-muted-foreground", dashboardUi.tableMeta)}>
                {scope === "global"
                  ? "모든 축사유형에 기본값으로 적용됩니다."
                  : `${formatStallTypeLabel(scope)} 전용 · 미설정 시 기본값(${formatThresholdSummary(DEFAULT_ALARM_THRESHOLDS)}) 사용`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <PageActionButton
                type="button"
                variant="outline"
                onClick={resetActiveToDefaults}
              >
                <RotateCcw className={dashboardUi.iconSm} />
                {scope === "global" ? "기본값 복원" : "전역값 복사"}
              </PageActionButton>
              {hasScopeOverride ? (
                <PageActionButton
                  type="button"
                  variant="outline"
                  onClick={clearScopeOverride}
                >
                  오버라이드 삭제
                </PageActionButton>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <ThresholdFieldGroup
            title="온도"
            icon={<Thermometer className={cn(dashboardUi.iconSm, "text-orange-600")} />}
            fields={tempFields}
            values={activeThresholds}
            onChange={updateActive}
          />
          <ThresholdFieldGroup
            title="습도"
            icon={<Droplets className={cn(dashboardUi.iconSm, "text-sky-600")} />}
            fields={humidityFields}
            values={activeThresholds}
            onChange={updateActive}
          />
        </div>

        <div
          className={cn(
            "mt-5 flex items-start gap-3 rounded-xl border bg-muted/15 px-4 py-3",
            dashboardUi.body
          )}
        >
          <WifiOff className={cn(dashboardUi.iconSm, "mt-0.5 shrink-0 text-muted-foreground")} />
          <p className="text-muted-foreground">
            통신 두절 알람은 컨트롤러가 offline일 때 자동 발생합니다. 임계값
            설정과 별도로 적용됩니다.
          </p>
        </div>

        <div className="mt-5 flex justify-end border-t pt-4">
          <PageActionButton
            type="submit"
            variant="primary"
            disabled={pending || !!validationError}
          >
            {pending ? "저장 중…" : "저장"}
          </PageActionButton>
        </div>
      </SectionCard>
    </form>
  );
}
