import Link from "next/link";
import type { CollectorNodeState, PipelineNodeState } from "@/lib/admin/health/types";
import {
  HealthStatusBadge,
  healthStatusBorderClass,
} from "@/components/admin/health/health-status-badge";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type HealthTopologyGraphProps = {
  nodes: PipelineNodeState[];
  /** C downlink — COL rollup에 미포함, 점선 분기로 표시 */
  downlinkBranch?: CollectorNodeState;
};

export function HealthTopologyGraph({
  nodes,
  downlinkBranch,
}: HealthTopologyGraphProps) {
  const main = nodes.filter((n) => n.id !== "external");
  const external = nodes.find((n) => n.id === "external");
  const collectorIdx = main.findIndex((n) => n.id === "collector");

  return (
    <div className="space-y-4">
      <p className={cn(dashboardTypography.meta)}>
        토폴로지 · 정점색=rollup · 클릭=상세
        {downlinkBranch ? " · C=downlink 별도" : ""}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {main.map((node, i) => (
          <span key={node.id} className="flex items-center gap-2">
            <Link
              href={node.href}
              className={cn(
                "flex min-w-[4.5rem] flex-col items-center gap-2 rounded-xl border-2 bg-card px-3 py-3 transition-colors hover:bg-muted/40",
                healthStatusBorderClass(node.status)
              )}
            >
              <span
                className={cn(
                  "size-2.5 rounded-full",
                  node.status === "ok" && "bg-emerald-500",
                  node.status === "warn" && "bg-amber-500",
                  node.status === "critical" && "bg-red-500",
                  node.status === "unknown" && "bg-muted-foreground",
                  node.status === "not_implemented" && "bg-sky-500"
                )}
              />
              <span className="text-xl font-semibold">{node.short}</span>
              <HealthStatusBadge status={node.status} />
            </Link>
            {i < main.length - 1 ? (
              <span className="text-muted-foreground">→</span>
            ) : null}
          </span>
        ))}
      </div>
      {downlinkBranch ? (
        <div
          className="flex items-center gap-2"
          style={{ paddingLeft: collectorIdx >= 0 ? `${collectorIdx * 7.5 + 2}rem` : "2rem" }}
        >
          <span className="text-muted-foreground">↘</span>
          <Link
            href={`/admin/health/${downlinkBranch.id}`}
            className={cn(
              "flex min-w-[4rem] flex-col items-center gap-1 rounded-lg border border-dashed bg-card px-3 py-2 hover:bg-muted/40",
              healthStatusBorderClass(downlinkBranch.status)
            )}
          >
            <span className="text-lg font-semibold">{downlinkBranch.short}</span>
            <HealthStatusBadge status={downlinkBranch.status} />
          </Link>
          <p className={dashboardTypography.meta}>
            downlink · COL rollup 제외 · S4
          </p>
        </div>
      ) : null}
      {external ? (
        <div className="flex items-center gap-2 pl-8">
          <span className="text-muted-foreground">↘</span>
          <Link
            href={external.href}
            className={cn(
              "flex min-w-[4rem] flex-col items-center gap-1 rounded-lg border border-dashed bg-card px-3 py-2 hover:bg-muted/40",
              healthStatusBorderClass(external.status)
            )}
          >
            <span className="text-lg font-semibold">{external.short}</span>
            <HealthStatusBadge status={external.status} />
          </Link>
          <p className={dashboardTypography.meta}>
            FTP 미구현 — rollup 제외 (S6-A)
          </p>
        </div>
      ) : null}
    </div>
  );
}
