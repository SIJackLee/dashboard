import type { CollectorGroupHealthRow, HealthSnapshot } from "@/lib/admin/health/types";
import { HealthCollectorGroupTable } from "@/components/admin/health/health-collector-group-table";
import { HealthFarmModuleTable } from "@/components/admin/health/health-farm-module-table";
import { HealthInsertRateChart } from "@/components/admin/health/health-insert-rate-chart";
import { HealthStatusBadge } from "@/components/admin/health/health-status-badge";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type HealthGroupDetailViewProps = {
  group: CollectorGroupHealthRow;
  snapshot: HealthSnapshot;
};

export function HealthGroupDetailView({
  group,
  snapshot,
}: HealthGroupDetailViewProps) {
  const modules = snapshot.modules.filter((m) =>
    group.farmIds.includes(m.farmId)
  );

  return (
    <div className="space-y-6">
      <p className={dashboardTypography.meta}>
        /admin/health/group/{group.id} · 수집 서버 그룹 drill-down (R3)
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <HealthStatusBadge status={group.status} />
        <span className={dashboardTypography.body}>
          {group.label} · 농장 {group.farmCount} · 모듈 {group.moduleCount} ·
          이상 {group.badModuleCount} · 범위 {group.scope}
        </span>
      </div>

      {group.scope === "R3" ? (
        <div className="rounded-xl border border-amber-300/50 bg-amber-50 px-5 py-4">
          <p className={dashboardTypography.body}>
            D11 R3 — 동일 그룹 내 다수 모듈 이상. 다른 수집 그룹은 정상인지
            비교하세요.
          </p>
        </div>
      ) : null}

      <section className="rounded-xl border bg-card p-5">
        <HealthInsertRateChart buckets={group.insertBuckets} />
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className={cn(dashboardTypography.cardTitle, "mb-4")}>
          그룹 내 모듈
        </h2>
        <HealthFarmModuleTable modules={modules} />
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className={cn(dashboardTypography.cardTitle, "mb-4")}>
          전체 수집 그룹
        </h2>
        <HealthCollectorGroupTable groups={snapshot.collectorGroups} />
      </section>
    </div>
  );
}
