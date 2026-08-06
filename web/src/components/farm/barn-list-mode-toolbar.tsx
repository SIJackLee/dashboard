"use client";

import { useEffect, useState } from "react";
import { Cpu, LineChart, Loader2, Settings, type LucideIcon } from "lucide-react";
import type { BarnListViewMode } from "@/lib/farm/farm-view-url";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

const MODES: {
  id: BarnListViewMode;
  label: string;
  Icon: LucideIcon;
}[] = [
  { id: "controller", label: "컨트롤러", Icon: Cpu },
  { id: "graph", label: "그래프", Icon: LineChart },
  { id: "settings", label: "설정", Icon: Settings },
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
  const [pendingMode, setPendingMode] = useState<BarnListViewMode | null>(null);

  if (pendingMode != null && value === pendingMode) {
    setPendingMode(null);
  }

  useEffect(() => {
    if (!pendingMode) return;
    const t = window.setTimeout(() => setPendingMode(null), 2500);
    return () => window.clearTimeout(t);
  }, [pendingMode]);

  /** 클릭 즉시 선택 표시 — URL/부모 value 동기화 전 */
  const displayMode = pendingMode ?? value;
  const switching = pendingMode != null;

  return (
    <div
      role="tablist"
      aria-label="목록 보기 모드"
      aria-disabled={disabled || undefined}
      aria-busy={switching || undefined}
      className={cn(
        "inline-flex overflow-hidden rounded-lg border bg-muted/30",
        dashboardUi.body,
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      {MODES.map((mode, index) => {
        const selected = displayMode === mode.id;
        const modeBusy = pendingMode === mode.id;
        const Icon = mode.Icon;
        return (
          <button
            key={mode.id}
            type="button"
            role="tab"
            aria-label={mode.label}
            title={mode.label}
            aria-selected={selected}
            aria-busy={modeBusy || undefined}
            disabled={disabled}
            className={cn(
              "inline-flex size-8 min-w-8 items-center justify-center border-border p-0 disabled:cursor-wait sm:size-11 sm:min-w-11",
              motionClass.microInteractive,
              index > 0 && "border-l",
              selected
                ? "bg-background text-foreground dark:border-primary/40 dark:bg-primary/10 dark:text-primary"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
            onClick={() => {
              if (disabled) return;
              if (mode.id === displayMode && !switching) return;
              if (mode.id === pendingMode) return;
              setPendingMode(mode.id);
              onChange(mode.id);
            }}
          >
            {modeBusy ? (
              <Loader2
                className="size-4 shrink-0 animate-spin sm:size-5"
                aria-hidden
              />
            ) : (
              <Icon className="size-4 shrink-0 sm:size-5" aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}
