"use client";

import type { BarnListViewMode } from "@/lib/farm/farm-view-url";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

const MODES: { id: BarnListViewMode; label: string; short: string }[] = [
  { id: "controller", label: "컨트롤러", short: "Ctrl" },
  { id: "graph", label: "그래프", short: "Graph" },
  { id: "settings", label: "설정", short: "Set" },
];

type Props = {
  value: BarnListViewMode;
  onChange: (mode: BarnListViewMode) => void;
  disabled?: boolean;
  className?: string;
};

/** 축사 목록 — 전역 보기 모드 (안1: 카드 그리드 · 패널 스왑) */
export function BarnListModeToolbar({
  value,
  onChange,
  disabled = false,
  className,
}: Props) {
  return (
    <div
      role="tablist"
      aria-label="목록 보기 모드"
      aria-disabled={disabled}
      className={cn(
        "inline-flex overflow-hidden rounded-lg border bg-muted/30",
        dashboardUi.body,
        disabled && "pointer-events-none opacity-50",
        className
      )}
    >
      {MODES.map((mode, index) => {
        const selected = value === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cn(
              "inline-flex min-h-8 items-center justify-center border-border px-2.5 py-1.5 text-xs font-medium transition-colors sm:min-h-11 sm:px-3 sm:text-sm md:px-4 md:text-[1.75rem]",
              index > 0 && "border-l",
              selected
                ? "bg-background text-foreground dark:border-primary/40 dark:bg-primary/10 dark:text-primary"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
            onClick={() => onChange(mode.id)}
          >
            <span className="sm:hidden">{mode.short}</span>
            <span className="hidden sm:inline">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}
