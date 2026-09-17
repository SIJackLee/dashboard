/**
 * 십자선 교차점 → 온·습·모터. 최근접 샘플이 아니라 split-Y 역산.
 */
import {
  listSplitYBands,
  tempBrokenAxisPlotZones,
  type SplitYLayout,
  type SplitYVisibility,
} from "@/lib/farm/unified-barn-trend-layout";
import {
  unmapHumPctFromSplitY,
  unmapMotorPctFromSplitY,
  unmapTempCFromSplitY,
  type TempBandAnchor,
} from "@/lib/farm/unified-barn-trend-series";

export type CrosshairMetricValues = {
  tempC: number | null;
  humidityPct: number | null;
  motorPct: number | null;
};

export type InvertSplitYCrosshairOpts = {
  layout: SplitYLayout;
  visibility: SplitYVisibility;
  overlay: boolean;
  overlayAlign?: TempBandAnchor;
  tempLow: number;
  tempHigh: number;
  humidityLow: number;
  humidityHigh: number;
  tempDomain?: [number, number];
  /** 꺾인 축 위칸 이탈 자체 스케일. 없으면 연속 ℃/px */
  tempOverflowDomain?: [number, number] | null;
  humDomain?: [number, number];
};

const EMPTY: CrosshairMetricValues = {
  tempC: null,
  humidityPct: null,
  motorPct: null,
};

function finiteOrNull(v: number | null | undefined): number | null {
  return v != null && Number.isFinite(v) ? v : null;
}

/** 가로선이 놓인 밴드만(겹쳐보기는 온·습) 역산한다. 밴드 밖·명령 레인은 비움. */
export function invertSplitYCrosshairValues(
  chartY: number,
  opts: InvertSplitYCrosshairOpts,
): CrosshairMetricValues {
  if (!Number.isFinite(chartY)) return EMPTY;
  const hit = listSplitYBands(opts.layout, opts.visibility).find(
    (b) => chartY >= b.lo && chartY <= b.hi,
  );
  if (!hit || hit.id === "command") return EMPTY;

  const align = opts.overlayAlign;
  const tempDomain = align ? undefined : opts.tempDomain;
  const humDomain = align ? undefined : opts.humDomain;

  const invertTemp = () =>
    opts.visibility.showTemp
      ? finiteOrNull(
          unmapTempCFromSplitY(
            chartY,
            opts.tempLow,
            opts.tempHigh,
            opts.layout,
            tempDomain,
            align,
            opts.tempOverflowDomain,
          ),
        )
      : null;
  const invertHum = () =>
    opts.visibility.showHum
      ? finiteOrNull(
          unmapHumPctFromSplitY(
            chartY,
            opts.humidityLow,
            opts.humidityHigh,
            opts.layout,
            humDomain,
            align,
          ),
        )
      : null;
  const invertMotor = () =>
    opts.visibility.showMotors
      ? finiteOrNull(unmapMotorPctFromSplitY(chartY, opts.layout, align))
      : null;

  if (hit.id === "motor") return { ...EMPTY, motorPct: invertMotor() };
  if (opts.overlay || hit.id === "overlay") {
    const zones = tempBrokenAxisPlotZones(opts.layout);
    const inOverflow = Boolean(zones && chartY >= zones.overflow.lo);
    return {
      tempC: invertTemp(),
      humidityPct: inOverflow ? null : invertHum(),
      motorPct: null,
    };
  }
  if (hit.id === "temp") return { ...EMPTY, tempC: invertTemp() };
  if (hit.id === "hum") return { ...EMPTY, humidityPct: invertHum() };
  return EMPTY;
}
