"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  Fan,
  Loader2,
  SlidersHorizontal,
  Thermometer,
  X,
} from "lucide-react";
import { ControllerTempDualSlider } from "@/components/controllers/controller-temp-dual-slider";
import { ThresholdRangeSlider } from "@/components/settings/threshold-range-slider";
import {
  sendBulkThermoCommandAction,
  type BulkThermoCommand,
  type SendBulkThermoCommandResult,
} from "@/app/(dashboard)/controllers/actions";
import { saveAlarmSettingsInlineAction } from "@/lib/actions/app-settings-actions";
import type { ControllerGridData } from "@/components/farm/farm-map-controller-panel";
import {
  DEFAULT_ALARM_SETTINGS,
  DEFAULT_ALARM_THRESHOLDS,
  validateAlarmThresholds,
  type AlarmSettings,
  type AlarmThresholds,
} from "@/lib/data/alarms";
import { applyBulkSpAlarmThresholds } from "@/lib/data/alarm-scope";
import { resolveThermoSettings } from "@/lib/controllers/controller-settings";
import { EDIT_START_DRAFT } from "@/lib/controllers/controller-panel-map";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import { isReadingOnline } from "@/lib/data/reading-display";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  controller: ControllerGridData;
  /** 일괄적용 모드 on/off */
  bulkMode: boolean;
  /** 선택된 축사유형(SP) 코드 목록 */
  selectedSps: string[];
  /** 모드 진입(토글 on) */
  onEnter: () => void;
  onClearSelection: () => void;
  onExit: () => void;
  /** 적용 완료 후 — toast·soft refresh 등 부모 처리 */
  onAfterApply?: (result: ApplyResult) => void;
};

export type ApplyResult = {
  control: SendBulkThermoCommandResult | null;
  alarm: {
    ok: boolean;
    spCount: number;
    clearedOverrides?: number;
    error?: string;
    settings?: AlarmSettings;
  } | null;
};

/** 일괄설정 모달 — Card 상속 타이포 차단 + 뷰포트별 스케일 */
const bulkModalShell = cn(
  "flex max-h-[min(88dvh,960px)] w-full min-w-0 max-w-[min(100%,44rem)] flex-col overflow-hidden rounded-xl border bg-background shadow-lg",
  "text-sm leading-snug md:text-base md:leading-snug lg:text-[1.75rem] lg:leading-snug"
);
const bulkModalSectionTitle = "font-semibold text-foreground";
const bulkModalMeta = "text-muted-foreground";
const bulkModalThumbLabel = "text-sm leading-snug lg:text-[1.75rem]";
const bulkModalBtn =
  "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium leading-snug md:px-4 lg:min-h-12 lg:px-5 lg:text-[1.75rem]";
const bulkModalSection = "min-w-0 rounded-lg border bg-background p-3 md:p-5";
const bulkModalTrackShell = "lg:py-12 lg:pt-14";

function SectionToggle({
  checked,
  onChange,
  icon,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <label className="flex min-w-0 cursor-pointer flex-wrap items-center gap-x-2.5 gap-y-1 border-b pb-2.5 md:gap-x-3 md:pb-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 shrink-0 accent-emerald-600 md:size-5"
      />
      <span className="flex shrink-0 items-center">{icon}</span>
      <span className={cn("min-w-0 flex-1 leading-snug", bulkModalSectionTitle)}>
        {label}
      </span>
      <span className={cn("shrink-0 leading-snug", bulkModalMeta)}>
        {checked ? "적용" : "변경 안 함"}
      </span>
    </label>
  );
}

export function FarmMapBulkApply({
  controller,
  bulkMode,
  selectedSps,
  onEnter,
  onClearSelection,
  onExit,
  onAfterApply,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [applyTemp, setApplyTemp] = useState(true);
  const [applyVent, setApplyVent] = useState(true);
  const [applyAlarm, setApplyAlarm] = useState(true);
  const [setpoint, setSetpoint] = useState(EDIT_START_DRAFT.setpointTemp);
  const [deviation, setDeviation] = useState(EDIT_START_DRAFT.tempDeviation);
  const [minVent, setMinVent] = useState(EDIT_START_DRAFT.minVentPct);
  const [maxVent, setMaxVent] = useState(EDIT_START_DRAFT.maxVentPct);
  const [alarm, setAlarm] = useState<AlarmThresholds>(DEFAULT_ALARM_THRESHOLDS);

  const spSet = useMemo(() => new Set(selectedSps), [selectedSps]);
  const targets = useMemo(
    () =>
      controller.readings.filter((r) =>
        spSet.has(normalizeStallTyCode(r.stallTyCode))
      ),
    [controller.readings, spSet]
  );
  const onlineTargets = useMemo(
    () => targets.filter((r) => isReadingOnline(r.status)),
    [targets]
  );
  const offlineCount = targets.length - onlineTargets.length;

  const nothingSelected = !applyTemp && !applyVent && !applyAlarm;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !running) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, running]);

  const runApply = async () => {
    setError(null);
    if (nothingSelected) {
      setError("적용할 항목을 1개 이상 선택하세요.");
      return;
    }
    if (applyAlarm) {
      const err = validateAlarmThresholds(alarm);
      if (err) {
        setError(err);
        return;
      }
    }

    setRunning(true);
    let control: SendBulkThermoCommandResult | null = null;
    let alarmResult: ApplyResult["alarm"] = null;

    // 1) 제어값(온도/환기) — 온라인 컨트롤러만, 컨트롤러별 값 구성
    if ((applyTemp || applyVent) && onlineTargets.length > 0) {
      const commands: BulkThermoCommand[] = onlineTargets.map((r) => {
        const cur = resolveThermoSettings(
          controller.thermoSettings,
          r.farmKey,
          r.moduleUid,
          r.controllerKey
        );
        return {
          key: r.key,
          lsindRegistNo: r.farmKey.lsindRegistNo,
          itemCode: r.farmKey.itemCode,
          moduleUid: r.moduleUid,
          stallTyCode: r.stallTyCode ?? "SP01",
          stallNo: r.stallNo ?? "01",
          eqpmnNo: r.eqpmnNo,
          setpointTemp: applyTemp
            ? setpoint
            : cur?.setpointTemp ?? EDIT_START_DRAFT.setpointTemp,
          tempDeviation: applyTemp
            ? deviation
            : cur?.tempDeviation ?? EDIT_START_DRAFT.tempDeviation,
          minVentPct: applyVent
            ? minVent
            : cur?.minVentPct ?? EDIT_START_DRAFT.minVentPct,
          maxVentPct: applyVent
            ? maxVent
            : cur?.maxVentPct ?? EDIT_START_DRAFT.maxVentPct,
        };
      });
      control = await sendBulkThermoCommandAction(commands);
    }

    // 2) 알람 임계값 — farm+sp override + 하위 stall·controller override cascade
    if (applyAlarm) {
      const base = controller.alarmSettings ?? DEFAULT_ALARM_SETTINGS;
      const { settings, spScopeKeys, clearedOverrides } = applyBulkSpAlarmThresholds(
        base,
        targets,
        spSet,
        alarm
      );
      const fd = new FormData();
      fd.set("settings_json", JSON.stringify(settings));
      const res = await saveAlarmSettingsInlineAction(fd);
      alarmResult = {
        ok: res.ok,
        spCount: spScopeKeys.length,
        clearedOverrides,
        error: res.error,
        settings: res.ok ? settings : undefined,
      };
    }

    setResult({ control, alarm: alarmResult });
    setRunning(false);
    const applied = { control, alarm: alarmResult };
    onAfterApply?.(applied);
  };

  const closeAll = () => {
    setOpen(false);
    setResult(null);
    setError(null);
    onExit();
  };

  const modalContent =
    open && mounted ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-3 sm:p-4">
        <div className={bulkModalShell} role="dialog" aria-modal="true" aria-labelledby="bulk-apply-title">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3 md:px-6 md:py-4">
            <div className="min-w-0 flex-1">
              <p id="bulk-apply-title" className={cn("font-semibold leading-snug", bulkModalSectionTitle)}>
                컨트롤러 일괄 설정
              </p>
              <p className={cn("mt-1 leading-snug", bulkModalMeta)}>
                대상 유형 {selectedSps.length}개 · 컨트롤러 {targets.length}대
                {offlineCount > 0
                  ? ` (제어는 온라인 ${onlineTargets.length}대에만 전송)`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => (running ? undefined : setOpen(false))}
              disabled={running}
              className="inline-flex shrink-0 items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50 md:p-2"
              aria-label="닫기"
            >
              <X className={dashboardUi.iconSm} />
            </button>
          </div>

          {result ? (
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 md:px-6 md:py-5">
              <div className="flex items-center gap-2.5 text-emerald-700">
                <CheckCircle2 className={dashboardUi.iconSm} />
                <p className={cn("font-semibold leading-snug", bulkModalSectionTitle)}>
                  일괄 적용 완료
                </p>
              </div>
              <ul className="mt-3 space-y-1.5 leading-snug">
                {result.control ? (
                  <li>
                    제어 명령: 전송 {result.control.sent}대
                    {result.control.failed.length > 0
                      ? ` · 실패 ${result.control.failed.length}대`
                      : ""}
                    {offlineCount > 0 ? ` · 오프라인 ${offlineCount}대 제외` : ""}
                  </li>
                ) : applyTemp || applyVent ? (
                  <li className="text-amber-700">
                    제어 명령: 온라인 컨트롤러가 없어 전송하지 않았습니다.
                  </li>
                ) : null}
                {result.alarm ? (
                  <li>
                    알람 임계값:{" "}
                    {result.alarm.ok
                      ? `유형 ${result.alarm.spCount}개 갱신${
                          (result.alarm.clearedOverrides ?? 0) > 0
                            ? ` · 개별 설정 ${result.alarm.clearedOverrides}건 제거`
                            : ""
                        }`
                      : `저장 실패 (${result.alarm.error ?? "오류"})`}
                  </li>
                ) : null}
              </ul>
              {result.control && result.control.failed.length > 0 ? (
                <p className={cn("mt-2 text-red-600", bulkModalMeta)}>
                  일부 컨트롤러 전송에 실패했습니다. 개별 패널에서 재시도하세요.
                </p>
              ) : null}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={closeAll}
                  className={cn(
                    bulkModalBtn,
                    "bg-emerald-600 text-white hover:bg-emerald-700"
                  )}
                >
                  완료
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto px-4 py-4 md:space-y-5 md:px-6 md:py-5">
                {/* 온도 */}
                <section className={bulkModalSection}>
                  <SectionToggle
                    checked={applyTemp}
                    onChange={setApplyTemp}
                    icon={
                      <Thermometer
                        className={cn(dashboardUi.iconSm, "text-orange-600")}
                        aria-hidden
                      />
                    }
                    label="온도 (설정·편차)"
                  />
                  <div className="min-w-0 pt-3 md:pt-4">
                    <ControllerTempDualSlider
                      setpoint={setpoint}
                      deviation={deviation}
                      disabled={!applyTemp}
                      compact={false}
                      thumbLabelClassName={bulkModalThumbLabel}
                      trackShellClassName={bulkModalTrackShell}
                      onChange={(sp, dev) => {
                        setSetpoint(sp);
                        setDeviation(dev);
                      }}
                    />
                  </div>
                </section>

                {/* 환기 */}
                <section className={bulkModalSection}>
                  <SectionToggle
                    checked={applyVent}
                    onChange={setApplyVent}
                    icon={
                      <Fan className={cn(dashboardUi.iconSm, "text-sky-600")} aria-hidden />
                    }
                    label="환기 (최저·최고)"
                  />
                  <div className="min-w-0 pt-3 md:pt-4">
                    <ThresholdRangeSlider
                      title="환기"
                      icon={
                        <Fan className={cn(dashboardUi.iconSm, "text-sky-600")} aria-hidden />
                      }
                      min={0}
                      max={100}
                      step={5}
                      low={minVent}
                      high={maxVent}
                      unit="%"
                      lowLabel="최저환기"
                      highLabel="최고환기"
                      accentClass="bg-sky-500/35"
                      showAxis
                      bare
                      compact={false}
                      titleClassName={bulkModalSectionTitle}
                      thumbLabelClassName={bulkModalThumbLabel}
                      axisClassName={bulkModalMeta}
                      trackShellClassName="lg:pt-12 lg:pb-4"
                      disabled={!applyVent}
                      onChange={(low, high) => {
                        setMinVent(low);
                        setMaxVent(high);
                      }}
                    />
                  </div>
                </section>

                {/* 알람 */}
                <section className={bulkModalSection}>
                  <SectionToggle
                    checked={applyAlarm}
                    onChange={setApplyAlarm}
                    icon={
                      <Thermometer
                        className={cn(dashboardUi.iconSm, "text-red-600")}
                        aria-hidden
                      />
                    }
                    label="알람 임계값 (온·습 상하한)"
                  />
                  <div className="min-w-0 space-y-4 pt-3 md:space-y-5 md:pt-4">
                    <ThresholdRangeSlider
                      title="온도 알림"
                      icon={
                        <Thermometer
                          className={cn(dashboardUi.iconSm, "text-orange-600")}
                          aria-hidden
                        />
                      }
                      min={-40}
                      max={60}
                      step={0.5}
                      low={alarm.tempLow}
                      high={alarm.tempHigh}
                      unit="℃"
                      accentClass="bg-orange-500/35"
                      bare
                      compact={false}
                      titleClassName={bulkModalSectionTitle}
                      thumbLabelClassName={bulkModalThumbLabel}
                      trackShellClassName="lg:pt-12 lg:pb-3"
                      disabled={!applyAlarm}
                      onChange={(low, high) =>
                        setAlarm((a) => ({ ...a, tempLow: low, tempHigh: high }))
                      }
                    />
                    <ThresholdRangeSlider
                      title="습도 알림"
                      icon={
                        <Fan className={cn(dashboardUi.iconSm, "text-sky-600")} aria-hidden />
                      }
                      min={0}
                      max={100}
                      step={1}
                      low={alarm.humidityLow}
                      high={alarm.humidityHigh}
                      unit="%"
                      accentClass="bg-sky-500/35"
                      bare
                      compact={false}
                      titleClassName={bulkModalSectionTitle}
                      thumbLabelClassName={bulkModalThumbLabel}
                      trackShellClassName="lg:pt-12 lg:pb-3"
                      disabled={!applyAlarm}
                      onChange={(low, high) =>
                        setAlarm((a) => ({
                          ...a,
                          humidityLow: low,
                          humidityHigh: high,
                        }))
                      }
                    />
                  </div>
                </section>

                {error ? (
                  <p className="leading-snug text-red-600">{error}</p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 md:px-6 md:py-4">
                <p className={cn("min-w-0 leading-snug", bulkModalMeta)}>
                  {nothingSelected
                    ? "적용할 항목을 선택하세요."
                    : "체크한 항목만 적용됩니다."}
                </p>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 md:gap-3">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={running}
                    className={cn(bulkModalBtn, "border hover:bg-muted disabled:opacity-50")}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={runApply}
                    disabled={running || nothingSelected}
                    className={cn(
                      bulkModalBtn,
                      "gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                    )}
                  >
                    {running ? (
                      <>
                        <Loader2 className="size-4 animate-spin lg:size-5" />
                        적용 중…
                      </>
                    ) : (
                      `${targets.length}대에 적용`
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    ) : null;

  return (
    <>
      {/* 그리드 상단 커맨드 바 — FarmMapCard·지도 카드와 동일 타이포 스케일 */}
      <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b bg-muted/30 px-3 py-2 lg:gap-x-4 lg:px-4 lg:py-2.5">
        <div className="flex min-w-0 items-center gap-2 lg:gap-2.5">
          <SlidersHorizontal
            className={cn(
              dashboardUi.iconSm,
              bulkMode ? "text-emerald-600" : "text-muted-foreground"
            )}
            aria-hidden
          />
          <span className="truncate text-sm font-semibold leading-snug lg:text-lg">
            일괄적용
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={bulkMode}
            aria-label={bulkMode ? "일괄적용 종료" : "일괄적용 시작"}
            onClick={() => (bulkMode ? onExit() : onEnter())}
            className={cn(
              "relative h-5 w-9 shrink-0 rounded-full transition-colors md:h-6 md:w-11",
              bulkMode ? "bg-emerald-600" : "bg-muted-foreground/30"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 size-4 rounded-full bg-white transition-all md:top-0.5 md:size-5",
                bulkMode ? "left-[1.125rem] md:left-[1.375rem]" : "left-0.5"
              )}
            />
          </button>
        </div>

        {bulkMode ? (
          <>
            <span className="hidden h-5 w-px shrink-0 bg-border sm:block" aria-hidden />
            <p className="min-w-0 text-xs text-muted-foreground leading-snug sm:text-sm lg:text-[1.75rem]">
              유형 {selectedSps.length}개 · 컨트롤러 {targets.length}대
              {offlineCount > 0 ? ` (오프라인 ${offlineCount}대 제외)` : ""}
            </p>
            <span className="hidden min-w-0 flex-1 sm:block" aria-hidden />
            <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
              <button
                type="button"
                onClick={onClearSelection}
                disabled={selectedSps.length === 0}
                className={cn(
                  bulkModalBtn,
                  "border hover:bg-muted disabled:opacity-50"
                )}
              >
                선택 해제
              </button>
              <button
                type="button"
                onClick={() => setOpen(true)}
                disabled={selectedSps.length === 0}
                className={cn(
                  bulkModalBtn,
                  "bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                )}
              >
                설정 입력
              </button>
            </div>
          </>
        ) : null}
      </div>

      {mounted && modalContent ? createPortal(modalContent, document.body) : null}
    </>
  );
}
