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
  hideTitle?: boolean;
  limit?: number;
  compact?: boolean;
};

export function HealthModuleAgeChart({
  modules,
  hideTitle = false,
  limit = 8,
  compact = false,
}: HealthModuleAgeChartProps) {
  const top = modules.slice(0, limit);  const items = top.map((m) => ({
    id: m.id,
    label: `${m.farmLabel} · ${m.moduleLabel}`,
    value: m.ageMin,
    title: `${m.farmLabel} · ${m.ageMin?.toFixed(1) ?? "--"} min`,
  }));

  return (
    <div className="space-y-2">
      {hideTitle ? null : (
        <p className={cn(dashboardTypography.sectionTitle)}>모듈별 last seen age</p>
      )}
      <HorizontalBarChart
        items={items}
        unit=" min"
        maxValue={Math.max(MODULE_AGE_CRITICAL_MIN * 1.5, 20)}
        barClassName="bg-amber-500"
        emptyLabel="모듈 데이터 없음"
      />
      {compact ? null : (
        <p className={dashboardTypography.meta}>
          참조: 정상 ≤ {MODULE_AGE_OK_MIN}m · 경고 ≥ {MODULE_AGE_CRITICAL_MIN}m (동일 컨트롤러)
        </p>
      )}    </div>
  );
}
