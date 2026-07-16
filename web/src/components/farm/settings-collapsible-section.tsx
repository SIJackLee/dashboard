"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  title: string;
  summary: string;
  changed?: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

/** 모바일 sheet 설정 — 접이식 섹션 헤더 + body. */
export function SettingsCollapsibleSection({
  id,
  title,
  summary,
  changed = false,
  open,
  onToggle,
  children,
}: Props) {
  return (
    <section
      data-settings-section={id}
      className="overflow-hidden rounded-lg border bg-background"
    >
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors",
          open ? "bg-muted/40" : "hover:bg-muted/30",
        )}
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="text-xs font-semibold">{title}</span>
        {changed ? (
          <span
            className="size-1.5 shrink-0 rounded-full bg-sky-500"
            aria-label="변경됨"
          />
        ) : null}
        {!open ? (
          <span className="ml-1 min-w-0 flex-1 truncate text-right text-[0.65rem] tabular-nums text-muted-foreground">
            {summary}
          </span>
        ) : (
          <span className="flex-1" />
        )}
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="border-t px-3 pb-3 pt-2">{children}</div>
      ) : null}
    </section>
  );
}
