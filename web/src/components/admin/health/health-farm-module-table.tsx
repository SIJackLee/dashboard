import Link from "next/link";
import type { ModuleHealthRow } from "@/lib/admin/health/types";
import { HealthFarmModuleMobileList } from "@/components/admin/health/health-farm-module-mobile-list";
import { HealthStatusBadge } from "@/components/admin/health/health-status-badge";
import { HEALTH_UI } from "@/lib/admin/health/health-ui-labels";
import { farmKeyUrlSlug } from "@/lib/data/farm-key";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type HealthFarmModuleTableProps = {
  modules: ModuleHealthRow[];
  stickyHeader?: boolean;
  maxHeight?: string;
  compact?: boolean;
};
function formatLastSeen(iso: string | null, ageMin: number | null): string {
  if (ageMin === null) return "—";
  if (ageMin < 1) return "1분 미만";
  return `${Math.round(ageMin)}분 전`;
}

export function HealthFarmModuleTable({
  modules,
  stickyHeader = false,
  maxHeight,
  compact = false,
}: HealthFarmModuleTableProps) {
  if (modules.length === 0) {
    return (
      <p
        className={cn(
          compact ? "py-4 text-center text-sm text-muted-foreground" : dashboardTypography.meta,
          !compact && "py-8 text-center"
        )}
      >
        표시할 모듈 데이터가 없습니다.
      </p>
    );
  }

  const headers = compact
    ? ["농장", "모듈", "상태", "last seen"]
    : ["농장", "모듈", "대수", "coverage", "상태", "last seen", HEALTH_UI.actionHint, "범위"];
  const headCls = compact
    ? "px-2 py-2 text-sm font-medium"
    : cn("px-4 py-3", dashboardTypography.tableHead);
  const cellCls = compact
    ? "px-2 py-2 text-sm"
    : cn("px-4 py-3", dashboardTypography.tableCell);

  return (
    <>
      <HealthFarmModuleMobileList modules={modules} />
      <div
        className={cn(
          "hidden overflow-x-auto rounded-xl border lg:block",
          compact ? "h-full min-h-0 overflow-y-auto" : maxHeight,
          !compact && stickyHeader && maxHeight ? "overflow-y-auto" : ""
        )}
      >
      <table
        className={cn("w-full border-collapse", compact ? "min-w-0" : "min-w-[640px]")}
      >
        <thead
          className={cn(stickyHeader ? "sticky top-0 z-10 bg-muted/95 backdrop-blur" : "")}
        >
          <tr className="border-b bg-muted/40 text-left">
            {headers.map((h) => (
              <th key={h} className={headCls}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modules.map((row) => (
            <tr key={row.id} className="border-b last:border-b-0 hover:bg-muted/20">
              <td className={cellCls}>
                <Link
                  href={`/admin/health/farm/${farmKeyUrlSlug(row.farmId)}`}
                  className="hover:text-foreground hover:underline"
                >
                  {row.farmLabel}
                </Link>
                {compact ? null : (
                  <div className="text-muted-foreground">{row.farmId}</div>
                )}
              </td>
              <td className={cellCls}>{row.moduleLabel}</td>
              {compact ? null : (
                <>
                  <td className={cn(cellCls, "tabular-nums")}>{row.controllerCount}</td>
                  <td className={cn(cellCls, "tabular-nums")}>
                    {row.coveragePct != null ? `${row.coveragePct}%` : "—"}
                  </td>
                </>
              )}
              <td className={compact ? "px-2 py-2" : "px-4 py-3"}>
                <HealthStatusBadge status={row.status} />
              </td>
              <td className={cn(cellCls, "tabular-nums")}>
                {formatLastSeen(row.lastReceivedAt, row.ageMin)}
              </td>
              {compact ? null : (
                <>
                  <td className={cellCls}>{row.d11Hint}</td>
                  <td className={cellCls}>{row.scope}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}
