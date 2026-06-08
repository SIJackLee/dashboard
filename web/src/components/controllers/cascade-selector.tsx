import { RefreshCw } from "lucide-react";
import { FilterBar, SimpleSelect } from "@/components/common/filter-bar";

// 농장 > 축사 > 컨트롤러 계층 선택
export function CascadeSelector() {
  return (
    <FilterBar className="justify-between">
      <div className="flex flex-wrap items-end gap-3">
        <SimpleSelect label="농장 선택" placeholder="농장 선택" />
        <SimpleSelect label="축사 선택" placeholder="축사 선택" />
        <SimpleSelect label="컨트롤러 선택" placeholder="컨트롤러 선택" />
      </div>
      <button className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-muted">
        <RefreshCw className="size-4" /> 새로고침
      </button>
    </FilterBar>
  );
}
