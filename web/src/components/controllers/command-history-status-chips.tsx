"use client";

import type { CommandHistoryStatusFilter } from "@/components/controllers/command-history-filter";
import { opsStatus } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

/** 밀도 축소 — 전체 / 실패 / 대기 / 기타 */
const STATUSES: { id: CommandHistoryStatusFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "failed", label: "실패" },
  { id: "pending", label: "대기" },
  { id: "other", label: "기타" },
];

type Props = {
  value: CommandHistoryStatusFilter;
  onChange: (id: CommandHistoryStatusFilter) => void;
  disabled?: boolean;
  className?: string;
};

/** 운영 명령 전체 — 상태 필터 칩 (4단). */
export function CommandHistoryStatusChips({
  value,
  onChange,
  disabled,
  className,
}: Props) {
  return (
    <div
      className={cn("flex flex-wrap gap-1", className)}
      role="group"
      aria-label="명령 상태 필터"
    >
      {STATUSES.map((s) => {
        const active = value === s.id;
        return (
          <button
            key={s.id}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(s.id)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
              opsStatus.chipFocus,
              active
                ? s.id === "failed"
                  ? opsStatus.danger
                  : opsStatus.selected
                : opsStatus.idle,
            )}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
