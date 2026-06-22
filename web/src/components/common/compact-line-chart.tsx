import { cn } from "@/lib/utils";
import type { HorizontalBarItem } from "@/components/common/horizontal-bar-chart";

type CompactLineChartProps = {
  items: HorizontalBarItem[];
  unit?: string;
  maxValue?: number;
  strokeClassName?: string;
  fillClassName?: string;
  emptyLabel?: string;
  height?: number;
  fillWidth?: boolean;
  tickEvery?: number;
  showSummary?: boolean;
  showXAxis?: boolean;
};

function shouldShowTick(slot: number, tickEvery: number, total: number): boolean {
  if (slot === 1 || slot === total) return true;
  return slot % tickEvery === 0;
}

export function CompactLineChart({
  items,
  unit = "",
  maxValue,
  strokeClassName = "stroke-sky-500",
  fillClassName = "fill-sky-500/10",
  emptyLabel = "표시할 데이터가 없습니다",
  height = 88,
  fillWidth = true,
  tickEvery = 1,
  showSummary = false,
  showXAxis = true,
}: CompactLineChartProps) {
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

  const chartH = showXAxis ? height - 22 : height;
  const padX = 4;
  const padY = 6;
  const innerW = 100 - padX * 2;
  const innerH = chartH - padY * 2;
  const step = items.length > 1 ? innerW / (items.length - 1) : 0;

  const coords = items.map((item, i) => {
    const v = item.value ?? 0;
    const x = padX + i * step;
    const y = padY + innerH - (v / peak) * innerH;
    return { x, y, item, v };
  });

  const linePoints = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const areaPoints = [
    `${coords[0]?.x ?? padX},${padY + innerH}`,
    ...coords.map((c) => `${c.x},${c.y}`),
    `${coords[coords.length - 1]?.x ?? padX},${padY + innerH}`,
  ].join(" ");

  const dotFillClass = strokeClassName.replace("stroke-", "fill-");

  return (
    <div className="space-y-2">
      {showSummary && withValue.length > 0 ? (
        <p className="text-sm tabular-nums text-muted-foreground">
          {Math.min(...withValue.map((i) => i.value)).toFixed(0)}
          {unit} ~ {Math.max(...withValue.map((i) => i.value)).toFixed(0)}
          {unit}
        </p>
      ) : null}
      <div className={fillWidth ? "w-full" : "overflow-x-auto"}>
        <svg
          viewBox={`0 0 100 ${chartH}`}
          preserveAspectRatio="none"
          className="w-full text-sky-500"
          style={{ height: chartH }}
          role="img"
          aria-label="시계열 추이"
        >
          <polygon points={areaPoints} className={fillClassName} />
          <polyline
            points={linePoints}
            fill="none"
            className={strokeClassName}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          {coords.map((c) => (
            <circle
              key={c.item.label}
              cx={c.x}
              cy={c.y}
              r={1.2}
              className={dotFillClass}
            >
              <title>
                {c.item.title ??
                  (c.item.value === null
                    ? `${c.item.label}: --`
                    : `${c.item.label}: ${c.v}${unit}`)}
              </title>
            </circle>
          ))}
        </svg>
        {showXAxis ? (
          <div
            className={cn(
              "mt-1 flex gap-px border-t pt-1",
              fillWidth ? "w-full" : "min-w-min"
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
                    "text-center text-xs leading-none text-muted-foreground",
                    fillWidth ? "min-w-0 flex-1" : "w-10 shrink-0 truncate"
                  )}
                >
                  {showTick ? item.label : ""}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
