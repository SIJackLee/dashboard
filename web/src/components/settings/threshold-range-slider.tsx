"use client";

import { useCallback, useId } from "react";
import {
  SliderThumbLabel,
  sliderTrackRailBgClass,
  sliderTrackRailClass,
  sliderTrackShellClass,
} from "@/components/ui/slider-thumb-label";
import {
  SliderValueInput,
  type SliderValueInputSize,
} from "@/components/ui/slider-value-input";
import { dashboardTypography, dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { useMobileLayout } from "@/lib/ui/use-mobile-layout";
import { useSliderDragThumb } from "@/lib/ui/use-slider-drag-thumb";
import { cn } from "@/lib/utils";

type ThresholdRangeSliderProps = {
  title: string;
  icon: React.ReactNode;
  min: number;
  max: number;
  step: number;
  low: number;
  high: number;
  unit: string;
  lowLabel?: string;
  highLabel?: string;
  disabled?: boolean;
  compact?: boolean;
  accentClass?: string;
  /** 트랙 양끝 축 — domain=정적 min/max, editable=하한·상한 입력 */
  axisMode?: "hidden" | "domain" | "editable";
  /** @deprecated axisMode="domain" 사용 */
  showAxis?: boolean;
  /** axisMode editable 시 Input 크기 */
  axisInputSize?: SliderValueInputSize;
  /** thumb 라벨 typography 오버라이드 (예: 다른 slider와 크기 동기화) */
  thumbLabelClassName?: string;
  /** 헤더 제목 typography 오버라이드 */
  titleClassName?: string;
  /** showAxis 축 라벨 typography 오버라이드 */
  axisClassName?: string;
  /** 카드/보더 래퍼 없이 트랙만 (섹션 내부 embed) */
  bare?: boolean;
  /** 트랙 shell padding 오버라이드 */
  trackShellClassName?: string;
  onChange: (low: number, high: number) => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function snap(n: number, step: number) {
  const s = 1 / step;
  return Math.round(n * s) / s;
}

function pct(value: number, min: number, max: number) {
  if (max <= min) return 0;
  return ((value - min) / (max - min)) * 100;
}

function fmtValue(value: number, step: number) {
  if (step >= 1) return String(Math.round(value));
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** 상·하한 — dual-thumb range (허용 구간) */
export function ThresholdRangeSlider({
  title,
  icon,
  min,
  max,
  step,
  low,
  high,
  unit,
  lowLabel = "하한",
  highLabel = "상한",
  disabled = false,
  compact = false,
  accentClass = "bg-emerald-500/35",
  axisMode,
  showAxis = false,
  axisInputSize,
  thumbLabelClassName,
  titleClassName,
  axisClassName,
  bare = false,
  trackShellClassName,
  onChange,
}: ThresholdRangeSliderProps) {
  const id = useId();
  const mobile = useMobileLayout();
  const { dragThumb, dragging, onLowPointerDown, onHighPointerDown } =
    useSliderDragThumb();
  const lowPct = pct(low, min, max);
  const highPct = pct(high, min, max);
  const lowText = `${fmtValue(low, step)}${unit}`;
  const highText = `${fmtValue(high, step)}${unit}`;
  const mobileDrag = mobile && dragging;
  const resolvedAxisMode = axisMode ?? (showAxis ? "domain" : "hidden");
  const inputSize = axisInputSize ?? (compact ? "compact" : "dashboard");

  const setLow = useCallback(
    (raw: number) => {
      const next = snap(clamp(raw, min, max), step);
      if (next > high) onChange(high, next);
      else onChange(next, high);
    },
    [high, max, min, onChange, step]
  );

  const setHigh = useCallback(
    (raw: number) => {
      const next = snap(clamp(raw, min, max), step);
      if (next < low) onChange(next, low);
      else onChange(low, next);
    },
    [low, max, min, onChange, step]
  );

  const rangeClass = cn(
    "threshold-dual-range absolute inset-0 h-full w-full appearance-none bg-transparent",
    disabled && "pointer-events-none opacity-40"
  );

  return (
    <div
      className={cn(
        bare
          ? undefined
          : compact
            ? dashboardUi.opsSideInnerCard
            : cn(dashboardUi.innerCard, "bg-background"),
        disabled && "pointer-events-none opacity-50"
      )}
    >
      <div className={cn("flex items-center gap-2", compact ? "mb-2" : "mb-3")}>
        {icon}
        <p
          className={cn(
            titleClassName ??
              (compact ? "text-sm font-medium" : dashboardTypography.sectionTitle),
            "text-foreground"
          )}
        >
          {title}
        </p>
      </div>

      <div
        className={cn(
          sliderTrackShellClass(compact),
          mobileDrag && "max-md:pt-11",
          trackShellClassName
        )}
      >
        <div className={sliderTrackRailClass()}>
          <SliderThumbLabel
            leftPct={lowPct}
            compact={compact}
            className={thumbLabelClassName}
            visible={!mobileDrag || dragThumb !== "high"}
            magnified={mobileDrag && dragThumb === "low"}
          >
            {lowText}
          </SliderThumbLabel>
          <SliderThumbLabel
            leftPct={highPct}
            compact={compact}
            className={thumbLabelClassName}
            visible={!mobileDrag || dragThumb !== "low"}
            magnified={mobileDrag && dragThumb === "high"}
          >
            {highText}
          </SliderThumbLabel>
          <div className={sliderTrackRailBgClass()} aria-hidden />
          <div
            className={cn(
              "pointer-events-none absolute top-0 h-full rounded-full",
              accentClass
            )}
            aria-hidden
            style={{
              left: `${lowPct}%`,
              width: `${Math.max(0, highPct - lowPct)}%`,
            }}
          />
          <input
            id={`${id}-low`}
            type="range"
            min={min}
            max={max}
            step={step}
            value={low}
            disabled={disabled}
            aria-label={`${title} ${lowLabel}`}
            aria-valuetext={lowText}
            className={cn(rangeClass, "z-[3]")}
            onPointerDown={onLowPointerDown}
            onChange={(e) => setLow(Number(e.target.value))}
          />
          <input
            id={`${id}-high`}
            type="range"
            min={min}
            max={max}
            step={step}
            value={high}
            disabled={disabled}
            aria-label={`${title} ${highLabel}`}
            aria-valuetext={highText}
            className={cn(rangeClass, "z-[4]")}
            onPointerDown={onHighPointerDown}
            onChange={(e) => setHigh(Number(e.target.value))}
          />
        </div>
      </div>

      {resolvedAxisMode !== "hidden" ? (
        <div
          className={cn(
            "relative mt-1 flex items-end justify-between gap-2 px-3 sm:px-4 tabular-nums",
            axisClassName ??
              (compact
                ? "text-xs leading-snug text-muted-foreground"
                : dashboardTypography.meta)
          )}
        >
          {resolvedAxisMode === "editable" ? (
            <SliderValueInput
              value={low}
              min={min}
              max={high}
              step={step}
              unit={unit}
              aria-label={`${title} ${lowLabel}`}
              disabled={disabled}
              size={inputSize}
              onCommit={setLow}
            />
          ) : (
            <span aria-hidden>
              {min}
              {unit}
            </span>
          )}
          {resolvedAxisMode === "editable" ? (
            <span
              className="mb-1 shrink-0 text-center text-muted-foreground"
              aria-hidden
            >
              {min}–{max}
              {unit}
            </span>
          ) : null}
          {resolvedAxisMode === "editable" ? (
            <SliderValueInput
              value={high}
              min={low}
              max={max}
              step={step}
              unit={unit}
              aria-label={`${title} ${highLabel}`}
              disabled={disabled}
              size={inputSize}
              onCommit={setHigh}
            />
          ) : (
            <span aria-hidden>
              {max}
              {unit}
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
