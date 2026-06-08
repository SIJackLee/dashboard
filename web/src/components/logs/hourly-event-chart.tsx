import { SectionCard } from "@/components/common/section-card";
import { SimpleSelect } from "@/components/common/filter-bar";
import { ChartPlaceholder } from "@/components/common/chart-placeholder";

// 시간대별 이벤트 분포(누적 막대). 실제 이벤트는 센서 수신/명령 위주.
export function HourlyEventChart() {
  return (
    <SectionCard
      title="시간대별 이벤트 분포"
      action={<SimpleSelect placeholder="누적 막대" />}
    >
      <ChartPlaceholder label="시간대별 누적 막대 차트" height={240} />
    </SectionCard>
  );
}
