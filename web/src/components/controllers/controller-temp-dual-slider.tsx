"use client";

import { useCallback, useId } from "react";
import { Thermometer } from "lucide-react";
import { clampMenuValue, MENU_STEPS } from "@/lib/controllers/controller-panel-map";
import {
  fmtTempLabel,
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

/** 트랙 = 설정온도 도메인만 (편차 max 합산 안 함). 상한 thumb는 maxTemp > TRACK_MAX 시 끝에 고정 */
const TRACK_MIN = MENU_STEPS.setpoint.min;
const TRACK_MAX = MENU_STEPS.setpoint.max;
const STEP = MENU_STEPS.setpoint.step;

type ControllerTempDualSliderProps = {
  setpoint: number;
  deviation: number;
  disabled?: boolean;
  compact?: boolean;
  dense?: boolean;
  /** ThresholdRangeSlider와 동일 카드 헤더 */
  framed?: boolean;
  title?: string;
  thumbLabelClassName?: string;
  trackShellClassName?: string;
  /** 트랙 아래 설정·편차 숫자 입력 */
  axisMode?: "hidden" | "editable";
  axisInputSize?: SliderValueInputSize;
  axisClassName?: string;
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

/** 설정온도(좌) + 편차(우, +X℃) — dual-thumb, 라벨 모두 트랙 위 */
export function ControllerTempDualSlider({
  setpoint,
  deviation,
  disabled = false,
  compact = false,
  dense = false,
  framed = false,
  title = "온도 설정",
  thumbLabelClassName,
  trackShellClassName,
  axisMode = "hidden",
  axisInputSize,
  axisClassName,
  onChange,
}: ControllerTempDualSliderProps) {
  const id = useId();
  const mobile = useMobileLayout();
  const { dragThumb, dragging, onLowPointerDown, onHighPointerDown } =
    useSliderDragThumb();
  const maxTemp = setpoint + deviation;
  const displayMaxTemp = clamp(maxTemp, TRACK_MIN, TRACK_MAX);
  const mobileDrag = mobile && dragging;
  const lowPct = pct(setpoint, TRACK_MIN, TRACK_MAX);
  const highPct = pct(displayMaxTemp, TRACK_MIN, TRACK_MAX);
  const devLabel = fmtTempLabel(deviation);
  const inputSize = axisInputSize ?? (compact ? "compact" : "dashboard");
  const devMin = MENU_STEPS.deviation.min;
  const devMax = Math.max(devMin, TRACK_MAX - setpoint);

  const setDeviationFromInput = useCallback(
    (raw: number) => {
      const newDev = clampMenuValue(
        "deviation",
        snap(clamp(raw, devMin, devMax), MENU_STEPS.deviation.step)
      );
      onChange(setpoint, newDev);
    },
    [devMax, devMin, onChange, setpoint]
  );

  const setLow = useCallback(
    (raw: number) => {
      const anchoredDev = deviation;
      const upper = Math.min(
        TRACK_MAX - anchoredDev,
        MENU_STEPS.setpoint.max
      );
      let newSp = clampMenuValue(
        "setpoint",
        snap(clamp(raw, TRACK_MIN, upper), STEP)
      );
      const newDev = clampMenuValue("deviation", anchoredDev);
      if (newSp + newDev > TRACK_MAX) {
        newSp = clampMenuValue("setpoint", TRACK_MAX - newDev);
      }
      onChange(newSp, newDev);
    },
    [deviation, onChange]
  );

  const setHigh = useCallback(
    (raw: number) => {
      const nextHigh = snap(
        clamp(raw, setpoint + STEP, TRACK_MAX),
        STEP
      );
      const newDev = clampMenuValue("deviation", nextHigh - setpoint);
      onChange(setpoint, newDev);
    },
    [onChange, setpoint]
  );

  const rangeClass = cn(
    "threshold-dual-range absolute inset-0 h-full w-full appearance-none bg-transparent",
    disabled && "pointer-events-none opacity-40"
  );

  const track = (
    <div
      className={cn(
        sliderTrackShellClass(compact, "dual", dense),
        mobileDrag && "max-md:pt-11",
        trackShellClassName
      )}
    >
      <div className={sliderTrackRailClass()}>
        <SliderThumbLabel
          leftPct={lowPct}
          placement="above"
          variant="center"
          compact={compact}
          dense={dense}
          className={thumbLabelClassName}
          visible={!mobileDrag || dragThumb !== "high"}
          magnified={mobileDrag && dragThumb === "low"}
        >
          {fmtTempLabel(setpoint)}℃
        </SliderThumbLabel>
        <SliderThumbLabel
          leftPct={highPct}
          placement="above"
          compact={compact}
          dense={dense}
          className={thumbLabelClassName}
          visible={!mobileDrag || dragThumb !== "low"}
          magnified={mobileDrag && dragThumb === "high"}
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
          value={setpoint}
          disabled={disabled}
          aria-label={`설정온도 ${fmtTempLabel(setpoint)}℃`}
          aria-valuetext={`${fmtTempLabel(setpoint)}℃`}
          className={cn(rangeClass, "z-[3]")}
          onPointerDown={onLowPointerDown}
          onChange={(e) => setLow(Number(e.target.value))}
        />
        <input
          id={`${id}-high`}
          type="range"
          min={TRACK_MIN}
          max={TRACK_MAX}
          step={STEP}
          value={displayMaxTemp}
          disabled={disabled}
          aria-label={`온도 편차 +${devLabel}℃`}
          aria-valuetext={`+${devLabel}℃`}
          className={cn(rangeClass, "z-[4]")}
          onPointerDown={onHighPointerDown}
          onChange={(e) => setHigh(Number(e.target.value))}
        />
      </div>
      {axisMode === "editable" ? (
        <div
          className={cn(
            "relative mt-1 flex items-end justify-between gap-2 tabular-nums",
            axisClassName ??
              (compact
                ? "text-xs leading-snug text-muted-foreground"
                : dashboardTypography.meta)
          )}
        >
          <SliderValueInput
            value={setpoint}
            min={TRACK_MIN}
            max={Math.min(TRACK_MAX - deviation, MENU_STEPS.setpoint.max)}
            step={STEP}
            unit="℃"
            aria-label="설정온도"
            disabled={disabled}
            size={inputSize}
            onCommit={setLow}
          />
          <span
            className="mb-1 shrink-0 text-center text-muted-foreground"
            aria-hidden
          >
            {TRACK_MIN}–{TRACK_MAX}℃
          </span>
          <SliderValueInput
            value={deviation}
            min={devMin}
            max={devMax}
            step={STEP}
            unit="℃"
            prefix="+"
            aria-label="온도 편차"
            disabled={disabled}
            size={inputSize}
            onCommit={setDeviationFromInput}
          />
        </div>
      ) : null}
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
