import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type SliderTrackLayout = "dual" | "triple";

/** tailwind left-3 / right-3 — rail·라벨 공통 inset */
export const SLIDER_TRACK_INSET = "0.75rem";

const EDGE_ALIGN_PCT = 14;

type SliderThumbLabelProps = {
  leftPct: number;
  children: React.ReactNode;
  variant?: "edge" | "center";
  placement?: "above" | "below";
  compact?: boolean;
  className?: string;
};

function labelTypography(variant: "edge" | "center", compact?: boolean) {
  const size = compact
    ? "text-2xl leading-snug"
    : cn(dashboardTypography.meta, "leading-snug");
  if (variant === "center") {
    return cn(size, "font-semibold text-foreground");
  }
  return cn(size, "font-medium text-muted-foreground");
}

/** thumb 위치(0–100) → rail inset 기준 left + 끝단 정렬 */
export function thumbLabelPositionStyle(leftPct: number): React.CSSProperties {
  const clamped = Math.min(100, Math.max(0, leftPct));
  return {
    left: `calc(${SLIDER_TRACK_INSET} + (100% - 2 * ${SLIDER_TRACK_INSET}) * ${clamped / 100})`,
  };
}

export function thumbLabelAlignClass(leftPct: number) {
  if (leftPct <= EDGE_ALIGN_PCT) return "translate-x-0";
  if (leftPct >= 100 - EDGE_ALIGN_PCT) return "-translate-x-full";
  return "-translate-x-1/2";
}

/** range thumb 라벨 (pointer-events-none) */
export function SliderThumbLabel({
  leftPct,
  children,
  variant = "edge",
  placement = "above",
  compact = false,
  className,
}: SliderThumbLabelProps) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute tabular-nums whitespace-nowrap",
        thumbLabelAlignClass(leftPct),
        placement === "above" ? "top-0" : "bottom-0",
        labelTypography(variant, compact),
        className
      )}
      style={thumbLabelPositionStyle(leftPct)}
    >
      {children}
    </span>
  );
}

/** triple: 위 설정온도 · 아래 ±편차 · dual: 라벨 위 트랙 아래 */
export function sliderTrackShellClass(
  compact?: boolean,
  layout: SliderTrackLayout = "dual"
) {
  const pad = "px-3 sm:px-4";
  if (layout === "triple") {
    return cn("relative", pad, compact ? "h-[5.75rem]" : "h-24");
  }
  return cn("relative", pad, compact ? "h-[5.25rem]" : "h-[5.75rem]");
}

export function sliderTrackRailClass(
  _compact?: boolean,
  layout: SliderTrackLayout = "dual"
) {
  if (layout === "triple") {
    return cn(
      "absolute top-1/2 right-3 left-3 h-3 -translate-y-1/2 rounded-full bg-muted"
    );
  }
  return cn(
    "absolute right-3 left-3 h-3 rounded-full bg-muted",
    _compact ? "bottom-3" : "bottom-3.5"
  );
}

export function fmtTempLabel(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
