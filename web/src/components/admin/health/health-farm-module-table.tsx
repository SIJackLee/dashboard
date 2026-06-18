import Link from "next/link";
import type { ModuleHealthRow } from "@/lib/admin/health/types";
import { HealthStatusBadge } from "@/components/admin/health/health-status-badge";
import { farmKeyUrlSlug } from "@/lib/data/farm-key";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type HealthFarmModuleTableProps = {
  modules: ModuleHealthRow[];
};

function formatLastSeen(iso: string | null, ageMin: number | null): string {
  if (ageMin === null) return "—";
  if (ageMin < 1) return "1분 미만";
  return `${Math.round(ageMin)}분 전`;
}

export function HealthFarmModuleTable({ modules }: HealthFarmModuleTableProps) {
  if (modules.length === 0) {
    return (
      <p className={cn(dashboardTypography.meta, "py-8 text-center")}>
        표시할 모듈 데이터가 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="border-b bg-muted/40 text-left">
            {["농장", "모듈", "대수", "coverage", "상태", "last seen", "D11", "범위"].map(
              (h) => (
                <th key={h} className={cn("px-4 py-3", dashboardTypography.tableHead)}>
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {modules.map((row) => (
            <tr key={row.id} className="border-b last:border-b-0 hover:bg-muted/20">
              <td className={cn("px-4 py-3", dashboardTypography.tableCell)}>
                <Link
                  href={`/admin/health/farm/${farmKeyUrlSlug(row.farmId)}`}
                  className="hover:text-foreground hover:underline"
                >
                  {row.farmLabel}
                </Link>
                <div className="text-muted-foreground">{row.farmId}</div>
              </td>
              <td className={cn("px-4 py-3", dashboardTypography.tableCell)}>
                {row.moduleLabel}
              </td>
              <td className={cn("px-4 py-3 tabular-nums", dashboardTypography.tableCell)}>
                {row.controllerCount}
              </td>
              <td className={cn("px-4 py-3 tabular-nums", dashboardTypography.tableCell)}>
                {row.coveragePct != null ? `${row.coveragePct}%` : "—"}
              </td>
              <td className="px-4 py-3">
                <HealthStatusBadge status={row.status} />
              </td>
              <td className={cn("px-4 py-3 tabular-nums", dashboardTypography.tableCell)}>
                {formatLastSeen(row.lastReceivedAt, row.ageMin)}
              </td>
              <td className={cn("px-4 py-3", dashboardTypography.tableCell)}>
                {row.d11Hint}
              </td>
              <td className={cn("px-4 py-3", dashboardTypography.tableCell)}>
                {row.scope}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
