"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
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
  value?: string;
  onValueChange?: (value: string | null) => void;
};

/** base-ui Select ID는 SSR/CSR 불일치 가능 → 마운트 후 렌더 */
export function SimpleSelect({
  label,
  placeholder = FILTER_ALL_LABEL,
  options = [],
  className,
  value,
  onValueChange,
}: SimpleSelectProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const displayLabel = resolveFilterSelectLabel(value, options, placeholder);

  return (
    <div className={cn("space-y-2", className)}>
      {label && <label className={dashboardUi.filterLabel}>{label}</label>}
      {mounted ? (
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger className="h-11 w-48 text-xl">
            <SelectValue placeholder={placeholder}>
              {displayLabel}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.length === 0 ? (
              <SelectItem value={FILTER_ALL}>{placeholder}</SelectItem>
            ) : (
              options.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xl">
                  {isFilterAll(o.value) ? FILTER_ALL_LABEL : o.label}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      ) : (
        <div
          className="flex h-11 w-48 items-center rounded-lg border px-2.5 text-xl text-muted-foreground"
          aria-hidden
        >
          {displayLabel}
        </div>
      )}
    </div>
  );
}
