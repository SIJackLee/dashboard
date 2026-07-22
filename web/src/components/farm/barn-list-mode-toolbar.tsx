"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import type { BarnListViewMode } from "@/lib/farm/farm-view-url";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

const MODES: { id: BarnListViewMode; label: string; short: string }[] = [
  { id: "controller", label: "컨트롤러", short: "Ctrl" },
  { id: "graph", label: "모터", short: "Motor" },
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
  const [pendingMode, setPendingMode] = useState<BarnListViewMode | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (pendingMode != null && value === pendingMode) {
      setPendingMode(null);
    }
  }, [value, pendingMode]);

  useEffect(() => {
    if (!pendingMode) return;
    const t = window.setTimeout(() => setPendingMode(null), 2500);
    return () => window.clearTimeout(t);
  }, [pendingMode]);

  const busy = isPending || pendingMode != null;

  return (
    <div
      role="tablist"
      aria-label="목록 보기 모드"
      aria-disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(
        "inline-flex overflow-hidden rounded-lg border bg-muted/30",
        dashboardUi.body,
        (disabled || busy) && "pointer-events-none opacity-50",
        className,
      )}
    >
      {MODES.map((mode, index) => {
        const selected = value === mode.id;
        const modeBusy = pendingMode === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-busy={modeBusy || undefined}
            disabled={disabled || busy}
            className={cn(
              "inline-flex min-h-8 items-center justify-center gap-1 border-border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-wait sm:min-h-11 sm:px-3 sm:text-sm md:px-4 md:text-[1.75rem]",
              index > 0 && "border-l",
              selected
                ? "bg-background text-foreground dark:border-primary/40 dark:bg-primary/10 dark:text-primary"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
            onClick={() => {
              if (mode.id === value || busy) return;
              setPendingMode(mode.id);
              startTransition(() => onChange(mode.id));
            }}
          >
            {modeBusy ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin sm:size-4" aria-hidden />
            ) : null}
            <span className="sm:hidden">{modeBusy ? "…" : mode.short}</span>
            <span className="hidden sm:inline">
              {modeBusy ? `${mode.label}…` : mode.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
