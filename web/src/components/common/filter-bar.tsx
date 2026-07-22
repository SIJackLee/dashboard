"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import {
  FILTER_ALL,
  FILTER_ALL_LABEL,
  isFilterAll,
  resolveFilterSelectLabel,
} from "@/lib/ui/filter-all";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const emptySubscribe = () => () => {};

export function FilterBar({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-4 rounded-xl border bg-background p-5",
        className
      )}
    >
      {children}
    </div>
  );
}

type SimpleSelectProps = {
  label?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  className?: string;
  triggerClassName?: string;
  value?: string;
  onValueChange?: (value: string | null) => void;
};

/** base-ui Select ID는 SSR/CSR 불일치 가능 → 마운트 후 렌더 */
export function SimpleSelect({
  label,
  placeholder = FILTER_ALL_LABEL,
  options = [],
  className,
  triggerClassName,
  value,
  onValueChange,
}: SimpleSelectProps) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const displayLabel = resolveFilterSelectLabel(value, options, placeholder);

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className={dashboardTypography.formLabel}>{label}</label>
      )}
      {mounted ? (
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger
            size="dashboard"
            className={cn("w-full min-w-0", triggerClassName)}
          >
            <SelectValue placeholder={placeholder}>
              {displayLabel}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.length === 0 ? (
              <SelectItem size="dashboard" value={FILTER_ALL}>
                {placeholder}
              </SelectItem>
            ) : (
              options.map((o) => (
                <SelectItem key={o.value} size="dashboard" value={o.value}>
                  {isFilterAll(o.value) ? FILTER_ALL_LABEL : o.label}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      ) : (
        <div
          className={cn(
            "flex h-12 min-h-12 w-full min-w-0 items-center rounded-lg border px-3 text-[1.75rem] text-muted-foreground",
            triggerClassName
          )}
          aria-hidden
        >
          {displayLabel}
        </div>
      )}
    </div>
  );
}
