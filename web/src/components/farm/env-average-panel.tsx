import { SectionCard } from "@/components/common/section-card";
import { EnvChip } from "@/components/common/env-chip";
import { FanIndicator } from "@/components/common/fan-indicator";

// 환경 평균(전체 축사): 온도/습도 + 3팬(%) — NH3/CO2 제외
export function EnvAveragePanel() {
  return (
    <SectionCard title="환경 평균" description="전체 축사 기준">
      <div className="grid grid-cols-2 gap-3">
        <EnvChip kind="temp" />
        <EnvChip kind="humidity" />
      </div>
      <div className="mt-4 space-y-3">
        <FanIndicator kind="supply" />
        <FanIndicator kind="exhaust" />
        <FanIndicator kind="intake" />
      </div>
    </SectionCard>
  );
}
