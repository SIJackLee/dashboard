import { cn } from "@/lib/utils";
import type { HorizontalBarItem } from "@/components/common/horizontal-bar-chart";

type CompactColumnChartProps = {
  items: HorizontalBarItem[];
  unit?: string;
  maxValue?: number;
  barClassName?: string;
  emptyLabel?: string;
  height?: number;
  /** true 이면 막대를 균등 분할해 컨테이너 폭에 맞춤 */
  fillWidth?: boolean;
  /** fillWidth 시 x축 눈금 간격 (기본 5 → 1,5,10,…) */
  tickEvery?: number;
  showSummary?: boolean;
  showXAxis?: boolean;
};

function shouldShowTick(slot: number, tickEvery: number, total: number): boolean {
  if (slot === 1 || slot === total) return true;
  return slot % tickEvery === 0;
}

export function CompactColumnChart({
  items,
  unit = "",
  maxValue,
  barClassName = "bg-orange-500",
  emptyLabel = "표시할 데이터가 없습니다",
  height = 112,
  fillWidth = false,
  tickEvery = 5,
  showSummary = true,
  showXAxis = true,
}: CompactColumnChartProps) {
  const withValue = items.filter((i) => i.value !== null) as {
    label: string;
    value: number;
  }[];

  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>
    );
  }

  const peak =
    withValue.length > 0
      ? (maxValue ?? Math.max(...withValue.map((i) => i.value), 1))
      : (maxValue ?? 1);

  const summary =
    withValue.length > 0 ? (
      <p className="text-[11px] tabular-nums text-muted-foreground">
        {Math.min(...withValue.map((i) => i.value)).toFixed(1)}
        {unit} ~ {Math.max(...withValue.map((i) => i.value)).toFixed(1)}
        {unit}
        <span className="mx-1.5 text-border">·</span>
        평균{" "}
        {(
          withValue.reduce((a, b) => a + b.value, 0) / withValue.length
        ).toFixed(1)}
        {unit}
      </p>
    ) : (
      <p className="text-[11px] text-muted-foreground">데이터 없음</p>
    );

  const barRowClass = fillWidth
    ? "flex w-full items-end gap-px"
    : "flex min-w-min items-end gap-px px-0.5";
  const colClass = fillWidth
    ? "flex h-full min-w-0 flex-1 flex-col items-center"
    : "group flex h-full w-2.5 shrink-0 flex-col items-center sm:w-3 md:w-3.5";

  return (
    <div className="space-y-2">
      {showSummary && summary}
      <div className={fillWidth ? "w-full" : "overflow-x-auto"}>
        <div className={barRowClass} style={{ height }}>
          {items.map((item) => {
            const v = item.value;
            const pct =
              v === null ? 0 : Math.max(2, Math.min(100, (v / peak) * 100));
            const title =
              item.title ??
              (v === null
                ? `${item.label}: --`
                : `${item.label}: ${v.toFixed(1)}${unit}`);

            return (
              <div key={item.label} title={title} className={colClass}>
                <div className="flex w-full flex-1 items-end justify-center px-px">
                  <div
                    className={cn(
                      "w-full max-w-full rounded-t-sm transition-all",
                      v === null ? "bg-muted/60" : barClassName
                    )}
                    style={{ height: v === null ? "1px" : `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {showXAxis && (
          <div
            className={cn(
              "mt-1 gap-px border-t pt-1",
              fillWidth ? "flex w-full" : "flex min-w-min"
            )}
          >
            {items.map((item) => {
              const slot = Number(item.label);
              const showTick =
                !fillWidth ||
                Number.isNaN(slot) ||
                shouldShowTick(slot, tickEvery, items.length);

              return (
                <div
                  key={`${item.label}-lbl`}
                  className={cn(
                    "text-center leading-none text-muted-foreground",
                    fillWidth
                      ? "min-w-0 flex-1 text-[7px]"
                      : "w-2.5 shrink-0 truncate text-[8px] sm:w-3 md:w-3.5"
                  )}
                >
                  {showTick ? item.label : ""}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
