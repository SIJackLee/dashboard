import { Search, RotateCcw } from "lucide-react";
import { FilterBar, SimpleSelect } from "@/components/common/filter-bar";
import { PageActionButton } from "@/components/common/page-action-button";
import { Input } from "@/components/ui/input";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  totalEvents?: number;
  replayCount?: number;
};

export function LogFilterBar({ totalEvents = 0, replayCount = 0 }: Props) {
  return (
    <FilterBar>
      <div className="flex flex-wrap items-center gap-3 self-center">
        <span
          className={cn(
            "rounded-lg border bg-muted/30 px-4 py-2",
            dashboardUi.body,
            "font-medium"
          )}
        >
          전체 {totalEvents}건
        </span>
        <span
          className={cn(
            "rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-2",
            dashboardUi.body,
            "font-medium text-sky-800 dark:text-sky-200"
          )}
        >
          REPLAY burst {replayCount}건
        </span>
      </div>
      <div className="space-y-2">
        <label className={dashboardUi.filterLabel}>날짜</label>
        <Input type="date" className="h-11 w-48 text-xl" />
      </div>
      <SimpleSelect label="시간대" placeholder="전체" />
      <SimpleSelect label="농장" placeholder="전체 농장" />
      <SimpleSelect label="축사" placeholder="전체 축사" />
      <SimpleSelect label="컨트롤러" placeholder="전체 컨트롤러" />
      <SimpleSelect label="이벤트 유형" placeholder="모든 유형" />
      <div className="ml-auto flex flex-wrap items-end gap-3">
        <PageActionButton icon={<RotateCcw className={dashboardUi.iconSm} aria-hidden />}>
          초기화
        </PageActionButton>
        <PageActionButton variant="primary" icon={<Search className={dashboardUi.iconSm} aria-hidden />}>
          조회
        </PageActionButton>
      </div>
    </FilterBar>
  );
}
