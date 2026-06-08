import { SectionCard } from "@/components/common/section-card";
import { EnvChip } from "@/components/common/env-chip";
import { FanIndicator } from "@/components/common/fan-indicator";
import type { FarmOverview } from "@/lib/data/iot";

const fmtNum = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined ? "--" : v.toFixed(digits);

const round = (v: number | null | undefined) =>
  v === null || v === undefined ? null : Math.round(v);

// 환경 평균(전체 컨트롤러): 온도/습도 + 3팬(%) — NH3/CO2 제외
export function EnvAveragePanel({ overview }: { overview?: FarmOverview }) {
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
