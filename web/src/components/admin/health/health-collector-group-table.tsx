import Link from "next/link";
import type { CollectorGroupHealthRow } from "@/lib/admin/health/types";
import { HealthCollectorGroupMobileList } from "@/components/admin/health/health-collector-group-mobile-list";
import { HealthStatusBadge } from "@/components/admin/health/health-status-badge";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type HealthCollectorGroupTableProps = {
  groups: CollectorGroupHealthRow[];
  compact?: boolean;
  limit?: number;
};

export function HealthCollectorGroupTable({
  groups,
  compact = false,
  limit,
}: HealthCollectorGroupTableProps) {
  const rows = limit ? groups.slice(0, limit) : groups;
  const headCls = compact
    ? "px-2 py-2 text-sm font-medium"
    : cn("px-4 py-3", dashboardTypography.tableHead);
  const cellCls = compact
    ? "px-2 py-2 text-sm"
    : cn("px-4 py-3", dashboardTypography.tableCell);

  if (groups.length === 0) {
    return (
      <p
        className={cn(
          compact ? "py-4 text-center text-sm text-muted-foreground" : dashboardTypography.meta,
          !compact && "py-8 text-center"
        )}
      >
        수집 그룹 데이터가 없습니다.
      </p>
    );
  }

  return (
    <>
      <HealthCollectorGroupMobileList groups={groups} limit={limit} compact={compact} />
      <div className="hidden overflow-x-auto rounded-xl border lg:block">
      <table
        className={cn(
          "w-full border-collapse",
          compact ? "min-w-0" : "min-w-[640px]"
        )}
      >
        <thead>
          <tr className="border-b bg-muted/40 text-left">
            {compact ? (
              <>
                <th className={headCls}>그룹</th>
                <th className={headCls}>이상</th>
                <th className={headCls}>상태</th>
              </>
            ) : (
              ["그룹", "농장", "모듈", "이상", "RS rate", "범위", "상태"].map((h) => (
                <th key={h} className={headCls}>
                  {h}
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const recent = row.insertBuckets.slice(-1)[0]?.count ?? 0;
            if (compact) {
              return (
                <tr key={row.id} className="border-b last:border-b-0 hover:bg-muted/20">
                  <td className={cellCls}>
                    <Link
                      href={`/admin/health/group/${row.id}`}
                      className="font-medium hover:underline"
                    >
                      {row.label}
                    </Link>
                  </td>
                  <td className={cn(cellCls, "tabular-nums")}>
                    {row.badModuleCount}/{row.moduleCount}
                  </td>
                  <td className="px-2 py-2">
                    <HealthStatusBadge status={row.status} />
                  </td>
                </tr>
              );
            }
            return (
              <tr key={row.id} className="border-b last:border-b-0 hover:bg-muted/20">
                <td className={cellCls}>
                  <Link
                    href={`/admin/health/group/${row.id}`}
                    className="font-medium hover:underline"
                  >
                    {row.label}
                  </Link>
                  <div className="text-muted-foreground">{row.id}</div>
                </td>
                <td className={cn(cellCls, "tabular-nums")}>{row.farmCount}</td>
                <td className={cn(cellCls, "tabular-nums")}>{row.moduleCount}</td>
                <td className={cn(cellCls, "tabular-nums")}>{row.badModuleCount}</td>
                <td className={cn(cellCls, "tabular-nums")}>{recent} / 5m</td>
                <td className={cellCls}>{row.scope}</td>
                <td className="px-4 py-3">
                  <HealthStatusBadge status={row.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}
