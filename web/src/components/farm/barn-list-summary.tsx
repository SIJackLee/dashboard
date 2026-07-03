"use client";

import { useMemo } from "react";
import { Check } from "lucide-react";
import {
  ControllerSummaryGaugeRow,
} from "@/components/farm/controller-summary-gauge-row";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { BarnReading } from "@/lib/data/iot";
import type { TrendControllerPeriodData, TrendPeriodId } from "@/lib/data/farm-trend-types";
import { groupReadingsByHierarchy } from "@/lib/data/reading-hierarchy";
import { summarizeReadings } from "@/lib/data/hierarchy-summary";
import {
  isBarnListGraphExpanded,
  isBarnListMotorExpanded,
  isBarnListSettingsExpanded,
  type BarnListPanelSets,
} from "@/lib/farm/barn-list-panel-state";
import type { BarnListViewMode } from "@/lib/farm/farm-view-url";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import { StatusBadge } from "@/components/common/status-badge";
import { EnvChip } from "@/components/common/env-chip";
import { dashboardUi, dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type ListLayout = "group" | "flat";

type Props = {
  readings: BarnReading[];
  thermoSettings: Record<string, ControllerThermoSettings>;
  alarmSettings?: AlarmSettings;
  canCommand?: boolean;
  layout?: ListLayout;
  listMode?: BarnListViewMode;
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  trendLoading?: boolean;
  trendStale?: boolean;
  panelSets: BarnListPanelSets;
  onToggleGraph: (key: string) => void;
  onToggleSettings: (key: string) => void;
  onToggleMotor: (key: string) => void;
  bulkMode?: boolean;
  selectedSps?: ReadonlySet<string>;
  onToggleSp?: (stallTyCode: string) => void;
};

/** flat(일반 보기) — 전체 너비 · 최대 5열 */
const CONTROLLER_GRID_FLAT =
  "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5";

/** group(SP 구역) — xl+ 2열 SP 안에서는 컨트롤러 max 2열 */
const CONTROLLER_GRID_IN_SP =
  "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2";

function ControllerCardGrid({
  readings,
  allReadings,
  thermoSettings,
  alarmSettings,
  canCommand,
  controllerTrendByPeriod,
  trendLoading = false,
  trendStale = false,
  panelSets,
  listMode,
  onToggleGraph,
  onToggleSettings,
  onToggleMotor,
  inSpSection = false,
  bulkMode = false,
  selectedSps,
}: {
  readings: BarnReading[];
  allReadings: BarnReading[];
  thermoSettings: Record<string, ControllerThermoSettings>;
  alarmSettings?: AlarmSettings;
  canCommand: boolean;
  controllerTrendByPeriod: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  trendLoading?: boolean;
  trendStale?: boolean;
  panelSets: BarnListPanelSets;
  listMode: BarnListViewMode;
  onToggleGraph: (key: string) => void;
  onToggleSettings: (key: string) => void;
  onToggleMotor: (key: string) => void;
  inSpSection?: boolean;
  bulkMode?: boolean;
  selectedSps?: ReadonlySet<string>;
}) {
  return (
    <div className={inSpSection ? CONTROLLER_GRID_IN_SP : CONTROLLER_GRID_FLAT}>
      {readings.map((r) => {
        const spCode = normalizeStallTyCode(r.stallTyCode ?? "");
        const spSelected =
          !bulkMode || (selectedSps?.has(spCode) ?? false);
        return (
        <ControllerSummaryGaugeRow
          key={`${r.key}-${listMode}`}
          reading={r}
          readings={allReadings}
          thermoSettings={thermoSettings}
          alarmSettings={alarmSettings}
          canCommand={canCommand}
          listMode={listMode}
          className={bulkMode && !spSelected ? "opacity-50" : undefined}
          graphExpanded={isBarnListGraphExpanded(r.key, listMode, panelSets)}
          settingsExpanded={isBarnListSettingsExpanded(r.key, listMode, panelSets)}
          motorExpanded={isBarnListMotorExpanded(r.key, listMode, panelSets)}
          onToggleGraph={!bulkMode ? () => onToggleGraph(r.key) : undefined}
          onToggleSettings={!bulkMode ? () => onToggleSettings(r.key) : undefined}
          onToggleMotor={!bulkMode ? () => onToggleMotor(r.key) : undefined}
          controllerTrendByPeriod={controllerTrendByPeriod}
          trendLoading={trendLoading}
          trendStale={trendStale}
        />
        );
      })}
    </div>
  );
}

function SpBulkChipRow({
  groups,
  selectedSps,
  onToggleSp,
}: {
  groups: ReturnType<typeof groupReadingsByHierarchy>;
  selectedSps: ReadonlySet<string>;
  onToggleSp: (stallTyCode: string) => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-2" data-audit-region="barn-list-bulk-sp-chips">
      {groups.map((sp) => {
        const code = normalizeStallTyCode(sp.stallTyCode);
        const selected = selectedSps.has(code);
        return (
          <button
            key={code}
            type="button"
            onClick={() => onToggleSp(sp.stallTyCode)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              selected
                ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                : "border-border bg-background text-muted-foreground hover:bg-muted/50"
            )}
          >
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded border",
                selected
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-muted-foreground/40 bg-background"
              )}
              aria-hidden
            >
              {selected ? <Check className="size-2.5" /> : null}
            </span>
            {sp.label}
          </button>
        );
      })}
    </div>
  );
}

export function BarnListSummary({
  readings,
  thermoSettings,
  alarmSettings,
  canCommand = false,
  layout = "group",
  listMode = "controller",
  controllerTrendByPeriod = null,
  trendLoading = false,
  trendStale = false,
  panelSets,
  onToggleGraph,
  onToggleSettings,
  onToggleMotor,
  bulkMode = false,
  selectedSps = new Set(),
  onToggleSp,
}: Props) {
  const groups = useMemo(() => groupReadingsByHierarchy(readings), [readings]);

  const gridProps = {
    allReadings: readings,
    thermoSettings,
    alarmSettings,
    canCommand,
    controllerTrendByPeriod,
    trendLoading,
    trendStale,
    panelSets,
    listMode,
    onToggleGraph,
    onToggleSettings,
    onToggleMotor,
    bulkMode,
    selectedSps,
  };

  if (readings.length === 0) {
    return (
      <p className={cn("py-10 text-center text-muted-foreground", dashboardUi.body)}>
        표시할 데이터가 없습니다.
      </p>
    );
  }

  if (layout === "flat") {
    return (
      <div className="min-w-0" data-audit-region="barn-list-summary" data-list-layout="flat" data-list-mode={listMode}>
        {bulkMode && onToggleSp ? (
          <SpBulkChipRow
            groups={groups}
            selectedSps={selectedSps}
            onToggleSp={onToggleSp}
          />
        ) : null}
        <ControllerCardGrid readings={readings} {...gridProps} />
      </div>
    );
  }

  return (
    <div
      className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2"
      data-audit-region="barn-list-summary"
      data-list-layout="group"
      data-list-mode={listMode}
      data-sp-columns="dual-xl"
      data-bulk-mode={bulkMode ? "on" : undefined}
    >
      {groups.map((sp) => {
        const allReadings = sp.stalls.flatMap((s) => s.readings);
        const summary = summarizeReadings(allReadings);
        const ctrlCount = allReadings.length;
        const spCode = normalizeStallTyCode(sp.stallTyCode);
        const spSelected = !bulkMode || selectedSps.has(spCode);

        return (
          <section
            key={sp.stallTyCode}
            className={cn(
              "min-w-0 overflow-hidden rounded-xl border bg-muted/20 transition-opacity",
              bulkMode && !spSelected && "opacity-50"
            )}
          >
            <header
              role={bulkMode && onToggleSp ? "button" : undefined}
              tabIndex={bulkMode && onToggleSp ? 0 : undefined}
              onClick={
                bulkMode && onToggleSp
                  ? () => onToggleSp(sp.stallTyCode)
                  : undefined
              }
              onKeyDown={
                bulkMode && onToggleSp
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onToggleSp(sp.stallTyCode);
                      }
                    }
                  : undefined
              }
              className={cn(
                "flex min-w-0 w-full flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2.5 text-left sm:px-4",
                bulkMode && onToggleSp && "cursor-pointer hover:bg-muted/60",
                bulkMode && spSelected && "bg-emerald-500/5 ring-2 ring-inset ring-emerald-500/40"
              )}
            >
              {bulkMode ? (
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded border",
                    spSelected
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-muted-foreground/40 bg-background"
                  )}
                  aria-hidden
                >
                  {spSelected ? <Check className="size-3.5" /> : null}
                </span>
              ) : null}
              <h3 className={cn("font-semibold", dashboardUi.cardTitle)}>{sp.label}</h3>
              <span className={cn("text-muted-foreground", dashboardTypography.meta)}>
                {ctrlCount}대
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <StatusBadge tone={summary.status} compact />
                <EnvChip
                  kind="temp"
                  value={
                    summary.status === "offline"
                      ? null
                      : summary.tempC != null
                        ? summary.tempC.toFixed(1)
                        : null
                  }
                />
                <EnvChip
                  kind="humidity"
                  value={
                    summary.status === "offline"
                      ? null
                      : summary.humidityPct != null
                        ? summary.humidityPct.toFixed(0)
                        : null
                  }
                />
              </div>
            </header>

            <div
              className={cn(
                "space-y-4 p-3 sm:p-4",
                bulkMode && !spSelected && "pointer-events-none"
              )}
            >
              {sp.stalls.map((stall) => (
                <div key={`${sp.stallTyCode}-${stall.stallKey}`} className="min-w-0">
                  <div
                    className={cn(
                      "mb-2 flex min-w-0 items-center gap-2 pl-1 sm:pl-2",
                      dashboardUi.body
                    )}
                  >
                    <span className="font-semibold text-muted-foreground">{stall.label}</span>
                    <span className={cn("text-muted-foreground", dashboardTypography.meta)}>
                      {stall.readings.length}대
                    </span>
                  </div>
                  <ControllerCardGrid
                    readings={stall.readings}
                    inSpSection
                    {...gridProps}
                  />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
