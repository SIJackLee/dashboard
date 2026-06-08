import { SectionCard } from "@/components/common/section-card";
import { ChartPlaceholder } from "@/components/common/chart-placeholder";

export function BarnStatusDonut() {
  return (
    <SectionCard title="축사 상태 분포">
      <ChartPlaceholder label="도넛 차트 (정상/주의/오프라인)" height={200} />
    </SectionCard>
  );
}
