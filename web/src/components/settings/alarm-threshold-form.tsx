"use client";

import { useMemo, useState, useTransition } from "react";
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
  notice?: { tone: "ok" | "error"; text: string } | null;
};

const fields: { key: keyof AlarmThresholds; label: string; unit: string }[] = [
  { key: "tempHigh", label: "온도 상한", unit: "℃" },
  { key: "tempLow", label: "온도 하한", unit: "℃" },
  { key: "humidityHigh", label: "습도 상한", unit: "%" },
  { key: "humidityLow", label: "습도 하한", unit: "%" },
];

function ThresholdGrid({
  values,
  onChange,
}: {
  values: AlarmThresholds;
  onChange: (next: AlarmThresholds) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.key} className="space-y-1.5 rounded-lg border p-4">
          <Label className={dashboardUi.tableMeta}>
            {f.label} ({f.unit})
          </Label>
          <Input
            type="number"
            step={f.unit === "℃" ? 0.5 : 1}
            className="h-11 text-xl"
            value={values[f.key]}
            onChange={(e) =>
              onChange({
                ...values,
                [f.key]: Number(e.target.value),
              })
            }
          />
        </div>
      ))}
    </div>
  );
}

function formatThresholdSummary(t: AlarmThresholds) {
  return `온도 ${t.tempLow}~${t.tempHigh}℃ · 습도 ${t.humidityLow}~${t.humidityHigh}%`;
}

export function AlarmThresholdForm({
  initialSettings,
  stallCatalog,
  readings,
  notice,
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

  const previewCount = useMemo(
    () => deriveAlarmsFromReadings(readings, settings).length,
    [readings, settings]
  );

  const overrideSpList = Object.keys(settings.byStallTyCode);

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
    <form onSubmit={handleSubmit}>
      <input type="hidden" name="settings_json" value={JSON.stringify(settings)} />
      <SectionCard
        title="알람 임계값"
        description="온·습도 임계값 초과 및 통신 두절 시 알람 페이지·TopBar 알림에 표시됩니다."
        action={
          <PageActionButton type="submit" variant="primary" disabled={pending || !!validationError}>
            {pending ? "저장 중…" : "저장"}
          </PageActionButton>
        }
      >
        {notice ? (
          <p
            className={cn(
              "mb-4 rounded-lg border px-4 py-3",
              dashboardUi.body,
              notice.tone === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            )}
          >
            {notice.text}
          </p>
        ) : null}

        <div
          className={cn(
            "mb-5 rounded-lg border bg-muted/20 px-4 py-3",
            dashboardUi.body
          )}
        >
          <p className="font-medium">적용 중 기본값</p>
          <p className="mt-1 text-muted-foreground">{formatThresholdSummary(settings.global)}</p>
          {overrideSpList.length > 0 ? (
            <p className="mt-2 text-muted-foreground">
              축사유형별 오버라이드:{" "}
              {overrideSpList.map((c) => formatStallTypeLabel(c)).join(", ")}
            </p>
          ) : null}
          <p className="mt-2 font-medium text-emerald-800">
            현재 LIVE 기준 예상 알람 {previewCount}건
          </p>
        </div>

        {validationError ? (
          <p className={cn("mb-4 text-red-600", dashboardUi.body)}>{validationError}</p>
        ) : null}

        <div className="mb-5 max-w-md space-y-1.5">
          <Label className={dashboardUi.filterLabel}>적용 범위</Label>
          <SimpleSelect
            options={spOptions}
            value={scope}
            onValueChange={(v) => v && setScope(v)}
          />
          <p className={cn("text-muted-foreground", dashboardUi.tableMeta)}>
            {scope === "global"
              ? "모든 축사유형에 기본값으로 적용됩니다."
              : `${formatStallTypeLabel(scope)} 전용 임계값 · 미설정 시 기본값(${formatThresholdSummary(DEFAULT_ALARM_THRESHOLDS)}) 사용`}
          </p>
        </div>

        <ThresholdGrid values={activeThresholds} onChange={updateActive} />

        <p className={cn("mt-4 text-muted-foreground", dashboardUi.tableMeta)}>
          통신 두절 알람은 컨트롤러가 offline일 때 자동 발생합니다.
        </p>
      </SectionCard>
    </form>
  );
}
