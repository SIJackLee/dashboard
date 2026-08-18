"use client";

import { useMemo } from "react";
import type { BarnReading } from "@/lib/data/iot";
import {
  pigEnvFitLabel,
  pigEnvFitOffBand,
  pigEnvTypeVerdicts,
  pigEnvWorstVerdict,
  type PigEnvFit,
  type PigEnvTypeVerdict,
} from "@/lib/farm/pig-env-recommend";
import {
  dashboardAriaShell,
  dashboardReadout,
} from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

function fmtTemp(v: number | null): string {
  if (v == null) return "—";
  return `${Number.isInteger(v) ? String(v) : v.toFixed(1)}°C`;
}

function fmtHum(v: number | null): string {
  if (v == null) return "—";
  return `${Math.round(v)}%`;
}

function fitToneClass(fit: PigEnvFit): string {
  if (fit === "ok") return "text-[var(--status-ok)]";
  if (pigEnvFitOffBand(fit)) return "text-[var(--status-warn)]";
  return "text-muted-foreground";
}

function FitChip({ fit }: { fit: PigEnvFit }) {
  return (
    <span
      className={cn(
        "rounded-md border px-1.5 py-0.5 text-[length:var(--density-meta)] font-medium",
        fit === "ok" &&
          "border-[color-mix(in_oklch,var(--status-ok)_35%,var(--border))] text-[var(--status-ok)]",
        pigEnvFitOffBand(fit) &&
          "border-[color-mix(in_oklch,var(--status-warn)_35%,var(--border))] text-[var(--status-warn)]",
        fit === "none" && "border-border/80 text-muted-foreground",
      )}
    >
      {pigEnvFitLabel(fit)}
    </span>
  );
}

function TypeRow({ v }: { v: PigEnvTypeVerdict }) {
  const off = pigEnvFitOffBand(v.tempFit) || pigEnvFitOffBand(v.humidityFit);
  return (
    <li
      className={cn(
        "rounded-lg border px-3 py-2.5",
        off
          ? "border-[color-mix(in_oklch,var(--status-warn)_28%,var(--border))] bg-muted/15"
          : "border-border/80 bg-muted/10",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 truncate text-[length:var(--density-section)] font-semibold text-foreground">
          {v.stallLabel}
        </p>
        <p className={dashboardReadout.label}>{v.stageLabel}</p>
      </div>
      <dl className="mt-2 space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <dt className={dashboardReadout.label}>온도</dt>
          <dd className="flex min-w-0 items-baseline gap-2">
            <span
              className={cn(dashboardReadout.value, fitToneClass(v.tempFit))}
            >
              {fmtTemp(v.tempAvgC)}
            </span>
            <FitChip fit={v.tempFit} />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className={dashboardReadout.label}>습도</dt>
          <dd className="flex min-w-0 items-baseline gap-2">
            <span
              className={cn(
                dashboardReadout.value,
                fitToneClass(v.humidityFit),
              )}
            >
              {fmtHum(v.humidityAvgPct)}
            </span>
            <FitChip fit={v.humidityFit} />
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-[length:var(--density-meta)] text-muted-foreground">
        권장 {fmtTemp(v.tempMinC)}~{fmtTemp(v.tempMaxC)} ·{" "}
        {fmtHum(v.humidityMinPct)}~{fmtHum(v.humidityMaxPct)}
      </p>
      {off ? (
        <p className="mt-1 text-[length:var(--density-meta)] text-[var(--status-warn)]">
          {pigEnvFitOffBand(v.tempFit) && v.recommendTempC != null
            ? `목표 온도 ${fmtTemp(v.recommendTempC)}`
            : null}
          {pigEnvFitOffBand(v.tempFit) &&
          pigEnvFitOffBand(v.humidityFit) &&
          v.recommendTempC != null &&
          v.recommendHumidityPct != null
            ? " · "
            : null}
          {pigEnvFitOffBand(v.humidityFit) && v.recommendHumidityPct != null
            ? `목표 습도 ${fmtHum(v.recommendHumidityPct)}`
            : null}
        </p>
      ) : null}
    </li>
  );
}

/** 델린 풀탭 — 축사유형 권장 온·습도 알림. 적용·닫기 없음. */
export function DelinPigEnvPanel({ readings }: { readings: BarnReading[] }) {
  const verdicts = useMemo(() => pigEnvTypeVerdicts(readings), [readings]);

  return (
    <section
      className={cn(
        dashboardAriaShell.metricsPanel,
        motionClass.enterFade,
        "min-h-0",
      )}
      data-testid="delin-pig-env-panel"
      aria-label="권장 환경"
    >
      <p className={dashboardAriaShell.metricsEyebrow}>축사유형 기준</p>
      <h2 className={dashboardAriaShell.metricsTitle}>권장 환경</h2>
      <p className={dashboardAriaShell.metricsBlurb}>
        지금값과 권장 띠를 비교합니다. 현장 확인용 알림이며 설정은 바꾸지
        않습니다.
      </p>
      {verdicts.length === 0 ? (
        <p className="mt-3 text-[length:var(--density-meta)] text-muted-foreground">
          권장 환경으로 볼 축사유형이 없습니다. LIVE 온·습도가 오면 유형마다
          비교합니다.
        </p>
      ) : (
        <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
          {verdicts.map((v) => (
            <TypeRow key={v.stallTyCode} v={v} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** 말하기·결과면 — 최악 유형 한 줄. */
export function DelinPigEnvStrip({ readings }: { readings: BarnReading[] }) {
  const worst = useMemo(() => {
    const rows = pigEnvTypeVerdicts(readings);
    return pigEnvWorstVerdict(rows);
  }, [readings]);

  let line = "권장 환경으로 볼 축사유형이 없습니다.";
  if (worst) {
    const off =
      pigEnvFitOffBand(worst.tempFit) || pigEnvFitOffBand(worst.humidityFit);
    if (!off) {
      line = "축사유형별 권장 온·습도 안에 있습니다.";
    } else {
      const bits: string[] = [];
      if (pigEnvFitOffBand(worst.tempFit)) {
        bits.push(
          `온도 ${pigEnvFitLabel(worst.tempFit)}${
            worst.recommendTempC != null
              ? ` · 목표 ${fmtTemp(worst.recommendTempC)}`
              : ""
          }`,
        );
      }
      if (pigEnvFitOffBand(worst.humidityFit)) {
        bits.push(
          `습도 ${pigEnvFitLabel(worst.humidityFit)}${
            worst.recommendHumidityPct != null
              ? ` · 목표 ${fmtHum(worst.recommendHumidityPct)}`
              : ""
          }`,
        );
      }
      line = `${worst.stallLabel} ${bits.join(" · ")}`;
    }
  }

  return (
    <p
      className={cn(
        "relative z-[2] shrink-0 border-b border-primary/15 px-3 py-2 text-center text-[length:var(--density-meta)] leading-snug md:px-4",
        worst &&
          (pigEnvFitOffBand(worst.tempFit) ||
            pigEnvFitOffBand(worst.humidityFit))
          ? "text-[var(--status-warn)]"
          : "text-muted-foreground",
      )}
      data-testid="delin-pig-env-strip"
    >
      <span className="font-medium text-foreground">권장 환경</span>
      {" · "}
      {line}
    </p>
  );
}
