import { SectionCard } from "@/components/common/section-card";
import { SimpleSelect } from "@/components/common/filter-bar";
import { EnvChip } from "@/components/common/env-chip";
import { FanIndicator } from "@/components/common/fan-indicator";

// 빠른 비교: 두 축사 선택 후 온도/습도/3팬 차이 표시
export function QuickComparePanel() {
  return (
    <SectionCard
      title="빠른 비교"
      action={
        <div className="flex gap-2">
          <SimpleSelect placeholder="축사 A" />
          <SimpleSelect placeholder="축사 B" />
        </div>
      }
    >
      <div className="space-y-3">
        <EnvChip kind="temp" />
        <EnvChip kind="humidity" />
        <FanIndicator kind="supply" />
        <FanIndicator kind="exhaust" />
        <FanIndicator kind="intake" />
        <button className="w-full rounded-md border py-2 text-sm hover:bg-muted">
          상세 비교 보기
        </button>
      </div>
    </SectionCard>
  );
}
