"use client";

import { useMemo, useState } from "react";
import { UnifiedBarnTrendPanel } from "@/components/farm/unified-barn-trend-panel";
import { VoiceReportFab } from "@/components/farm/voice-report-fab";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { FarmKey } from "@/lib/data/farm-key";
import type { BarnReading } from "@/lib/data/iot";
import type {
  TrendControllerPeriodData,
  TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import {
  buildFarmChartTree,
  chartScopeLabel,
  DEFAULT_FARM_CHART_SCOPE,
  filterReadingsByChartScope,
  scopesEqual,
  type FarmChartScope,
} from "@/lib/farm/farm-chart-scope";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

type Props = {
  readings: BarnReading[];
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  period: TrendPeriodId;
  onPeriodChange?: (period: TrendPeriodId) => void;
  alarmSettings?: AlarmSettings;
  isMobileStack?: boolean;
  /** 차트 탭 활성 — ScopeBar 레이어 툴바 enter/exit */
  layersToolbarActive?: boolean;
  /** 음성 AI 기본 농장 (URL 선택). 없으면 FAB 숨김 */
  currentFarm?: FarmKey | null;
  className?: string;
};

/**
 * 농장 보기 «차트» 탭 — 좌측 큰 통합 추이 + 우측 집계 범위 트리.
 * 기본 집계: 선택 농장 전체. 축사유형 → 번호 → 컨트롤러로 좁힘.
 */
export function FarmChartView({
  readings,
  controllerTrendByPeriod,
  period,
  onPeriodChange,
  alarmSettings,
  isMobileStack = false,
  layersToolbarActive = true,
  currentFarm = null,
  className,
}: Props) {
  const [scope, setScope] = useState<FarmChartScope>(DEFAULT_FARM_CHART_SCOPE);
  const [expandedSp, setExpandedSp] = useState<Record<string, boolean>>({});
  const [expandedStall, setExpandedStall] = useState<Record<string, boolean>>(
    {},
  );

  const tree = useMemo(() => buildFarmChartTree(readings), [readings]);
  const scopedReadings = useMemo(
    () => filterReadingsByChartScope(readings, scope),
    [readings, scope],
  );

  const controllers = useMemo(
    () =>
      scopedReadings.map((r) => ({
        key: r.controllerKey,
        reading: r,
      })),
    [scopedReadings],
  );

  const label = chartScopeLabel(scope, readings);
  const chartHeight = isMobileStack ? 280 : 420;

  const stallExpandKey = (ty: string, stallNo: string) => `${ty}::${stallNo}`;

  const voiceFab =
    currentFarm != null ? (
      <VoiceReportFab currentFarm={currentFarm} compact={isMobileStack} />
    ) : null;

  return (
    <div className={cn("relative min-h-0", className)} data-tour-id="farm-chart-view">
      <div
        className={cn(
          "flex min-h-0 flex-col gap-3 lg:flex-row lg:items-stretch",
          motionClass.farmChartScopeShell,
        )}
      >
      <div className="min-w-0 flex-1">
        <UnifiedBarnTrendPanel
          label={label}
          controllers={controllers}
          controllerTrendByPeriod={controllerTrendByPeriod}
          period={period}
          onPeriodChange={onPeriodChange}
          alarmSettings={alarmSettings}
          isMobileStack={isMobileStack}
          chartHeight={chartHeight}
          layersToolbarActive={layersToolbarActive}
          className="mt-0"
        />
      </div>

      <aside
        className={cn(
          "w-full shrink-0 rounded-xl border bg-card p-3 lg:w-64 xl:w-72",
          "lg:max-h-[min(70dvh,36rem)] lg:overflow-y-auto",
          motionClass.farmChartPanelShell,
        )}
        data-tour-id="farm-chart-scope-panel"
        aria-label="차트 집계 범위"
      >
        <p className="mb-2 text-xs font-semibold">집계 범위</p>
        <p className="mb-3 text-[0.65rem] leading-snug text-muted-foreground">
          <span className="lg:hidden">농장 전체 기본. 유형·축사·컨트롤러로 좁히기.</span>
          <span className="hidden lg:inline">
            기본은 농장 전체. 유형·축사·컨트롤러를 골라 좁힙니다.
          </span>
        </p>

        <nav className="space-y-0.5 text-sm" aria-label="집계 범위 트리">
          <ScopeRow
            selected={scopesEqual(scope, { level: "farm" })}
            onSelect={() => setScope({ level: "farm" })}
            depth={0}
            label="농장 전체"
            meta={`${readings.length}대`}
          />

          {tree.map((sp) => {
            const spOpen = expandedSp[sp.stallTyCode] ?? true;
            const spScope: FarmChartScope = {
              level: "sp",
              stallTyCode: sp.stallTyCode,
            };
            return (
              <div
                key={sp.stallTyCode}
                role="group"
                aria-label={sp.label}
              >
                <ScopeRow
                  selected={scopesEqual(scope, spScope)}
                  onSelect={() => setScope(spScope)}
                  depth={0}
                  label={sp.label}
                  meta={`${sp.controllerCount}대`}
                  expandable
                  expanded={spOpen}
                  onToggleExpand={() =>
                    setExpandedSp((prev) => ({
                      ...prev,
                      [sp.stallTyCode]: !spOpen,
                    }))
                  }
                />
                {spOpen
                  ? sp.stalls.map((stall) => {
                      const sk = stallExpandKey(sp.stallTyCode, stall.stallNo);
                      const stallOpen = expandedStall[sk] ?? false;
                      const stallScope: FarmChartScope = {
                        level: "stall",
                        stallTyCode: sp.stallTyCode,
                        stallNo: stall.stallNo,
                      };
                      return (
                        <div key={sk}>
                          <ScopeRow
                            selected={scopesEqual(scope, stallScope)}
                            onSelect={() => setScope(stallScope)}
                            depth={1}
                            label={stall.label}
                            meta={`${stall.controllers.length}대`}
                            expandable={stall.controllers.length > 0}
                            expanded={stallOpen}
                            onToggleExpand={() =>
                              setExpandedStall((prev) => ({
                                ...prev,
                                [sk]: !stallOpen,
                              }))
                            }
                          />
                          {stallOpen
                            ? stall.controllers.map((c) => {
                                const ctrlScope: FarmChartScope = {
                                  level: "controller",
                                  stallTyCode: sp.stallTyCode,
                                  stallNo: stall.stallNo,
                                  controllerKey: c.controllerKey,
                                };
                                return (
                                  <ScopeRow
                                    key={c.controllerKey}
                                    selected={scopesEqual(scope, ctrlScope)}
                                    onSelect={() => setScope(ctrlScope)}
                                    depth={2}
                                    label={c.label}
                                  />
                                );
                              })
                            : null}
                        </div>
                      );
                    })
                  : null}
              </div>
            );
          })}
        </nav>
      </aside>
      </div>

      {voiceFab}
    </div>
  );
}

function ScopeRow({
  selected,
  onSelect,
  depth,
  label,
  meta,
  expandable,
  expanded,
  onToggleExpand,
}: {
  selected: boolean;
  onSelect: () => void;
  depth: number;
  label: string;
  meta?: string;
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
}) {
  return (
    <div
      className="flex items-center gap-0.5"
      style={{ paddingLeft: `${depth * 0.75}rem` }}
    >
      {expandable ? (
        <button
          type="button"
          aria-label={expanded ? "접기" : "펼치기"}
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded text-[0.65rem] text-muted-foreground",
            motionClass.microHover,
          )}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand?.();
          }}
        >
          {expanded ? "▾" : "▸"}
        </button>
      ) : (
        <span className="inline-block w-6 shrink-0" aria-hidden />
      )}
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-[0.8rem]",
          motionClass.microHover,
          selected
            ? "bg-sky-50 font-medium text-sky-900 dark:bg-sky-950/50 dark:text-sky-100"
            : "text-foreground hover:bg-muted/50",
        )}
        aria-current={selected ? "true" : undefined}
      >
        <span className="truncate">{label}</span>
        {meta ? (
          <span className="shrink-0 text-[0.65rem] text-muted-foreground">
            {meta}
          </span>
        ) : null}
      </button>
    </div>
  );
}
