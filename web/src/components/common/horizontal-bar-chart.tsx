import { cn } from "@/lib/utils";

export type HorizontalBarItem = {
  label: string;
  value: number | null;
  title?: string;
};

type HorizontalBarChartProps = {
  items: HorizontalBarItem[];
  unit?: string;
  maxValue?: number;
  barClassName?: string;
  emptyLabel?: string;
};

export function HorizontalBarChart({
  items,
  unit = "",
  maxValue,
  barClassName = "bg-orange-500",
  emptyLabel = "표시할 데이터가 없습니다",
}: HorizontalBarChartProps) {
  const withValue = items.filter((i) => i.value !== null);
  if (withValue.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>
    );
  }

  const peak = maxValue ?? Math.max(...withValue.map((i) => i.value!), 1);

  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const v = item.value;
        const pct = v === null ? 0 : Math.min(100, (v / peak) * 100);
        return (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-muted-foreground">{item.label}</span>
              <span className="shrink-0 font-medium tabular-nums">
                {v === null ? "--" : `${v.toFixed(1)}${unit}`}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full transition-all", barClassName)}
                style={{ width: v === null ? "0%" : `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
