import { HorizontalBarChart } from "@/components/common/horizontal-bar-chart";
import {
  MODULE_AGE_CRITICAL_MIN,
  MODULE_AGE_OK_MIN,
} from "@/lib/admin/health/constants";
import type { ModuleHealthRow } from "@/lib/admin/health/types";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type HealthModuleAgeChartProps = {
  modules: ModuleHealthRow[];
};

export function HealthModuleAgeChart({ modules }: HealthModuleAgeChartProps) {
  const top = modules.slice(0, 8);
  const items = top.map((m) => ({
    id: m.id,
    label: `${m.farmLabel} · ${m.moduleLabel}`,
    value: m.ageMin,
    title: `${m.farmLabel} · ${m.ageMin?.toFixed(1) ?? "--"} min`,
  }));

  return (
    <div className="space-y-2">
      <p className={cn(dashboardTypography.sectionTitle)}>모듈별 last seen age</p>
      <HorizontalBarChart
        items={items}
        unit=" min"
        maxValue={Math.max(MODULE_AGE_CRITICAL_MIN * 1.5, 20)}
        barClassName="bg-amber-500"
        emptyLabel="모듈 데이터 없음"
      />
      <p className={dashboardTypography.meta}>
        참조: ok ≤ {MODULE_AGE_OK_MIN}m · critical ≥ {MODULE_AGE_CRITICAL_MIN}m (D9)
      </p>
    </div>
  );
}
