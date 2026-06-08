import { Search, RotateCcw } from "lucide-react";
import { FilterBar, SimpleSelect } from "@/components/common/filter-bar";
import { Input } from "@/components/ui/input";

export function LogFilterBar() {
  return (
    <FilterBar>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">날짜</label>
        <Input type="date" className="w-40" />
      </div>
      <SimpleSelect label="시간대" placeholder="전체" />
      <SimpleSelect label="농장" placeholder="전체 농장" />
      <SimpleSelect label="축사" placeholder="전체 축사" />
      <SimpleSelect label="컨트롤러" placeholder="전체 컨트롤러" />
      <SimpleSelect label="이벤트 유형" placeholder="모든 유형" />
      <div className="ml-auto flex items-end gap-2">
        <button className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-muted">
          <RotateCcw className="size-4" /> 초기화
        </button>
        <button className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">
          <Search className="size-4" /> 조회
        </button>
      </div>
    </FilterBar>
  );
}
