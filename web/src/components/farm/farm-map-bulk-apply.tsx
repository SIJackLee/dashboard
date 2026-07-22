"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Loader2,
  SlidersHorizontal,
  Thermometer,
  X,
} from "lucide-react";
import { ControllerTempDualSlider } from "@/components/controllers/controller-temp-dual-slider";
import { AlarmDomainIcon } from "@/components/settings/alarm-domain-icon";
import { ThresholdRangeSlider } from "@/components/settings/threshold-range-slider";
import {
  sendBulkThermoCommandAction,
  type SendBulkThermoCommandResult,
} from "@/app/(dashboard)/controllers/actions";
import { saveAlarmSettingsInlineAction } from "@/lib/actions/app-settings-actions";
import type { ControllerGridData } from "@/lib/farm/controller-grid-data";
import {
  DEFAULT_ALARM_SETTINGS,
  DEFAULT_ALARM_THRESHOLDS,
  validateAlarmThresholds,
  type AlarmSettings,
  type AlarmThresholds,
} from "@/lib/data/alarms";
import { applyBulkSpAlarmThresholds } from "@/lib/data/alarm-scope";
import { EDIT_START_DRAFT } from "@/lib/controllers/controller-panel-map";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import { isReadingOnline } from "@/lib/data/reading-display";
import type { InlineStatusTone } from "@/components/common/inline-status-toast";
import { BulkLiveProgressBanner } from "@/components/farm/bulk-live-progress-banner";
import { useBulkCommandPipelineTracker } from "@/components/farm/use-bulk-command-pipeline-tracker";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import {
  SectionToggle,
  buildBulkThermoCommands,
  bulkModalShell,
  bulkModalSectionTitle,
  bulkModalMeta,
  bulkModalThumbLabel,
  bulkModalBtn,
  bulkModalSection,
  bulkModalTrackShell,
} from "@/components/farm/farm-map-bulk-apply-parts";
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
  onAfterApply?: (result: ApplyResult, feedback: BulkApplyFeedback) => void;
  /** ACK/LIVE 폴링 중 LIVE·commands 갱신 */
  onRefreshLive?: () => void;
  /** 일괄적용 off — 툴바 우측 (기간 선택 등) */
  trailing?: ReactNode;
  /** 모바일 목록 — bulk bar 한 줄 배치 (일괄적용 ↔ trailing) */
  trailingCompact?: boolean;
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

export type BulkApplyOutcome = "success" | "partial" | "error";

export type BulkApplyFeedback = {
  message: string;
  tone: InlineStatusTone;
  title: string;
  outcome: BulkApplyOutcome;
};

type ApplyPhase = "idle" | "control" | "alarm";

function controlHadWork(result: ApplyResult): boolean {
  return result.control != null;
}

function alarmFailed(result: ApplyResult): boolean {
  return Boolean(result.alarm && !result.alarm.ok);
}

function controlHardFailed(result: ApplyResult): boolean {
  const c = result.control;
  if (!c) return false;
  if (c.error && c.sent === 0) return true;
  return !c.ok && c.sent === 0 && c.failed.length > 0;
}

function controlPartial(result: ApplyResult): boolean {
  const c = result.control;
  if (!c) return false;
  return c.failed.length > 0 && c.sent > 0;
}

/** 일괄 적용 결과 — 성공 / 부분 / 실패 분류 */
export function classifyBulkApplyResult(
  result: ApplyResult,
  opts?: { wantedControl?: boolean; offlineSkipped?: number },
): BulkApplyOutcome {
  const wantedControl = opts?.wantedControl ?? controlHadWork(result);
  const offlineSkipped = opts?.offlineSkipped ?? 0;

  if (controlHardFailed(result) && alarmFailed(result)) return "error";
  if (controlHardFailed(result) && !result.alarm) return "error";
  if (alarmFailed(result) && !controlHadWork(result)) return "error";
  if (controlPartial(result) || alarmFailed(result)) return "partial";
  if (wantedControl && !controlHadWork(result) && offlineSkipped > 0) {
    return result.alarm?.ok ? "partial" : "error";
  }
  if (result.control && !result.control.ok && result.control.failed.length > 0) {
    return "partial";
  }
  return "success";
}

export function formatBulkApplyFeedback(
  result: ApplyResult,
  opts?: { wantedControl?: boolean; offlineSkipped?: number },
): BulkApplyFeedback {
  const outcome = classifyBulkApplyResult(result, opts);
  const parts: string[] = [];

  if (result.control) {
    if (result.control.error && result.control.sent === 0) {
      parts.push(
        result.control.error === "forbidden" ||
          result.control.error === "unauthorized"
          ? "제어 권한 없음"
          : `제어 전송 실패 (${result.control.error})`,
      );
    } else {
      parts.push(`제어 ${result.control.sent}대 전송`);
      if (result.control.failed.length > 0) {
        parts.push(`실패 ${result.control.failed.length}대`);
      }
    }
  } else if (opts?.wantedControl && (opts.offlineSkipped ?? 0) > 0) {
    parts.push("온라인 컨트롤러 없음 · 제어 미전송");
  }

  if (result.alarm) {
    if (result.alarm.ok) {
      parts.push(`알람 유형 ${result.alarm.spCount}개 갱신`);
      if ((result.alarm.clearedOverrides ?? 0) > 0) {
        parts.push(`개별 설정 ${result.alarm.clearedOverrides}건 제거`);
      }
    } else {
      parts.push(
        result.alarm.error
          ? `알람 저장 실패 (${result.alarm.error})`
          : "알람 저장 실패",
      );
    }
  }

  const message =
    parts.join(" · ") ||
    (outcome === "error" ? "일괄 적용 실패" : "일괄 적용 완료");

  const title =
    outcome === "success"
      ? "일괄 적용 완료"
      : outcome === "partial"
        ? "일부만 적용됨"
        : "일괄 적용 실패";

  const tone: InlineStatusTone =
    outcome === "success" ? "ok" : outcome === "partial" ? "warn" : "error";

  return { message, tone, title, outcome };
}

/** @deprecated — formatBulkApplyFeedback 사용 권장 */
export function formatBulkApplyToast(result: ApplyResult): string {
  return formatBulkApplyFeedback(result).message;
}

export function FarmMapBulkApply({
  controller,
  bulkMode,
  selectedSps,
  onEnter,
  onClearSelection,
  onExit,
  onAfterApply,
  onRefreshLive,
  trailing,
  trailingCompact = false,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [applyPhase, setApplyPhase] = useState<ApplyPhase>("idle");
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

  const liveTracker = useBulkCommandPipelineTracker({
    thermoSettings: controller.thermoSettings,
    readings: controller.readings,
    onRefreshLive,
  });

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
    setApplyPhase("idle");
    let control: SendBulkThermoCommandResult | null = null;
    let alarmResult: ApplyResult["alarm"] = null;
    const wantedControl = applyTemp || applyVent;

    // 1) 제어값(온도/환기) — 온라인 컨트롤러만, 컨트롤러별 값 구성
    if (wantedControl && onlineTargets.length > 0) {
      setApplyPhase("control");
      const commands = buildBulkThermoCommands(
        onlineTargets,
        controller.thermoSettings,
        { applyTemp, applyVent, setpoint, deviation, minVent, maxVent }
      );
      control = await sendBulkThermoCommandAction(commands);
    }

    // 2) 알람 임계값 — farm+sp override + 하위 stall·controller override cascade
    if (applyAlarm) {
      setApplyPhase("alarm");
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

    const applied: ApplyResult = { control, alarm: alarmResult };
    const feedback = formatBulkApplyFeedback(applied, {
      wantedControl,
      offlineSkipped: offlineCount,
    });
    if (control?.sentItems?.length) {
      liveTracker.startSession(control.sentItems);
    }
    setResult(applied);
    setApplyPhase("idle");
    setRunning(false);
    onAfterApply?.(applied, feedback);
  };

  const closeAll = () => {
    setOpen(false);
    setResult(null);
    setError(null);
    setApplyPhase("idle");
    onExit();
  };

  const resultFeedback = result
    ? formatBulkApplyFeedback(result, {
        wantedControl: applyTemp || applyVent,
        offlineSkipped: offlineCount,
      })
    : null;

  const modalContent =
    open && mounted ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-3 sm:p-4 ui-motion-modal-backdrop" data-mobile-viewport-fullscreen>
        <div className={cn(bulkModalShell, "ui-motion-modal-panel")} role="dialog" aria-modal="true" aria-labelledby="bulk-apply-title">
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

          {result && resultFeedback ? (
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 md:px-6 md:py-5">
              <div
                className={cn(
                  "flex items-center gap-2.5",
                  resultFeedback.outcome === "success" && "text-emerald-700 dark:text-emerald-400",
                  resultFeedback.outcome === "partial" && "text-amber-800 dark:text-amber-300",
                  resultFeedback.outcome === "error" && "text-red-700 dark:text-red-400",
                )}
              >
                {resultFeedback.outcome === "success" ? (
                  <CheckCircle2 className={dashboardUi.iconSm} aria-hidden />
                ) : resultFeedback.outcome === "partial" ? (
                  <AlertTriangle className={dashboardUi.iconSm} aria-hidden />
                ) : (
                  <AlertCircle className={dashboardUi.iconSm} aria-hidden />
                )}
                <p className={cn("font-semibold leading-snug", bulkModalSectionTitle)}>
                  {resultFeedback.title}
                </p>
              </div>
              <ul className="mt-3 space-y-1.5 leading-snug">
                {result.control ? (
                  <li>
                    제어 명령: 전송 {result.control.sent}대
                    {result.control.failed.length > 0
                      ? ` · 실패 ${result.control.failed.length}대`
                      : ""}
                    {result.control.error && result.control.sent === 0
                      ? ` · ${result.control.error}`
                      : ""}
                    {offlineCount > 0 ? ` · 오프라인 ${offlineCount}대 제외` : ""}
                  </li>
                ) : applyTemp || applyVent ? (
                  <li className="text-amber-700 dark:text-amber-300">
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
              {resultFeedback.outcome === "partial" ? (
                <p className={cn("mt-2 text-amber-800 dark:text-amber-300", bulkModalMeta)}>
                  일부만 반영되었습니다. 실패 항목은 개별 패널에서 재시도하세요.
                </p>
              ) : null}
              {resultFeedback.outcome === "error" ? (
                <p className={cn("mt-2 text-red-600 dark:text-red-400", bulkModalMeta)}>
                  적용에 실패했습니다. 권한·네트워크·대상 상태를 확인한 뒤 다시 시도하세요.
                </p>
              ) : null}
              {liveTracker.progress.total > 0 ? (
                <div
                  className={cn(
                    "mt-4 rounded-lg border px-3 py-2.5",
                    liveTracker.progress.allLive
                      ? "border-emerald-200/80 bg-emerald-50/60 dark:bg-emerald-950/30"
                      : "border-sky-200/70 bg-sky-50/50 dark:bg-sky-950/20",
                  )}
                >
                  <p className={cn("font-semibold leading-snug", bulkModalSectionTitle)}>
                    {liveTracker.progress.allLive
                      ? "현장 반영 완료"
                      : liveTracker.progress.timedOut
                        ? "현장 반영 일부 미확인"
                        : "현장 반영 확인 중"}
                  </p>
                  <p className={cn("mt-1 leading-snug", bulkModalMeta)}>
                    LIVE {liveTracker.progress.liveDone}/{liveTracker.progress.total}
                    {" · "}
                    ACK {liveTracker.progress.ackDone}/{liveTracker.progress.total}
                    {liveTracker.progress.failed > 0
                      ? ` · 실패 ${liveTracker.progress.failed}`
                      : ""}
                  </p>
                  {!liveTracker.progress.complete ? (
                    <p className={cn("mt-1 text-xs leading-snug", bulkModalMeta)}>
                      확인을 눌러도 하단 배너에서 진행 상태를 계속 볼 수 있습니다.
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={closeAll}
                  className={cn(
                    bulkModalBtn,
                    resultFeedback.outcome === "error"
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : resultFeedback.outcome === "partial"
                        ? "bg-amber-600 text-white hover:bg-amber-700"
                        : "bg-emerald-600 text-white hover:bg-emerald-700",
                  )}
                >
                  확인
                </button>
              </div>
            </div>
          ) : running ? (
            <div className="flex min-h-[12rem] flex-1 flex-col items-center justify-center gap-3 px-4 py-10 text-center md:px-6">
              <Loader2
                className="size-8 animate-spin text-emerald-600 md:size-10"
                aria-hidden
              />
              <p className={cn("font-semibold", bulkModalSectionTitle)}>
                일괄 적용 중…
              </p>
              <p className={cn("leading-snug", bulkModalMeta)}>
                {applyPhase === "alarm"
                  ? "알람 임계값을 저장하고 있습니다."
                  : applyPhase === "control"
                    ? `제어 명령을 전송하고 있습니다. (${onlineTargets.length}대)`
                    : "적용을 준비하고 있습니다."}
              </p>
              <p className={cn("text-xs leading-snug", bulkModalMeta)}>
                창을 닫지 마세요.
              </p>
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
                    label="설정온도 · 편차"
                  />
                  <div className="min-w-0 pt-3 md:pt-4">
                    <ControllerTempDualSlider
                      setpoint={setpoint}
                      deviation={deviation}
                      disabled={!applyTemp}
                      compact={false}
                      axisMode="editable"
                      axisInputSize="dashboard"
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
                      <span
                        className={cn(
                          dashboardUi.iconSm,
                          "inline-flex items-center justify-center font-bold text-sky-600",
                        )}
                        aria-hidden
                      >
                        %
                      </span>
                    }
                    label="환기 (최저·최고)"
                  />
                  <div className="min-w-0 pt-3 md:pt-4">
                    <ThresholdRangeSlider
                      title="환기"
                      icon={
                        <span
                          className={cn(
                            dashboardUi.iconSm,
                            "inline-flex items-center justify-center font-bold text-sky-600",
                          )}
                          aria-hidden
                        >
                          %
                        </span>
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
                      axisMode="editable"
                      axisInputSize="dashboard"
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
                      <Bell
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
                        <AlarmDomainIcon
                          domain="temp"
                          sizeClass={dashboardUi.iconSm}
                        />
                      }
                      min={10}
                      max={35}
                      step={0.5}
                      low={alarm.tempLow}
                      high={alarm.tempHigh}
                      unit="℃"
                      accentClass="bg-orange-500/35"
                      axisMode="editable"
                      axisInputSize="dashboard"
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
                        <AlarmDomainIcon
                          domain="humidity"
                          sizeClass={dashboardUi.iconSm}
                        />
                      }
                      min={0}
                      max={100}
                      step={1}
                      low={alarm.humidityLow}
                      high={alarm.humidityHigh}
                      unit="%"
                      accentClass="bg-sky-500/35"
                      axisMode="editable"
                      axisInputSize="dashboard"
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
      <div
        className={cn(
          "flex min-w-0 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b bg-muted/30 px-3 py-2 lg:gap-x-4 lg:px-4 lg:py-2.5",
          trailingCompact &&
            !bulkMode &&
            trailing &&
            "flex-nowrap justify-between gap-2",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 items-center gap-2 lg:gap-2.5",
            trailingCompact && !bulkMode && trailing && "min-w-0 shrink",
          )}
          data-tour-id="bulk-apply"
        >
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
          <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClearSelection}
              disabled={selectedSps.length === 0}
              className={cn(
                bulkModalBtn,
                "border hover:bg-muted disabled:opacity-50"
              )}
            >
              선택해제
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
              설정입력
            </button>
          </div>
        ) : trailing ? (
          <div
            className={cn(
              "flex shrink-0 items-center gap-2",
              trailingCompact ? "ml-0" : "ml-auto",
            )}
          >
            {trailing}
          </div>
        ) : null}
      </div>

      {mounted && modalContent ? createPortal(modalContent, document.body) : null}
      {mounted ? (
        <BulkLiveProgressBanner
          progress={liveTracker.progress}
          visible={liveTracker.bannerVisible && !open}
          onDismiss={liveTracker.dismissBanner}
        />
      ) : null}
    </>
  );
}
