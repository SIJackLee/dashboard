import { LayoutGrid, List } from "lucide-react";
import { SectionCard } from "@/components/common/section-card";
import { ControllerNameLabel } from "@/components/common/controller-name-label";
import { StatusBadge } from "@/components/common/status-badge";
import { FanIndicator } from "@/components/common/fan-indicator";

// 축사 내 컨트롤러 목록 (최대 50대). grid/list 뷰 토글.
export function ControllerListPanel() {
  return (
    <SectionCard
      title="축사 내 컨트롤러 목록"
      action={
        <div className="flex items-center gap-1">
          <button className="rounded-md border p-1.5 hover:bg-muted">
            <LayoutGrid className="size-4" />
          </button>
          <button className="rounded-md border p-1.5 hover:bg-muted">
            <List className="size-4" />
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="space-y-2 rounded-lg border p-3"
          >
            <div className="flex items-center justify-between">
              <ControllerNameLabel idx={i} />
              <StatusBadge tone="offline" label="--" />
            </div>
            <div className="flex gap-4">
              <FanIndicator kind="supply" compact />
              <FanIndicator kind="exhaust" compact />
              <FanIndicator kind="intake" compact />
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
