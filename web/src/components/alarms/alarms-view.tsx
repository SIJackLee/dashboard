"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppNavLink } from "@/components/layout/app-nav-link";
import { ScopeBar } from "@/components/layout/scope-bar";
import { Search, RefreshCw, Bell, AlertTriangle, WifiOff, Settings } from "lucide-react";
import { FilterBar, SimpleSelect } from "@/components/common/filter-bar";
import { MasterDetailLayout } from "@/components/common/master-detail-layout";
import { PageActionButton } from "@/components/common/page-action-button";
import { AlarmTable } from "@/components/alarms/alarm-table";
import { AlarmTriagePanel } from "@/components/alarms/alarm-triage-panel";
import { Input } from "@/components/ui/input";
import type { AlarmRow } from "@/lib/data/alarms";
import type { ThermoCommand } from "@/lib/data/commands";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { ControllerReading } from "@/lib/data/iot";
import type { FarmKey } from "@/lib/data/farm-key";
import type { FarmSummaryRow } from "@/lib/data/farm-summaries";
import { formatStallTypeLabel } from "@/lib/data/stall-type";
import { FILTER_ALL, FILTER_ALL_LABEL, isFilterAll } from "@/lib/ui/filter-all";
import { devicesAlarmSettingsHref } from "@/lib/monitoring/devices-panel";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import { useDisplayEnabled } from "@/components/display/display-settings-provider";
import { setMonitoringTabParam } from "@/lib/monitoring/monitoring-tabs";

type AlarmSummary = {
  total: number;
  critical: number;
  warning: number;
  offline: number;
};

const SUMMARY_CHIPS = [
  { key: "total" as const, filter: "all", label: "전체", icon: Bell, accent: "" },
  {
    key: "critical" as const,
    filter: "critical",
    label: "심각",
    icon: AlertTriangle,
    accent: "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200",
  },
  {
    key: "warning" as const,
    filter: "warning",
    label: "주의",
    icon: AlertTriangle,
    accent: "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-200",
  },
  {
    key: "offline" as const,
    filter: "offline",
    label: "통신 두절",
    icon: WifiOff,
    accent: "border-muted-foreground/30 bg-muted/40",
  },
] as const;

type FilterKind = (typeof SUMMARY_CHIPS)[number]["filter"];

type Props = {
  alarms: AlarmRow[];
  summary: AlarmSummary;
  selectedId?: string;
  groupByFarm?: boolean;
  readings?: ControllerReading[];
  canCommand?: boolean;
  commands?: ThermoCommand[];
  thermoSettings?: Record<string, ControllerThermoSettings>;
  isAdmin?: boolean;
  farmOptions?: FarmKey[];
  activeFarmKey?: FarmKey | null;
  farmSummaries?: FarmSummaryRow[];
  /** Monitoring 허브(/farm) 내 embedded — URL sync 대상 */
  embedded?: boolean;
};

export function AlarmsView({
  alarms,
  summary,
  selectedId,
  groupByFarm = false,
  readings = [],
  canCommand = false,
  commands = [],
  thermoSettings = {},
  isAdmin = false,
  farmOptions = [],
  activeFarmKey = null,
  farmSummaries = [],
  embedded = false,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showFilterBar = useDisplayEnabled("alarm.filterBar");
  const showDetailPanel = useDisplayEnabled("alarm.detailPanel");
  const [chipFilter, setChipFilter] = useState<FilterKind>("all");
  const [severity, setSeverity] = useState(FILTER_ALL);
  const [spFilter, setSpFilter] = useState(FILTER_ALL);
  const [search, setSearch] = useState("");

  const showAdminScope = isAdmin && farmOptions.length > 0;

  const spOptions = useMemo(() => {
    const codes = [...new Set(alarms.map((a) => a.stallTyCode).filter(Boolean))] as string[];
    return [
      { value: FILTER_ALL, label: FILTER_ALL_LABEL },
      ...codes.map((c) => ({ value: c, label: formatStallTypeLabel(c) })),
    ];
  }, [alarms]);

  const filtered = useMemo(() => {
    return alarms.filter((a) => {
      if (chipFilter === "critical" && a.severity !== "critical") return false;
      if (chipFilter === "warning" && a.severity !== "warning") return false;
      if (chipFilter === "offline" && a.alarmType !== "통신 두절") return false;
      if (!isFilterAll(severity) && a.severity !== severity) return false;
      if (!isFilterAll(spFilter) && a.stallTyCode !== spFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (
          !a.alarmType.toLowerCase().includes(q) &&
          !a.detail.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [alarms, chipFilter, severity, spFilter, search]);

  const selected =
    filtered.find((a) => a.id === selectedId) ??
    alarms.find((a) => a.id === selectedId) ??
    filtered[0];

  const selectAlarm = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("alarm", id);
    const base = embedded ? "/farm" : "/alarms";
    if (embedded) setMonitoringTabParam(params, "ops");
    router.replace(`${base}?${params.toString()}`, { scroll: false });
  };

  const resetFilters = () => {
    setChipFilter("all");
    setSeverity(FILTER_ALL);
    setSpFilter(FILTER_ALL);
    setSearch("");
  };

  const master = (
    <>
      {showAdminScope ? (
        <ScopeBar
          sticky
          adminFarmSwitcher={{
            farmOptions,
            activeFarmKey,
            farmSummaries,
          }}
          onRefresh={() => router.refresh()}
        />
      ) : null}
      {showFilterBar ? (
        <FilterBar>
          <div className="flex flex-wrap items-center gap-3 self-center">
            {SUMMARY_CHIPS.map((chip) => {
              const Icon = chip.icon;
              const value = summary[chip.key] ?? 0;
              const active = chipFilter === chip.filter;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setChipFilter(chip.filter)}
                  aria-label={`${chip.label} 필터${value > 0 ? ` · ${value}건` : ""}`}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg border px-4 py-2 font-medium transition-colors",
                    dashboardUi.body,
                    chip.accent || "bg-muted/30",
                    active && "ring-2 ring-emerald-500/40"
                  )}
                >
                  <Icon className={dashboardUi.iconSm} />
                  {chip.label}
                </button>
              );
            })}
          </div>
          <SimpleSelect
            label="축사"
            placeholder={FILTER_ALL_LABEL}
            options={spOptions}
            value={spFilter}
            onValueChange={(v) => v && setSpFilter(v)}
          />
          <SimpleSelect
            label="심각도"
            placeholder={FILTER_ALL_LABEL}
            options={[
              { value: FILTER_ALL, label: FILTER_ALL_LABEL },
              { value: "critical", label: "심각" },
              { value: "warning", label: "주의" },
            ]}
            value={severity}
            onValueChange={(v) => v && setSeverity(v)}
          />
          <div className="relative min-w-[12rem] flex-1 space-y-2">
            <label className={dashboardUi.filterLabel}>검색</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 size-5 text-muted-foreground" />
              <Input
                placeholder="알람 유형 검색"
                className="h-11 pl-10 text-xl"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <PageActionButton
            icon={<RefreshCw className={dashboardUi.iconSm} aria-hidden />}
            onClick={() => router.refresh()}
          >
            새로고침
          </PageActionButton>
          <PageActionButton
            icon={<Search className={dashboardUi.iconSm} aria-hidden />}
            onClick={resetFilters}
          >
            초기화
          </PageActionButton>
          <AppNavLink
            href={devicesAlarmSettingsHref(searchParams)}
            message="알람 설정으로 이동 중…"
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border border-emerald-600/30 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-200",
              dashboardUi.btnSmAction
            )}
          >
            <Settings className={dashboardUi.iconSm} /> 임계값 설정
          </AppNavLink>
        </FilterBar>
      ) : null}
      <AlarmTable
        alarms={filtered}
        selectedId={selected?.id}
        initialExpandedSp={!isFilterAll(spFilter) ? spFilter : undefined}
        groupByFarm={groupByFarm}
        onAlarmSelect={selectAlarm}
      />
    </>
  );

  return (
    <MasterDetailLayout
      showDetail={showDetailPanel}
      master={master}
      detail={
        <AlarmTriagePanel alarm={selected} />
      }
    />
  );
}
