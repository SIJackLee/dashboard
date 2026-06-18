import Link from "next/link";
import type { HealthSnapshot } from "@/lib/admin/health/types";
import { HealthControllerTable } from "@/components/admin/health/health-controller-table";
import { HealthFarmModuleTable } from "@/components/admin/health/health-farm-module-table";
import { HealthStatusBadge } from "@/components/admin/health/health-status-badge";
import {
  controllersForFarm,
  modulesForFarm,
} from "@/lib/admin/health/fetch-snapshot";
import { worstStatus } from "@/lib/admin/health/staleness";
import { farmKeyUrlSlug, parseFarmKeyUrlSlug } from "@/lib/data/farm-key";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type HealthFarmDetailViewProps = {
  farmSlug: string;
  snapshot: HealthSnapshot;
};

export function HealthFarmDetailView({
  farmSlug,
  snapshot,
}: HealthFarmDetailViewProps) {
  const farmKey = parseFarmKeyUrlSlug(farmSlug);
  const farmId = farmKey
    ? `${farmKey.lsindRegistNo}/${farmKey.itemCode}`
    : farmSlug.replace("--", "/");

  const modules = modulesForFarm(snapshot.modules, farmId);
  const controllers = controllersForFarm(snapshot.controllers, farmId);
  const worst = worstStatus([
    ...modules.map((m) => m.status),
    ...controllers.map((c) => c.status),
  ]);

  const farmLabel = modules[0]?.farmLabel ?? controllers[0]?.farmLabel ?? farmId;

  return (
    <div className="space-y-6">
      <p className={dashboardTypography.meta}>
        /admin/health/farm/{farmKeyUrlSlug(farmId)} · 농장 drill-down
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <HealthStatusBadge status={worst} />
        <span className={dashboardTypography.body}>
          {farmLabel} · 모듈 {modules.length} · 장비 {controllers.length}
        </span>
      </div>

      <section className="rounded-xl border bg-card p-5">
        <h2 className={cn(dashboardTypography.cardTitle, "mb-4")}>
          모듈 (worst rollup)
        </h2>
        <HealthFarmModuleTable modules={modules} />
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className={cn(dashboardTypography.cardTitle, "mb-4")}>
          장비 (controller_key)
        </h2>
        <HealthControllerTable controllers={controllers} />
      </section>

      <p className={dashboardTypography.meta}>
        <Link href="/admin/health/field-module" className="hover:underline">
          통신 모듈 노드 상세
        </Link>
        {" · "}
        <Link href="/admin/health/field-controller" className="hover:underline">
          환경 컨트롤러 노드 상세
        </Link>
      </p>
    </div>
  );
}
