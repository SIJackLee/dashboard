import { CompactColumnChart } from "@/components/common/compact-column-chart";
import {
  buildControllerSlotSeries,
  resolveSlotCount,
  type ControllerMetricKey,
  type ControllerSlotReading,
} from "@/lib/data/iot-chart";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export type BarnMetricDef = {
  key: ControllerMetricKey;
  label: string;
  unit: string;
  max: number;
  barClassName: string;
};

type BarnMetricChartStackProps = {
  readings: ControllerSlotReading[];
  metrics: BarnMetricDef[];
  barHeight?: number;
};

export function BarnMetricChartStack({
  readings,
  metrics,
  barHeight = 88,
}: BarnMetricChartStackProps) {
  const slotCount = resolveSlotCount(readings);
  return (
    <div className="space-y-4">
      {metrics.map((m, i) => (
        <div key={m.key}>
          <div className="mb-1.5 flex items-center gap-2">
            <span
              className={cn("size-2 rounded-sm", m.barClassName)}
              aria-hidden
            />
            <span className={dashboardUi.chartLabel}>
              {m.label}
              <span className="ml-1 font-normal text-muted-foreground">
                ({m.unit})
              </span>
            </span>
          </div>
          <CompactColumnChart
            items={buildControllerSlotSeries(readings, m.key, slotCount)}
            unit={m.unit}
            maxValue={m.max}
            barClassName={m.barClassName}
            fillWidth
            tickEvery={5}
            height={barHeight}
            showSummary={false}
            showXAxis={i === metrics.length - 1}
          />
        </div>
      ))}
    </div>
  );
}
