import { SectionCard } from "@/components/common/section-card";
import { SimpleSelect } from "@/components/common/filter-bar";
import { ChartPlaceholder } from "@/components/common/chart-placeholder";

// 축사 환경 비교: 온도/습도/3팬(%) — NH3/CO2 제외
export function BarnEnvCompareChart() {
  return (
    <SectionCard
      title="축사 환경 비교"
      description="평균값 기준"
      action={<SimpleSelect placeholder="평균값 기준" />}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChartPlaceholder label="온도 (℃)" height={160} />
        <ChartPlaceholder label="습도 (%)" height={160} />
        <ChartPlaceholder label="송풍팬 (%)" height={160} />
        <ChartPlaceholder label="배기팬 / 입기팬 (%)" height={160} />
      </div>
    </SectionCard>
  );
}
