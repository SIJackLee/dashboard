import Link from "next/link";
import { Search, RefreshCw, Bell, AlertTriangle, WifiOff, Settings } from "lucide-react";
import { FilterBar, SimpleSelect } from "@/components/common/filter-bar";
import { Input } from "@/components/ui/input";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type AlarmSummary = {
  total: number;
  critical: number;
  warning: number;
  offline: number;
};

const SUMMARY_CHIPS = [
  { key: "total" as const, label: "전체", icon: Bell, accent: "" },
  { key: "critical" as const, label: "심각", icon: AlertTriangle, accent: "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200" },
  { key: "warning" as const, label: "주의", icon: AlertTriangle, accent: "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-200" },
  { key: "offline" as const, label: "통신 두절", icon: WifiOff, accent: "border-muted-foreground/30 bg-muted/40" },
];

export function AlarmFilterBar({ summary }: { summary?: AlarmSummary }) {
  return (
    <FilterBar>
      <div className="flex flex-wrap items-center gap-3 self-center">
        {SUMMARY_CHIPS.map((chip) => {
          const Icon = chip.icon;
          const value = summary?.[chip.key] ?? 0;
          return (
            <span
              key={chip.key}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-4 py-2",
                dashboardUi.body,
                "font-medium",
                chip.accent || "bg-muted/30"
              )}
            >
              <Icon className={dashboardUi.iconSm} />
              {chip.label} {value}
            </span>
          );
        })}
      </div>
      <SimpleSelect label="축사" placeholder="전체 축사" />
      <SimpleSelect label="심각도" placeholder="전체 심각도" />
      <SimpleSelect label="상태" placeholder="전체 상태" />
      <div className="space-y-2">
        <label className={dashboardUi.filterLabel}>기간</label>
        <Input type="date" className="h-11 w-52 text-xl" />
      </div>
      <div className="relative min-w-[12rem] flex-1 space-y-2">
        <label className={dashboardUi.filterLabel}>검색</label>
        <div className="relative">
          <Search className="absolute left-3 top-3 size-5 text-muted-foreground" />
          <Input placeholder="알람 유형 검색" className="h-11 pl-10 text-xl" />
        </div>
      </div>
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border hover:bg-muted",
          dashboardUi.refreshBtn,
          dashboardUi.body
        )}
      >
        <RefreshCw className={dashboardUi.iconSm} /> 새로고침
      </button>
      <Link
        href="/settings?tab=alarm"
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border border-emerald-600/30 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-200",
          dashboardUi.refreshBtn,
          dashboardUi.body
        )}
      >
        <Settings className={dashboardUi.iconSm} /> 임계값 설정
      </Link>
    </FilterBar>
  );
}
