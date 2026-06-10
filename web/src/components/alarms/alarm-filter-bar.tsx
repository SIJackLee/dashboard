import { Search, RefreshCw } from "lucide-react";
import { FilterBar, SimpleSelect } from "@/components/common/filter-bar";
import { Input } from "@/components/ui/input";

export function AlarmFilterBar({ total = 0 }: { total?: number }) {
  return (
    <FilterBar>
      <p className="self-center text-sm text-muted-foreground">활성 {total}건</p>
      <SimpleSelect label="축사" placeholder="전체 축사" />
      <SimpleSelect label="심각도" placeholder="전체 심각도" />
      <SimpleSelect label="상태" placeholder="전체 상태" />
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">기간</label>
        <Input type="date" className="w-44" />
      </div>
      <div className="relative flex-1 space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">검색</label>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input placeholder="알람 유형 검색" className="pl-8" />
        </div>
      </div>
      <button className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-muted">
        <RefreshCw className="size-4" /> 새로고침
      </button>
    </FilterBar>
  );
}
