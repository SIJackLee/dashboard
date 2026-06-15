import { SectionCard } from "@/components/common/section-card";
import { EnvChip } from "@/components/common/env-chip";
import { FanIndicator } from "@/components/common/fan-indicator";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import type { FarmOverview } from "@/lib/data/iot";

const fmtNum = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined ? "--" : v.toFixed(digits);

const round = (v: number | null | undefined) =>
  v === null || v === undefined ? null : Math.round(v);

export function EnvAveragePanel({
  overview,
  variant = "default",
}: {
  overview?: FarmOverview;
  variant?: "default" | "compact";
}) {
  if (variant === "compact") {
    return (
      <SectionCard
        title="환경 평균"
        className={cn("h-full w-full", dashboardUi.overviewPanelMinH)}
        contentClassName="flex flex-1 flex-col min-h-0"
      >
        <div className="flex flex-1 flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <EnvChip kind="temp" value={fmtNum(overview?.avgTempC)} />
            <EnvChip kind="humidity" value={fmtNum(overview?.avgHumidityPct)} />
          </div>
          <div
            className={cn(
              "grid flex-1 grid-cols-3 items-end gap-3",
              dashboardUi.gridGap
            )}
          >
            <FanIndicator
              kind="supply"
              value={round(overview?.avgFanSupply)}
              compact
              large
            />
            <FanIndicator
              kind="exhaust"
              value={round(overview?.avgFanExhaust)}
              compact
              large
            />
            <FanIndicator
              kind="intake"
              value={round(overview?.avgFanIntake)}
              compact
              large
            />
          </div>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="환경 평균" description="전체 컨트롤러 기준">
      <div className="grid grid-cols-2 gap-3">
        <EnvChip kind="temp" value={fmtNum(overview?.avgTempC)} />
        <EnvChip kind="humidity" value={fmtNum(overview?.avgHumidityPct)} />
      </div>
      <div className="mt-4 space-y-3">
        <FanIndicator kind="supply" value={round(overview?.avgFanSupply)} />
        <FanIndicator kind="exhaust" value={round(overview?.avgFanExhaust)} />
        <FanIndicator kind="intake" value={round(overview?.avgFanIntake)} />
      </div>
    </SectionCard>
  );
}
