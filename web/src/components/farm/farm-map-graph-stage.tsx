"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  ArrowLeft,
  ExternalLink,
  ChevronRight,
  Loader2,
  SlidersHorizontal,
} from "lucide-react";
import { useAppNavigate } from "@/components/layout/use-app-navigate";
import { TrendChart, type TrendSeries } from "@/components/trends/trend-chart";
import {
  DEFAULT_ALARM_SETTINGS,
  type AlarmSettings,
  type AlarmThresholds,
} from "@/lib/data/alarms";
import type { BarnReading } from "@/lib/data/iot";
import {
  tempTrendLeftDomain,
  envTrendReferenceLines,
} from "@/lib/farm/trend-chart-series";
import { resolveReadingAlarmThresholds } from "@/lib/farm/controller-summary-display";
import {
  TREND_PERIODS,
  type TrendPeriodData,
  type TrendPeriodId,
  type TrendStallSeries,
} from "@/lib/data/farm-trend-types";
import {
  FarmMapControllerPanel,
  type ControllerGridData,
} from "@/components/farm/farm-map-controller-panel";
import {
  clearMapControllerStall,
  currentFarmSearchParams,
  replaceFarmUrlShallow,
  setMapControllerStall,
  setMapDrillLevel,
  type FarmMapDrillLevel,
} from "@/lib/farm/farm-view-url";
import { prefetchControllerDetail } from "@/components/controllers/use-controller-detail";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import { cn } from "@/lib/utils";

function envChartScale(
  alarmSettings: AlarmSettings | undefined,
  reading: BarnReading | null
): { leftDomain: [number, number]; referenceLines: ReturnType<typeof envTrendReferenceLines> } {
  const thresholds: AlarmThresholds = reading
    ? resolveReadingAlarmThresholds(reading, alarmSettings)
    : (alarmSettings?.global ?? DEFAULT_ALARM_SETTINGS.global);
  return {
    leftDomain: tempTrendLeftDomain(thresholds),
    referenceLines: envTrendReferenceLines(thresholds),
  };
}

type ChartMode = "line" | "bar";

const COLORS = {
  temp: "#ef4444",
  humidity: "#0ea5e9",
  fanSupply: "#10b981",
  fanExhaust: "#8b5cf6",
  fanIntake: "#f59e0b",
} as const;

const PERIOD_ORDER: TrendPeriodId[] = ["24h", "7d", "30d"];

type StallMetrics = Pick<
  TrendStallSeries,
  "temp" | "humidity" | "fanSupply" | "fanExhaust" | "fanIntake"
>;

function averageStalls(stalls: TrendStallSeries[]): StallMetrics {
  const len = stalls[0]?.temp.length ?? 0;
  const avgOf = (pick: (s: TrendStallSeries) => (number | null)[]) =>
    Array.from({ length: len }, (_, i) => {
      let sum = 0;
      let count = 0;
      for (const s of stalls) {
        const v = pick(s)[i];
        if (v != null && Number.isFinite(v)) {
          sum += v;
          count += 1;
        }
      }
      return count > 0 ? Math.round((sum / count) * 10) / 10 : null;
    });
  return {
    temp: avgOf((s) => s.temp),
    humidity: avgOf((s) => s.humidity),
    fanSupply: avgOf((s) => s.fanSupply),
    fanExhaust: avgOf((s) => s.fanExhaust),
    fanIntake: avgOf((s) => s.fanIntake),
  };
}

function envSeriesOf(m: StallMetrics): TrendSeries[] {
  return [
    { name: "온도", data: m.temp, color: COLORS.temp, axis: "left" },
    { name: "습도", data: m.humidity, color: COLORS.humidity, axis: "right" },
  ];
}

function fanSeriesOf(m: StallMetrics): TrendSeries[] {
  return [
    { name: "송풍", data: m.fanSupply, color: COLORS.fanSupply },
    { name: "배기", data: m.fanExhaust, color: COLORS.fanExhaust },
    { name: "입기", data: m.fanIntake, color: COLORS.fanIntake },
  ];
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(callback: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener?.("change", callback);
  return () => mq.removeEventListener?.("change", callback);
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () =>
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia(REDUCED_MOTION_QUERY).matches
        : false,
    () => false
  );
}

/** Fade + scale-in enter animation via Web Animations API (respects reduced-motion). */
function Enter({
  children,
  delay = 0,
  animKey,
}: {
  children: React.ReactNode;
  delay?: number;
  animKey: string;
}) {
  const reduced = usePrefersReducedMotion();
  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || reduced || typeof node.animate !== "function") return;
      node.animate(
        [
          { opacity: 0, transform: "scale(0.97) translateY(8px)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 300, delay: delay * 1000, easing: "ease", fill: "backwards" }
      );
    },
    [reduced, delay]
  );
  return (
    <div key={animKey} ref={ref}>
      {children}
    </div>
  );
}

/** Card-flip entry (rotateY) for the in-grid controller — game-like reveal. */
function FlipEnter({
  children,
  animKey,
  instant = false,
}: {
  children: React.ReactNode;
  animKey: string;
  instant?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || instant || reduced || typeof node.animate !== "function") return;
      node.animate(
        [
          { opacity: 0, transform: "perspective(1200px) rotateY(90deg)" },
          { opacity: 1, transform: "perspective(1200px) rotateY(0deg)" },
        ],
        { duration: 360, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)", fill: "backwards" }
      );
    },
    [reduced, instant]
  );
  return (
    <div key={animKey} ref={ref} className="h-full" style={{ transformStyle: "preserve-3d" }}>
      {children}
    </div>
  );
}

type Level = "sp" | "stalls";

export type FarmMapTrendStatus = "ready" | "loading" | "error";

type Props = {
  stallTyCode: string;
  label: string;
  dataByPeriod: Record<TrendPeriodId, TrendPeriodData> | null;
  trendStatus?: FarmMapTrendStatus;
  /** 해당 SP 그리드 카드에 LIVE readings 존재 여부 */
  hasLiveSnapshot?: boolean;
  onTrendRetry?: () => void;
  controllerHref: string | null;
  controller?: ControllerGridData | null;
  /** URL mapLevel — SP 요약 vs 축사번호별 */
  initialMapLevel?: FarmMapDrillLevel;
  /** tree/alarm deep-link — in-grid controller card-flip 진입 */
  initialControllerStallNo?: string | null;
  onClose: () => void;
};

export function FarmMapGraphStage({
  stallTyCode,
  label,
  dataByPeriod,
  trendStatus = "ready",
  hasLiveSnapshot = false,
  onTrendRetry,
  controllerHref,
  controller,
  initialMapLevel = "sp",
  initialControllerStallNo,
  onClose,
}: Props) {
  const [level, setLevelState] = useState<Level>(
    initialMapLevel === "stalls" ? "stalls" : "sp"
  );
  const [period, setPeriod] = useState<TrendPeriodId>("24h");
  const [mode, setMode] = useState<ChartMode>("bar");
  const [controllerStallNo, setControllerStallNo] = useState<string | null>(
    initialControllerStallNo ?? null
  );

  // SP 카드 전환 시에만 URL deep-link 로 drill 초기화 (shallow drill 은 로컬 state 유지)
  useEffect(() => {
    setLevelState(initialMapLevel === "stalls" ? "stalls" : "sp");
    setControllerStallNo(initialControllerStallNo ?? null);
  }, [stallTyCode]);

  const setLevel = useCallback((next: Level) => {
    setLevelState(next);
    const params = currentFarmSearchParams();
    setMapDrillLevel(params, next);
    replaceFarmUrlShallow(params);
  }, []);

  const openControllerInGrid = useCallback((stallNo: string) => {
    setControllerStallNo(stallNo);
    const params = currentFarmSearchParams();
    setMapControllerStall(params, stallNo);
    replaceFarmUrlShallow(params);
  }, []);

  const closeControllerInGrid = useCallback(() => {
    setControllerStallNo(null);
    const params = currentFarmSearchParams();
    clearMapControllerStall(params);
    replaceFarmUrlShallow(params);
  }, []);

  const { navigate } = useAppNavigate();

  const findReading = useCallback(
    (stallNo: string) =>
      controller?.readings.find(
        (r) =>
          normalizeStallTyCode(r.stallTyCode) === normalizeStallTyCode(stallTyCode) &&
          (r.stallNo ?? "") === stallNo
      ) ?? null,
    [controller, stallTyCode]
  );

  const periodData = dataByPeriod?.[period] ?? null;
  const sp = periodData?.sp.find((s) => s.stallTyCode === stallTyCode) ?? null;
  const categories = periodData?.categories ?? [];
  const stalls = sp?.stalls ?? [];
  const spAvg = stalls.length > 0 ? averageStalls(stalls) : null;
  const spEnvScale = envChartScale(controller?.alarmSettings, null);

  const goController = () => {
    if (!controllerHref) return;
    navigate(controllerHref, { message: "컨트롤러 페이지로 이동 중…" });
  };

  /** in-grid 데이터가 있으면 카드플립, 없으면 페이지 이동(폴백). */
  const openController = (stallNo: string) => {
    if (controller && findReading(stallNo)) {
      openControllerInGrid(stallNo);
      return;
    }
    goController();
  };

  const controllerReading = controllerStallNo
    ? findReading(controllerStallNo)
    : null;

  useEffect(() => {
    if (level !== "stalls" || !controller) return;
    for (const stall of stalls) {
      prefetchControllerDetail(findReading(stall.stallNo) ?? undefined);
    }
  }, [level, controller, stalls, findReading]);

  if (controller && controllerStallNo && controllerReading) {
    return (
      <FlipEnter animKey={`ctrl-${stallTyCode}-${controllerStallNo}`} instant>
        <FarmMapControllerPanel
          reading={controllerReading}
          readings={controller.readings}
          thermoSettings={controller.thermoSettings}
          commands={controller.commands}
          canCommand={controller.canCommand}
          alarmSettings={controller.alarmSettings}
          label={`${stallTyCode}-${controllerStallNo}`}
          onBack={closeControllerInGrid}
        />
      </FlipEnter>
    );
  }

  const toolbar = (
    <div className="flex min-w-0 flex-col gap-2 border-b bg-muted/20 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {level === "stalls" ? (
          <button
            type="button"
            onClick={() => setLevel("sp")}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted sm:px-3"
          >
            <ArrowLeft className="size-4 shrink-0" />
            요약
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted sm:px-3"
          >
            <ArrowLeft className="size-4 shrink-0" />
            지도
          </button>
        )}
        <span className="shrink-0 rounded bg-emerald-50 px-2 py-0.5 text-sm font-semibold text-emerald-700">
          {stallTyCode}
        </span>
        <span className="min-w-0 truncate text-sm font-semibold sm:text-base">{label}</span>
        <span className="w-full text-xs text-muted-foreground sm:w-auto">
          {level === "sp" ? "SP 평균" : `축사 ${stalls.length}개`}
        </span>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div
          className="inline-flex max-w-full overflow-x-auto rounded-md border"
          role="group"
          aria-label="기간"
        >
          {PERIOD_ORDER.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                "shrink-0 px-2.5 py-1.5 text-sm transition-colors sm:px-3",
                period === p ? "bg-emerald-50 text-emerald-700" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {TREND_PERIODS[p].label}
            </button>
          ))}
        </div>
        <div className="inline-flex shrink-0 overflow-hidden rounded-md border" role="group" aria-label="그래프 형태">
          {(["line", "bar"] as ChartMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "px-2.5 py-1.5 text-sm transition-colors sm:px-3",
                mode === m ? "bg-emerald-50 text-emerald-700" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {m === "line" ? "선형" : "막대"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const actionRow = (primaryLabel: string, onPrimary: () => void) => (
    <div className="mt-2.5 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onPrimary}
        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
      >
        {primaryLabel}
        <ChevronRight className="size-4" />
      </button>
    </div>
  );

  let body: React.ReactNode;
  if (trendStatus === "loading") {
    body = (
      <div
        className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground"
        data-audit-region="farm-map-graph-loading"
      >
        <Loader2 className="size-5 animate-spin text-emerald-600" aria-hidden />
        <p>추이 데이터 불러오는 중…</p>
      </div>
    );
  } else if (trendStatus === "error") {
    body = (
      <div
        className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center text-sm text-muted-foreground"
        data-audit-region="farm-map-graph-error"
      >
        <p>추이 데이터를 불러오지 못했습니다.</p>
        {onTrendRetry ? (
          <button
            type="button"
            onClick={onTrendRetry}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          >
            다시 시도
          </button>
        ) : null}
      </div>
    );
  } else if (!sp || !spAvg || stalls.length === 0) {
    body = (
      <div
        className="px-4 py-10 text-center text-sm text-muted-foreground"
        data-audit-region="farm-map-graph-empty"
      >
        {hasLiveSnapshot
          ? "LIVE는 수신 중입니다. 추이 집계 데이터가 아직 없습니다."
          : "선택한 기간에 수신된 데이터가 없습니다."}
      </div>
    );
  } else if (level === "sp") {
    body = (
      <div
        key={`sp-${period}-${mode}`}
        className="grid grid-cols-1 gap-3 p-3 max-lg:pb-6 lg:grid-cols-2"
      >
        <Enter animKey={`env-${period}-${mode}`} delay={0}>
          <div className="rounded-lg border bg-background p-3">
            <p className="pb-1.5 text-sm font-semibold">환경 (온·습)</p>
            <TrendChart
              mode={mode}
              categories={categories}
              series={envSeriesOf(spAvg)}
              leftUnit="°C"
              rightUnit="%"
              leftDomain={spEnvScale.leftDomain}
              referenceLines={spEnvScale.referenceLines}
              rightDomain={[0, 100]}
              height={240}
            />
            {actionRow("축사번호별", () => setLevel("stalls"))}
          </div>
        </Enter>
        <Enter animKey={`fan-${period}-${mode}`} delay={0.08}>
          <div className="rounded-lg border bg-background p-3">
            <p className="pb-1.5 text-sm font-semibold">장비 (송·배·입)</p>
            <TrendChart
              mode={mode}
              categories={categories}
              series={fanSeriesOf(spAvg)}
              leftUnit="%"
              leftDomain={[0, 100]}
              height={240}
            />
            {actionRow("축사번호별", () => setLevel("stalls"))}
          </div>
        </Enter>
      </div>
    );
  } else {
    body = (
      <div
        key={`stalls-${period}-${mode}`}
        className="grid grid-cols-1 gap-3 p-3 pb-6 sm:grid-cols-2 lg:grid-cols-3 lg:pb-3"
      >
        {stalls.map((stall) => {
          const stallReading = findReading(stall.stallNo);
          const stallEnvScale = envChartScale(
            controller?.alarmSettings,
            stallReading
          );
          return (
          <div key={stall.stallNo} className="rounded-lg border bg-background p-3">
              <p className="pb-1.5 text-sm font-semibold">
                {stallTyCode}-{stall.stallNo}
              </p>
              <span className="text-xs text-muted-foreground">환경 (온·습)</span>
              <TrendChart
                mode={mode}
                categories={categories}
                series={envSeriesOf(stall)}
                leftUnit="°C"
                rightUnit="%"
                leftDomain={stallEnvScale.leftDomain}
                referenceLines={stallEnvScale.referenceLines}
                rightDomain={[0, 100]}
                height={160}
              />
              <span className="mt-1.5 block text-xs text-muted-foreground">장비 (송·배·입)</span>
              <TrendChart
                mode={mode}
                categories={categories}
                series={fanSeriesOf(stall)}
                leftUnit="%"
                leftDomain={[0, 100]}
                height={140}
              />
              <div className="mt-2.5">
                {(() => {
                  const inGrid = Boolean(controller && findReading(stall.stallNo));
                  return (
                    <button
                      type="button"
                      onClick={() => openController(stall.stallNo)}
                      onMouseEnter={() =>
                        prefetchControllerDetail(findReading(stall.stallNo) ?? undefined)
                      }
                      onFocus={() =>
                        prefetchControllerDetail(findReading(stall.stallNo) ?? undefined)
                      }
                      disabled={!inGrid && !controllerHref}
                      className="inline-flex items-center gap-1 rounded-md border px-3.5 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
                    >
                      컨트롤러
                      {inGrid ? (
                        <SlidersHorizontal className="size-4" />
                      ) : (
                        <ExternalLink className="size-4" />
                      )}
                    </button>
                  );
                })()}
              </div>
          </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border bg-card">
      {toolbar}
      {body}
    </div>
  );
}
