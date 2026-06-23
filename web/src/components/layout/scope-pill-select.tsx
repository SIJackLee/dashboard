"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export type ScopePillOption = { value: string; label: string };

type ScopePillSelectProps = {
  label: string;
  ariaLabel: string;
  options: ScopePillOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  menuClassName?: string;
  labelClassName?: string;
};

const pillClass = cn(
  dashboardUi.scopePill,
  dashboardUi.scopePillText,
  dashboardUi.scopePillActive
);

/** Active pill — click opens option list (Popover via DropdownMenu). */
export function ScopePillSelect({
  label,
  ariaLabel,
  options,
  value,
  onChange,
  disabled = false,
  menuClassName,
  labelClassName,
}: ScopePillSelectProps) {
  const canOpen = !disabled && options.length > 0;
  const displayLabel =
    options.find((o) => o.value === value)?.label ?? label;

  if (options.length === 0) return null;

  const body = (
    <>
      <span className={cn("max-w-[8rem] truncate md:max-w-[18rem]", labelClassName)}>
        {displayLabel}
      </span>
      {canOpen ? (
        <ChevronDown className="size-4 shrink-0 opacity-70 md:size-6" aria-hidden />
      ) : null}
    </>
  );

  if (!canOpen) {
    return (
      <span className={pillClass} aria-label={ariaLabel}>
        {body}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className={cn(pillClass, "outline-none focus-visible:ring-2 focus-visible:ring-ring")}
        aria-label={ariaLabel}
      >
        {body}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className={cn(
          dashboardUi.scopePillMenu,
          "!w-auto min-w-[var(--anchor-width)]",
          menuClassName
        )}
      >
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <DropdownMenuItem
              key={opt.value || "__all__"}
              onClick={() => onChange(opt.value)}
              className={cn(
                dashboardUi.scopePillMenuItem,
                selected && "bg-emerald-50 dark:bg-emerald-950/30"
              )}
            >
              <Check
                className={cn("size-5 shrink-0", !selected && "opacity-0")}
                aria-hidden
              />
              <span className="truncate">{opt.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ScopePillReadOnly({
  label,
  ariaLabel,
}: {
  label: string;
  ariaLabel: string;
}) {
  return (
    <span className={pillClass} aria-label={ariaLabel}>
      <span className="max-w-[18rem] truncate">{label}</span>
    </span>
  );
}
