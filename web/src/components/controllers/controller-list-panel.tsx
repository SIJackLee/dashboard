"use client";

import { SectionCard } from "@/components/common/section-card";
import { ControllerNameLabel } from "@/components/common/controller-name-label";
import { StatusBadge } from "@/components/common/status-badge";
import { FanIndicator } from "@/components/common/fan-indicator";
import { cn } from "@/lib/utils";
import type { ControllerReading } from "@/lib/data/iot";

type Props = {
  items?: ControllerReading[];
  selectedKey?: string;
  onSelect?: (key: string) => void;
};

// 통신박스 내 컨트롤러 목록 (최대 50대). 클릭 시 상세 선택.
export function ControllerListPanel({ items = [], selectedKey, onSelect }: Props) {
  return (
    <SectionCard title="축사 내 컨트롤러 목록" description={`${items.length}대`}>
      <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            컨트롤러 데이터가 없습니다.
          </p>
        ) : (
          items.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => onSelect?.(c.key)}
              className={cn(
                "w-full space-y-2 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
                c.key === selectedKey && "border-emerald-500 bg-emerald-50/50"
              )}
            >
              <div className="flex items-center justify-between">
                <ControllerNameLabel eqpmnNo={c.eqpmnNo} idx={c.idx} />
                <StatusBadge tone={c.status} />
              </div>
              <div className="flex gap-4">
                <FanIndicator kind="supply" value={c.fanSupply} compact />
                <FanIndicator kind="exhaust" value={c.fanExhaust} compact />
                <FanIndicator kind="intake" value={c.fanIntake} compact />
              </div>
            </button>
          ))
        )}
      </div>
    </SectionCard>
  );
}
