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
  dense?: boolean;
  /** 모바일 drag 중 비-active thumb 라벨 숨김 */
  visible?: boolean;
  /** 모바일 drag 중 active thumb — 20px bold + lift */
  magnified?: boolean;
  className?: string;
};

function labelTypography(
  variant: "edge" | "center",
  compact?: boolean,
  dense?: boolean
) {
  if (dense) {
    return variant === "center"
      ? "text-base font-semibold text-foreground leading-snug"
      : "text-[10px] font-medium text-muted-foreground leading-snug";
  }
  const size = compact
    ? "text-sm leading-snug"
    : cn(dashboardTypography.meta, "leading-snug");
  if (variant === "center") {
    return cn(size, "font-semibold text-foreground");
  }
  return cn(size, "font-medium text-muted-foreground");
}

function thumbLabelPlacementClass(placement: "above" | "below") {
  return placement === "above" ? "bottom-full mb-1.5" : "top-full mt-1.5";
}

/** thumb 위치(0–100) → rail 너비 기준 left */
export function thumbLabelPositionStyle(leftPct: number): React.CSSProperties {
  const clamped = Math.min(100, Math.max(0, leftPct));
  return { left: `${clamped}%` };
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
  dense = false,
  visible = true,
  magnified = false,
  className,
}: SliderThumbLabelProps) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute tabular-nums whitespace-nowrap",
        thumbLabelAlignClass(leftPct),
        thumbLabelPlacementClass(placement),
        labelTypography(variant, compact, dense),
        !visible && "max-md:invisible max-md:opacity-0",
        magnified &&
          "max-md:z-10 max-md:text-xl max-md:font-bold max-md:text-foreground",
        magnified &&
          placement === "above" &&
          "max-md:!bottom-full max-md:!mb-9",
        magnified &&
          placement === "below" &&
          "max-md:!top-full max-md:!mt-9",
        className
      )}
      style={thumbLabelPositionStyle(leftPct)}
      aria-hidden={!visible ? true : undefined}
    >
      {children}
    </span>
  );
}

/** dual: 라벨 위 트랙 아래 (온도·환기·알람 공통) */
export function sliderTrackShellClass(
  compact?: boolean,
  layout: SliderTrackLayout = "dual",
  dense?: boolean
) {
  const pad = "px-3 sm:px-4";
  if (layout === "triple") {
    if (dense) return cn("relative", pad, "py-7");
    return cn("relative", pad, compact ? "py-8" : "py-9");
  }
  return cn("relative", pad, compact ? "pt-7 pb-2" : "pt-8 pb-3");
}

export function sliderTrackRailClass() {
  return "relative mx-0 h-3 w-full";
}

/** rail 배경 — input 레이어 아래 */
export function sliderTrackRailBgClass() {
  return "pointer-events-none absolute inset-0 rounded-full bg-muted";
}

export function fmtTempLabel(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
