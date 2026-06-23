"use client";

import { useCallback, useId } from "react";
import { Thermometer } from "lucide-react";
import { clampMenuValue } from "@/lib/controllers/controller-panel-map";
import {
  fmtTempLabel,
  SliderThumbLabel,
  sliderTrackRailBgClass,
  sliderTrackRailClass,
  sliderTrackShellClass,
} from "@/components/ui/slider-thumb-label";
import { dashboardTypography, dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

const TRACK_MIN = 15;
const TRACK_MAX = 35;
const STEP = 0.5;

type ControllerTempTripleSliderProps = {
  setpoint: number;
  deviation: number;
  disabled?: boolean;
  compact?: boolean;
  dense?: boolean;
  /** ThresholdRangeSlider와 동일 카드 헤더 */
  framed?: boolean;
  title?: string;
  onChange: (setpoint: number, deviation: number) => void;
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

function maxDeviationForSetpoint(setpoint: number) {
  return Math.min(5, setpoint - TRACK_MIN, TRACK_MAX - setpoint);
}

/** 설정온도(중앙) + 좌·우 편차 핸들 — triple-thumb */
export function ControllerTempTripleSlider({
  setpoint,
  deviation,
  disabled = false,
  compact = false,
  dense = false,
  framed = false,
  title = "온도 설정",
  onChange,
}: ControllerTempTripleSliderProps) {
  const id = useId();
  const low = setpoint - deviation;
  const high = setpoint + deviation;
  const lowPct = pct(low, TRACK_MIN, TRACK_MAX);
  const highPct = pct(high, TRACK_MIN, TRACK_MAX);
  const centerPct = pct(setpoint, TRACK_MIN, TRACK_MAX);
  const devLabel = fmtTempLabel(deviation);

  const setLow = useCallback(
    (raw: number) => {
      const nextLow = snap(clamp(raw, TRACK_MIN, setpoint - 0.5), STEP);
      const newDev = clampMenuValue("deviation", setpoint - nextLow);
      onChange(setpoint, newDev);
    },
    [onChange, setpoint]
  );

  const setCenter = useCallback(
    (raw: number) => {
      const newSp = clampMenuValue("setpoint", raw);
      const maxDev = maxDeviationForSetpoint(newSp);
      const newDev = clampMenuValue("deviation", Math.min(deviation, maxDev));
      onChange(newSp, newDev);
    },
    [deviation, onChange]
  );

  const setHigh = useCallback(
    (raw: number) => {
      const nextHigh = snap(clamp(raw, setpoint + 0.5, TRACK_MAX), STEP);
      const newDev = clampMenuValue("deviation", nextHigh - setpoint);
      onChange(setpoint, newDev);
    },
    [onChange, setpoint]
  );

  const edgeClass = cn(
    "threshold-triple-range threshold-triple-range-edge absolute inset-0 h-full w-full appearance-none bg-transparent",
    disabled && "pointer-events-none opacity-40"
  );
  const centerClass = cn(
    "threshold-triple-range threshold-triple-range-center absolute inset-0 h-full w-full appearance-none bg-transparent",
    disabled && "pointer-events-none opacity-40"
  );

  const track = (
    <div className={sliderTrackShellClass(compact, "triple", dense)}>
      <div className={sliderTrackRailClass()}>
        <SliderThumbLabel
          leftPct={lowPct}
          placement="below"
          compact={compact}
          dense={dense}
        >
          −{devLabel}℃
        </SliderThumbLabel>
        <SliderThumbLabel
          leftPct={centerPct}
          variant="center"
          placement="above"
          compact={compact}
          dense={dense}
        >
          {fmtTempLabel(setpoint)}℃
        </SliderThumbLabel>
        <SliderThumbLabel
          leftPct={highPct}
          placement="below"
          compact={compact}
          dense={dense}
        >
          +{devLabel}℃
        </SliderThumbLabel>
        <div className={sliderTrackRailBgClass()} aria-hidden />
        <div
          className="pointer-events-none absolute top-0 h-full rounded-full bg-orange-500/35"
          aria-hidden
          style={{
            left: `${lowPct}%`,
            width: `${Math.max(0, highPct - lowPct)}%`,
          }}
        />
        <input
          id={`${id}-low`}
          type="range"
          min={TRACK_MIN}
          max={TRACK_MAX}
          step={STEP}
          value={low}
          disabled={disabled}
          aria-label={`온도 편차 하한 −${devLabel}℃`}
          aria-valuetext={`−${devLabel}℃`}
          className={cn(edgeClass, "z-[3]")}
          onChange={(e) => setLow(Number(e.target.value))}
        />
        <input
          id={`${id}-center`}
          type="range"
          min={TRACK_MIN}
          max={TRACK_MAX}
          step={STEP}
          value={setpoint}
          disabled={disabled}
          aria-label={`설정온도 ${fmtTempLabel(setpoint)}℃`}
          aria-valuetext={`${fmtTempLabel(setpoint)}℃`}
          className={cn(centerClass, "z-[5]")}
          onChange={(e) => setCenter(Number(e.target.value))}
        />
        <input
          id={`${id}-high`}
          type="range"
          min={TRACK_MIN}
          max={TRACK_MAX}
          step={STEP}
          value={high}
          disabled={disabled}
          aria-label={`온도 편차 상한 +${devLabel}℃`}
          aria-valuetext={`+${devLabel}℃`}
          className={cn(edgeClass, "z-[4]")}
          onChange={(e) => setHigh(Number(e.target.value))}
        />
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        framed ? dashboardUi.opsSideInnerCard : undefined,
        disabled && "pointer-events-none opacity-50"
      )}
    >
      {framed ? (
        <div className={cn("flex items-center gap-2", compact ? "mb-2" : "mb-3")}>
          <Thermometer
            className={cn("size-4 text-orange-600")}
            aria-hidden
          />
          <p
            className={cn(
              compact ? "text-sm font-medium" : dashboardTypography.sectionTitle,
              "text-foreground"
            )}
          >
            {title}
          </p>
        </div>
      ) : null}
      {track}
    </div>
  );
}
