"use client";

import { CompactLineChart } from "@/components/common/compact-line-chart";
import type { HorizontalBarItem } from "@/components/common/horizontal-bar-chart";
import type { AriaMetricsSnapshot } from "@/app/(dashboard)/farm/aria-metrics-actions";
import { dashboardAriaShell } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

const SLIDE_IDS = ["env", "graph", "status"] as const;
type SlideId = (typeof SLIDE_IDS)[number];

const SLIDE_LABEL: Record<SlideId, string> = {
  env: "환경",
  graph: "그래프",
  status: "현황",
};

type Props = {
  facts: AriaMetricsSnapshot | null;
  loading?: boolean;
  error?: string | null;
  emphasized?: boolean;
  className?: string;
};

function avgNullable(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function formatTemp(v: number | null): string {
  return v == null ? "—" : `${v.toFixed(1)}°C`;
}

function formatHum(v: number | null): string {
  return v == null ? "—" : `${Math.round(v)}%`;
}

/**
 * 지표 슬라이드 — LIVE facts 바인딩 (암모니아 없음).
 */
export function AriaMetricsSlides({
  facts,
  loading = false,
  error = null,
  emphasized = false,
  className,
}: Props) {
  const [index, setIndex] = useState(0);
  const slideId = SLIDE_IDS[index] ?? "env";

  const farmTemp = useMemo(() => {
    if (!facts) return null;
    return avgNullable(
      facts.stalls
        .map((s) => s.tempAvgC)
        .filter((v): v is number => v != null),
    );
  }, [facts]);

  const farmHum = useMemo(() => {
    if (!facts) return null;
    return avgNullable(
      facts.stalls
        .map((s) => s.humidityAvgPct)
        .filter((v): v is number => v != null),
    );
  }, [facts]);

  const tempSeries: HorizontalBarItem[] = useMemo(() => {
    if (!facts) return [];
    return facts.stalls.map((s) => ({
      id: s.stallTyCode,
      label: s.stallLabel,
      value: s.tempAvgC,
    }));
  }, [facts]);

  const humSeries: HorizontalBarItem[] = useMemo(() => {
    if (!facts) return [];
    return facts.stalls.map((s) => ({
      id: s.stallTyCode,
      label: s.stallLabel,
      value: s.humidityAvgPct,
    }));
  }, [facts]);

  return (
    <div
      className={cn(dashboardAriaShell.metricsPanel, className)}
      data-testid="aria-metrics-slides"
      data-emphasized={emphasized ? "1" : "0"}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={dashboardAriaShell.metricsEyebrow}>실시간 지표</p>
        <div className="flex gap-1">
          {SLIDE_IDS.map((id, i) => (
            <button
              key={id}
              type="button"
              aria-label={`${SLIDE_LABEL[id]} 슬라이드`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors",
                i === index ? "bg-primary" : "bg-muted-foreground/35",
              )}
            />
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <h3 className={dashboardAriaShell.metricsTitle}>
          {SLIDE_LABEL[slideId]}
        </h3>
        <div className="flex gap-1">
          <button
            type="button"
            className={dashboardAriaShell.metricsNavBtn}
            aria-label="이전 슬라이드"
            onClick={() =>
              setIndex((i) => (i - 1 + SLIDE_IDS.length) % SLIDE_IDS.length)
            }
          >
            ‹
          </button>
          <button
            type="button"
            className={dashboardAriaShell.metricsNavBtn}
            aria-label="다음 슬라이드"
            onClick={() => setIndex((i) => (i + 1) % SLIDE_IDS.length)}
          >
            ›
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-2 text-[11px] text-destructive">{error}</p>
      ) : null}
      {loading && !facts ? (
        <p className="mt-2 text-[11px] text-muted-foreground">불러오는 중…</p>
      ) : null}

      <div
        className={cn(
          "mt-3 min-h-0 flex-1",
          dashboardAriaShell.metricsSlideBody,
          !emphasized && "opacity-90",
        )}
        key={slideId}
      >
        {slideId === "env" ? (
          <EnvSlide
            temp={farmTemp}
            hum={farmHum}
            stalls={facts?.stalls ?? []}
          />
        ) : null}
        {slideId === "graph" ? (
          <GraphSlide tempSeries={tempSeries} humSeries={humSeries} />
        ) : null}
        {slideId === "status" ? (
          <StatusSlide facts={facts} />
        ) : null}
      </div>

      {facts ? (
        <p className="mt-2 text-[10px] text-muted-foreground/80">
          {new Date(facts.generatedAt).toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          })}{" "}
          기준
        </p>
      ) : null}
    </div>
  );
}

function EnvSlide({
  temp,
  hum,
  stalls,
}: {
  temp: number | null;
  hum: number | null;
  stalls: AriaMetricsSnapshot["stalls"];
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <MetricTile label="평균 온도" value={formatTemp(temp)} />
        <MetricTile label="평균 습도" value={formatHum(hum)} />
      </div>
      {stalls.length > 0 ? (
        <ul className="max-h-28 space-y-1 overflow-y-auto text-[11px] text-muted-foreground">
          {stalls.map((s) => (
            <li
              key={s.stallTyCode}
              className="flex justify-between gap-2 border-b border-border/40 py-1 last:border-0"
            >
              <span className="truncate text-foreground/90">{s.stallLabel}</span>
              <span className="shrink-0 tabular-nums">
                {formatTemp(s.tempAvgC)} · {formatHum(s.humidityAvgPct)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-muted-foreground">축사 데이터 없음</p>
      )}
    </div>
  );
}

function GraphSlide({
  tempSeries,
  humSeries,
}: {
  tempSeries: HorizontalBarItem[];
  humSeries: HorizontalBarItem[];
}) {
  if (tempSeries.length === 0 && humSeries.length === 0) {
    return (
      <p className="py-4 text-center text-[11px] text-muted-foreground">
        표시할 추이 데이터가 없습니다
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1 text-[10px] font-medium text-muted-foreground">
          축사별 온도
        </p>
        <CompactLineChart
          items={tempSeries}
          unit="°C"
          height={72}
          strokeClassName="stroke-channel-temp"
          fillClassName="fill-channel-temp/10"
          showSummary={false}
          emptyLabel="온도 없음"
        />
      </div>
      <div>
        <p className="mb-1 text-[10px] font-medium text-muted-foreground">
          축사별 습도
        </p>
        <CompactLineChart
          items={humSeries}
          unit="%"
          height={72}
          strokeClassName="stroke-channel-hum"
          fillClassName="fill-channel-hum/10"
          showSummary={false}
          emptyLabel="습도 없음"
        />
      </div>
    </div>
  );
}

function StatusSlide({ facts }: { facts: AriaMetricsSnapshot | null }) {
  if (!facts) {
    return (
      <p className="py-4 text-center text-[11px] text-muted-foreground">
        현황을 불러오세요
      </p>
    );
  }
  const topAlarms = facts.alarmItems.slice(0, 4);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <MetricTile
          label="컨트롤러"
          value={`${facts.onlineControllers}/${facts.totalControllers}`}
        />
        <MetricTile
          label="이상"
          value={String(facts.alarmTotal)}
          tone={facts.alarmCritical > 0 ? "danger" : facts.alarmTotal > 0 ? "warn" : "ok"}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        위험 {facts.alarmCritical} · 주의 {facts.alarmWarning} · 오프라인{" "}
        {facts.offlineControllers}
      </p>
      {topAlarms.length > 0 ? (
        <ul className="max-h-28 space-y-1 overflow-y-auto text-[11px]">
          {topAlarms.map((a) => (
            <li
              key={`${a.controllerKey}-${a.alarmType}`}
              className="border-b border-border/40 py-1 last:border-0"
            >
              <span
                className={cn(
                  "mr-1 font-medium",
                  a.severity === "critical"
                    ? "text-destructive"
                    : "text-status-warn",
                )}
              >
                {a.severity === "critical" ? "위험" : "주의"}
              </span>
              <span className="text-foreground/90">
                {a.stallLabel} {a.controllerLabel}
              </span>
              <span className="text-muted-foreground"> · {a.alarmType}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-muted-foreground">활성 이상 없음</p>
      )}
    </div>
  );
}

function MetricTile({
  label,
  value,
  tone = "ok",
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "danger";
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/25 px-2.5 py-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-base font-semibold tabular-nums tracking-tight",
          tone === "danger" && "text-destructive",
          tone === "warn" && "text-status-warn",
          tone === "ok" && "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}
