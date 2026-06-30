"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { ArrowLeft, ExternalLink, ChevronRight, SlidersHorizontal } from "lucide-react";
import { useAppNavigate } from "@/components/layout/use-app-navigate";
import { TrendChart, type TrendSeries } from "@/components/trends/trend-chart";
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
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import { cn } from "@/lib/utils";

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
function FlipEnter({ children, animKey }: { children: React.ReactNode; animKey: string }) {
  const reduced = usePrefersReducedMotion();
  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || reduced || typeof node.animate !== "function") return;
      node.animate(
        [
          { opacity: 0, transform: "perspective(1200px) rotateY(90deg)" },
          { opacity: 1, transform: "perspective(1200px) rotateY(0deg)" },
        ],
        { duration: 360, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)", fill: "backwards" }
      );
    },
    [reduced]
  );
  return (
    <div key={animKey} ref={ref} className="h-full" style={{ transformStyle: "preserve-3d" }}>
      {children}
    </div>
  );
}

type Level = "sp" | "stalls";

type Props = {
  stallTyCode: string;
  label: string;
  dataByPeriod: Record<TrendPeriodId, TrendPeriodData> | null;
  controllerHref: string | null;
  controller?: ControllerGridData | null;
  onClose: () => void;
};

export function FarmMapGraphStage({
  stallTyCode,
  label,
  dataByPeriod,
  controllerHref,
  controller,
  onClose,
}: Props) {
  const [level, setLevel] = useState<Level>("sp");
  const [period, setPeriod] = useState<TrendPeriodId>("24h");
  const [mode, setMode] = useState<ChartMode>("bar");
  const [controllerStallNo, setControllerStallNo] = useState<string | null>(null);
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

  const goController = () => {
    if (!controllerHref) return;
    navigate(controllerHref, { message: "컨트롤러 페이지로 이동 중…" });
  };

  /** in-grid 데이터가 있으면 카드플립, 없으면 페이지 이동(폴백). */
  const openController = (stallNo: string) => {
    if (controller && findReading(stallNo)) {
      setControllerStallNo(stallNo);
      return;
    }
    goController();
  };

  const controllerReading = controllerStallNo
    ? findReading(controllerStallNo)
    : null;

  if (controller && controllerStallNo && controllerReading) {
    return (
      <FlipEnter animKey={`ctrl-${stallTyCode}-${controllerStallNo}`}>
        <FarmMapControllerPanel
          reading={controllerReading}
          readings={controller.readings}
          thermoSettings={controller.thermoSettings}
          commands={controller.commands}
          canCommand={controller.canCommand}
          alarmSettings={controller.alarmSettings}
          label={`${stallTyCode}-${controllerStallNo}`}
          onBack={() => setControllerStallNo(null)}
        />
      </FlipEnter>
    );
  }

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/20 px-3 py-2">
      <div className="flex items-center gap-2">
        {level === "stalls" ? (
          <button
            type="button"
            onClick={() => setLevel("sp")}
            className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
            요약
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
            지도
          </button>
        )}
        <span className="rounded bg-emerald-50 px-2 py-0.5 text-sm font-semibold text-emerald-700">
          {stallTyCode}
        </span>
        <span className="text-base font-semibold">{label}</span>
        <span className="text-xs text-muted-foreground">
          {level === "sp" ? "SP 평균" : `축사 ${stalls.length}개`}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-md border" role="group" aria-label="기간">
          {PERIOD_ORDER.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                "px-3 py-1.5 text-sm transition-colors",
                period === p ? "bg-emerald-50 text-emerald-700" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {TREND_PERIODS[p].label}
            </button>
          ))}
        </div>
        <div className="inline-flex overflow-hidden rounded-md border" role="group" aria-label="그래프 형태">
          {(["line", "bar"] as ChartMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "px-3 py-1.5 text-sm transition-colors",
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
      <button
        type="button"
        onClick={goController}
        disabled={!controllerHref}
        className="inline-flex items-center gap-1 rounded-md border px-3.5 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
      >
        컨트롤러
        <ExternalLink className="size-4" />
      </button>
    </div>
  );

  let body: React.ReactNode;
  if (!sp || !spAvg || stalls.length === 0) {
    body = (
      <div className="px-4 py-10 text-center text-sm text-muted-foreground">
        선택한 기간에 수신된 데이터가 없습니다.
      </div>
    );
  } else if (level === "sp") {
    body = (
      <div
        key={`sp-${period}-${mode}`}
        className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-2"
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
        className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {stalls.map((stall, i) => (
          <Enter key={stall.stallNo} animKey={`${stall.stallNo}-${period}-${mode}`} delay={i * 0.06}>
            <div className="rounded-lg border bg-background p-3">
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
          </Enter>
        ))}
      </div>
    );
  }

  return (
    <Enter animKey={`stage-${stallTyCode}`}>
      <div className="overflow-hidden rounded-md border bg-card">
        {toolbar}
        {body}
        <div className="border-t px-3 py-2 text-xs text-muted-foreground">
          출처: iot_room_state_decoded · LIVE · {level === "sp" ? "SP 평균" : "축사번호별"} · 환기=max(입기,배기) 미적용(개별 표시)
        </div>
      </div>
    </Enter>
  );
}
