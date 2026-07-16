import { Droplets, Fan, Thermometer } from "lucide-react";
import { cn } from "@/lib/utils";

const METRIC_ARIA: Record<string, string> = {
  T: "온도",
  H: "습도",
  A: "팬 A",
  B: "팬 B",
  C: "팬 C",
};

export function gridMetricAriaLabel(id: string, fallback?: string): string {
  return METRIC_ARIA[id] ?? fallback ?? id;
}

type Props = {
  id: string;
  label: string;
  mode?: "text" | "icon";
  className?: string;
  iconClassName?: string;
};

/** 그리드 히트맵·지표 탭 — 온도/습도/팬 행 라벨 */
export function GridMetricLabel({
  id,
  label,
  mode = "text",
  className,
  iconClassName = "size-3.5",
}: Props) {
  if (mode === "text") {
    return <span className={className}>{label}</span>;
  }

  if (id === "T") {
    return (
      <Thermometer
        className={cn(iconClassName, "text-orange-500", className)}
        aria-hidden
      />
    );
  }
  if (id === "H") {
    return (
      <Droplets
        className={cn(iconClassName, "text-sky-500", className)}
        aria-hidden
      />
    );
  }
  if (id === "A" || id === "B" || id === "C") {
    return (
      <span
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center",
          className,
        )}
        aria-hidden
      >
        <Fan className={cn(iconClassName, "text-sky-600 dark:text-sky-400")} />
        <span className="absolute text-[0.45rem] font-bold leading-none text-sky-800 dark:text-sky-100">
          {id}
        </span>
      </span>
    );
  }

  return <span className={className}>{label}</span>;
}
