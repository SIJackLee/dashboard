"use client";

import { useMemo, useState } from "react";
import type { HealthStatus, ModuleHealthRow } from "@/lib/admin/health/types";
import { HealthFarmModuleTable } from "@/components/admin/health/health-farm-module-table";
import { SEVERITY_ORDER } from "@/lib/admin/health/health-ui-labels";
import { dashboardControl, dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type StatusFilter = HealthStatus | "all" | "issues";

const FILTER_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "issues", label: "이상만" },
  { id: "critical", label: "장애" },
  { id: "warn", label: "주의" },
];

type Props = {
  modules: ModuleHealthRow[];
  scrollable?: boolean;
  embedded?: boolean;
};

export function HealthFarmModulePanel({
  modules,
  scrollable = false,
  embedded = false,
}: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("issues");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let rows = [...modules];
    if (statusFilter === "issues") {
      rows = rows.filter((r) => r.status === "critical" || r.status === "warn");
    } else if (statusFilter !== "all") {
      rows = rows.filter((r) => r.status === statusFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          r.farmLabel.toLowerCase().includes(q) ||
          r.farmId.toLowerCase().includes(q) ||
          r.moduleLabel.toLowerCase().includes(q)
      );
    }
    rows.sort((a, b) => {
      const sd = SEVERITY_ORDER[a.status] - SEVERITY_ORDER[b.status];
      if (sd !== 0) return sd;
      return (b.ageMin ?? 0) - (a.ageMin ?? 0);
    });
    return rows;
  }, [modules, statusFilter, search]);

  return (
    <div className={cn("flex min-h-0 flex-col", embedded ? "h-full gap-2" : "space-y-3 md:space-y-4")}>
      <div className={cn("flex flex-col gap-3", embedded ? "shrink-0 sm:flex-row sm:flex-wrap sm:items-center" : "sm:flex-row sm:flex-wrap sm:items-center")}>
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStatusFilter(opt.id)}
              className={cn(
                dashboardControl.buttonOutline,
                "rounded-lg px-3 py-1.5",
                statusFilter === opt.id
                  ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                  : ""
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="농장·모듈 검색"
          className={cn(
            "min-w-0 w-full flex-1 rounded-lg border bg-background px-3 py-2 sm:min-w-[12rem]",
            dashboardTypography.meta
          )}
          aria-label="농장·모듈 검색"
        />
        <p className={cn(dashboardTypography.meta, "tabular-nums")}>
          {filtered.length} / {modules.length}건
        </p>
      </div>
      <div className={embedded ? "min-h-0 flex-1 overflow-hidden" : undefined}>
        <HealthFarmModuleTable
          modules={filtered}
          stickyHeader={scrollable || embedded}
          maxHeight={scrollable && !embedded ? "max-h-[min(60vh,640px)]" : undefined}
          compact={embedded}
        />
      </div>
    </div>
  );
}
