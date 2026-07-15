"use client";

import {
  buildGaugeFillSegments,
  setpointBandPct,
} from "@/lib/farm/controller-summary-display";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import { Bell, Droplets, Fan, Thermometer } from "lucide-react";

type GaugeMetricProps = {
  label: "온도" | "습도";
  value: number | null;
  displayValue: string;
  unit: string;
  low: number;
  high: number;
  offline: boolean;
  breached: boolean;
  setpoint?: number;
  setDev?: number;
  className?: string;
};

const TEXT_ACCENT = {
  온도: "text-orange-600 dark:text-orange-400",
  습도: "text-sky-600 dark:text-sky-400",
} as const;

const FILL_ACCENT = {
  온도: "bg-orange-500",
  습도: "bg-sky-500",
} as const;

/** 안3 — value pill + icon watermark (overlay 폐기) */
function ValuePillBadge({
  icon: Icon,
  label,
  accentClass,
  ariaLabel,
  compact,
}: {
  icon: typeof Bell;
  label: string;
  accentClass: string;
  ariaLabel: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-md border border-border bg-muted/60",
        compact ? "h-5 min-w-8 px-0.5" : "h-[22px] min-w-8 px-1"
      )}
      aria-label={ariaLabel}
    >
      <Icon
        className={cn(
          "pointer-events-none absolute text-muted-foreground opacity-[0.22]",
          compact ? "size-4" : "size-[18px]"
        )}
        strokeWidth={2}
        aria-hidden
      />
      <span
        className={cn(
          "relative z-[1] font-bold tabular-nums leading-none",
          compact ? "text-[10px]" : "text-[11px]",
          accentClass
        )}
      >
        {label}
      </span>
    </div>
  );
}

function BellBadge({
  value,
  unit,
  accentClass,
  ariaLabel,
  compact,
}: {
  value: string;
  unit: string;
  accentClass: string;
  ariaLabel: string;
  compact?: boolean;
}) {
  return (
    <ValuePillBadge
      icon={Bell}
      label={`${value}${unit}`}
      accentClass={accentClass}
      ariaLabel={ariaLabel}
      compact={compact}
    />
  );
}

function FanBadge({
  value,
  unit,
  ariaLabel,
  compact,
}: {
  value: string;
  unit: string;
  ariaLabel: string;
  compact?: boolean;
}) {
  return (
    <ValuePillBadge
      icon={Fan}
      label={`${value}${unit}`}
      accentClass="text-sky-600 dark:text-sky-400"
      ariaLabel={ariaLabel}
      compact={compact}
    />
  );
}

/** 환기안1 — 채널 칸 하단 FanBadge flanking + range bar */
export function VentGaugeV1({
  min,
  max,
  compact,
  className,
}: {
  min: number;
  max: number;
  compact?: boolean;
  className?: string;
}) {
  const span = Math.max(max - min, 0);
  return (
    <div className={cn("flex min-w-0 items-center gap-1 sm:gap-1.5", className)}>
      <FanBadge
        value={String(min)}
        unit="%"
        ariaLabel={`최저환기 ${min}%`}
        compact={compact}
      />
      <div
        className={cn(
          "relative min-w-0 flex-1 overflow-hidden rounded-full bg-muted/50",
          compact ? "h-1" : "h-1.5"
        )}
        role="img"
        aria-label={`환기 ${min}–${max}%`}
      >
        <div
          className="absolute inset-y-0 rounded-full bg-sky-500/45"
          style={{ left: `${min}%`, width: `${span}%` }}
          aria-hidden
        />
      </div>
      <FanBadge
        value={String(max)}
        unit="%"
        ariaLabel={`최고환기 ${max}%`}
        compact={compact}
      />
    </div>
  );
}

function buildGaugeAriaLabel({
  label,
  displayValue,
  unit,
  low,
  high,
  setpoint,
  setDev,
}: {
  label: "온도" | "습도";
  displayValue: string;
  unit: string;
  low: number;
  high: number;
  setpoint?: number;
  setDev?: number;
}): string {
  const parts = [`${label} ${displayValue}${unit}`, `알람 ${low}–${high}${unit}`];
  if (label === "온도" && setpoint != null && setDev != null) {
    parts.push(`설정 ${setpoint}±${setDev}${unit}`);
  }
  return parts.join(" · ");
}

function MetricValue({
  label,
  displayValue,
  unit,
  offline,
  breached,
  compact,
}: Pick<GaugeMetricProps, "label" | "displayValue" | "unit" | "offline" | "breached"> & {
  compact?: boolean;
}) {
  const accent = TEXT_ACCENT[label];
  const Icon = label === "온도" ? Thermometer : Droplets;

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Icon className={cn("size-4 shrink-0", accent)} aria-hidden />
      <span
        className={cn(
          "font-bold tabular-nums",
          compact ? "text-base" : dashboardUi.valueLg,
          offline
            ? "text-muted-foreground"
            : breached
              ? "text-amber-700 dark:text-amber-400"
              : accent
        )}
      >
        {displayValue}
        {displayValue !== "—" ? unit : null}
      </span>
    </div>
  );
}

/** 카드 게이지 — metric 아이콘 + BellBadge flanking + 설정 밴드(온도) */
export function CardMetricGauge({
  label,
  value,
  displayValue,
  unit,
  low,
  high,
  offline,
  breached,
  setpoint,
  setDev,
  className,
  compact,
  showValue = true,
  barClassName,
}: GaugeMetricProps & {
  compact?: boolean;
  /** false — 게이지 트랙만 (EnvMetricPanel 등) */
  showValue?: boolean;
  barClassName?: string;
}) {
  const { span, cur, rest, pct } = buildGaugeFillSegments(value, low, high, offline);
  const band =
    label === "온도" && setpoint != null && setDev != null
      ? setpointBandPct(setpoint, setDev, low, high)
      : null;
  const curPct = span > 0 ? (cur / span) * 100 : 0;
  const accent = TEXT_ACCENT[label];
  const lowStr = String(low);
  const highStr = String(high);
  const ariaLabel = buildGaugeAriaLabel({
    label,
    displayValue,
    unit,
    low,
    high,
    setpoint,
    setDev,
  });

  return (
    <div className={cn("min-w-0", className)}>
      {showValue ? (
        <div className="mb-1.5 flex min-w-0 items-center gap-1.5">
          <MetricValue
            label={label}
            displayValue={displayValue}
            unit={unit}
            offline={offline}
            breached={breached}
            compact={compact}
          />
        </div>
      ) : null}

      <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
        <BellBadge
          value={lowStr}
          unit={unit}
          accentClass={accent}
          ariaLabel={`알람 하한 ${low}${unit}`}
          compact={compact}
        />
        <div
          className={cn(
            "relative min-w-0 flex-1 overflow-hidden rounded-md border bg-muted/40",
            compact ? "h-2.5" : "h-3",
            barClassName
          )}
          role="img"
          aria-label={ariaLabel}
        >
          {band ? (
            <div
              className="pointer-events-none absolute inset-y-0 z-[1] rounded-sm bg-violet-500/40 ring-1 ring-inset ring-violet-600/45"
              style={{ left: `${band.left}%`, width: `${band.width}%` }}
              aria-hidden
            />
          ) : null}
          {!offline && cur > 0 ? (
            <div
              className={cn(
                "absolute inset-y-0 left-0 z-[0] rounded-md",
                breached ? "bg-amber-500" : FILL_ACCENT[label]
              )}
              style={{ width: `${curPct}%` }}
            />
          ) : null}
          {!offline && rest > 0 ? (
            <div className="absolute inset-y-0 right-0 bg-muted/20" style={{ width: `${100 - curPct}%` }} />
          ) : null}
          {offline ? <div className="absolute inset-0 bg-muted/40" aria-hidden /> : null}
          {pct != null && !offline ? (
            <div
              className="absolute top-[-1px] z-[2] h-3.5 w-2.5 rounded-full bg-foreground"
              style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
              aria-hidden
            />
          ) : null}
        </div>
        <BellBadge
          value={highStr}
          unit={unit}
          accentClass={accent}
          ariaLabel={`알람 상한 ${high}${unit}`}
          compact={compact}
        />
      </div>
    </div>
  );
}

type EnvMetricPanelProps = {
  temp: Pick<GaugeMetricProps, "value" | "displayValue" | "low" | "high" | "breached">;
  humidity: Pick<GaugeMetricProps, "value" | "displayValue" | "low" | "high" | "breached">;
  offline: boolean;
  setpoint?: number;
  setDev?: number;
  className?: string;
};

/** 안 A — 온·습도 통합 패널: 값 1줄 + full-width 게이지 2단 */
export function EnvMetricPanel({
  temp,
  humidity,
  offline,
  setpoint,
  setDev,
  className,
}: EnvMetricPanelProps) {
  return (
    <div className={cn("rounded-lg border bg-muted/20 p-2 sm:p-2.5", className)}>
      <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
        <MetricValue
          label="온도"
          displayValue={temp.displayValue}
          unit="℃"
          offline={offline}
          breached={temp.breached}
          compact
        />
        <MetricValue
          label="습도"
          displayValue={humidity.displayValue}
          unit="%"
          offline={offline}
          breached={humidity.breached}
          compact
        />
      </div>
      <div className="space-y-2">
        <CardMetricGauge
          compact
          showValue={false}
          barClassName="h-3"
          label="온도"
          value={temp.value}
          displayValue={temp.displayValue}
          unit="℃"
          low={temp.low}
          high={temp.high}
          offline={offline}
          breached={temp.breached}
          setpoint={setpoint}
          setDev={setDev}
        />
        <CardMetricGauge
          compact
          showValue={false}
          label="습도"
          value={humidity.value}
          displayValue={humidity.displayValue}
          unit="%"
          low={humidity.low}
          high={humidity.high}
          offline={offline}
          breached={humidity.breached}
        />
      </div>
    </div>
  );
}
