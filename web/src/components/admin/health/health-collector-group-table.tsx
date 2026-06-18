import Link from "next/link";
import type { CollectorGroupHealthRow } from "@/lib/admin/health/types";
import { HealthStatusBadge } from "@/components/admin/health/health-status-badge";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type HealthCollectorGroupTableProps = {
  groups: CollectorGroupHealthRow[];
};

export function HealthCollectorGroupTable({
  groups,
}: HealthCollectorGroupTableProps) {
  if (groups.length === 0) {
    return (
      <p className={cn(dashboardTypography.meta, "py-8 text-center")}>
        수집 그룹 데이터가 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="border-b bg-muted/40 text-left">
            {["그룹", "농장", "모듈", "이상", "RS rate", "범위", "상태"].map(
              (h) => (
                <th key={h} className={cn("px-4 py-3", dashboardTypography.tableHead)}>
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {groups.map((row) => {
            const recent = row.insertBuckets.slice(-1)[0]?.count ?? 0;
            return (
              <tr key={row.id} className="border-b last:border-b-0 hover:bg-muted/20">
                <td className={cn("px-4 py-3", dashboardTypography.tableCell)}>
                  <Link
                    href={`/admin/health/group/${row.id}`}
                    className="font-medium hover:underline"
                  >
                    {row.label}
                  </Link>
                  <div className="text-muted-foreground">{row.id}</div>
                </td>
                <td className={cn("px-4 py-3 tabular-nums", dashboardTypography.tableCell)}>
                  {row.farmCount}
                </td>
                <td className={cn("px-4 py-3 tabular-nums", dashboardTypography.tableCell)}>
                  {row.moduleCount}
                </td>
                <td className={cn("px-4 py-3 tabular-nums", dashboardTypography.tableCell)}>
                  {row.badModuleCount}
                </td>
                <td className={cn("px-4 py-3 tabular-nums", dashboardTypography.tableCell)}>
                  {recent} / 5m
                </td>
                <td className={cn("px-4 py-3", dashboardTypography.tableCell)}>
                  {row.scope}
                </td>
                <td className="px-4 py-3">
                  <HealthStatusBadge status={row.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
