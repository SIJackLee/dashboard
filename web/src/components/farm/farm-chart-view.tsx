"use client";

import { useMemo, useState } from "react";
import { UnifiedBarnTrendPanel } from "@/components/farm/unified-barn-trend-panel";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { BarnReading } from "@/lib/data/iot";
import type {
  TrendControllerPeriodData,
  TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import {
  buildFarmChartTree,
  chartScopeLabel,
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
  /** URL 딥링크 집계 범위 (제어 컴포넌트) */
  scope: FarmChartScope;
  onScopeChange?: (scope: FarmChartScope) => void;
  alarmSettings?: AlarmSettings;
  isMobileStack?: boolean;
  /** 차트 탭 활성 — ScopeBar 레이어 툴바 enter/exit */
  layersToolbarActive?: boolean;
  className?: string;
};

/**
 * 농장 보기 «차트» 탭 — 좌측 큰 통합 추이 + 우측 집계 범위 트리.
 * 기본 집계: 선택 농장 전체. 유형 → 축사 → 컨트롤러 (URL chartSp/Stall/Ctrl).
 */
export function FarmChartView({
  readings,
  controllerTrendByPeriod,
  period,
  onPeriodChange,
  scope,
  onScopeChange,
  alarmSettings,
  isMobileStack = false,
  layersToolbarActive = true,
  className,
}: Props) {
  const [expandedSp, setExpandedSp] = useState<Record<string, boolean>>({});
  const [expandedStall, setExpandedStall] = useState<Record<string, boolean>>(
    {},
  );
  const [expandScopeKey, setExpandScopeKey] = useState("");

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

  /** 딥링크 범위 변경 시 트리 펼침 (render-time sync) */
  const scopeExpandKey =
    scope.level === "farm"
      ? "farm"
      : scope.level === "sp"
        ? `sp:${scope.stallTyCode}`
        : scope.level === "stall"
          ? `stall:${scope.stallTyCode}:${scope.stallNo}`
          : `ctrl:${scope.stallTyCode}:${scope.stallNo}:${scope.controllerKey}`;
  if (scopeExpandKey !== expandScopeKey) {
    setExpandScopeKey(scopeExpandKey);
    if (scope.level !== "farm") {
      setExpandedSp((prev) => ({ ...prev, [scope.stallTyCode]: true }));
      if (scope.level !== "sp") {
        const sk = stallExpandKey(scope.stallTyCode, scope.stallNo);
        setExpandedStall((prev) => ({ ...prev, [sk]: true }));
      }
    }
  }

  const selectScope = (next: FarmChartScope) => {
    onScopeChange?.(next);
  };

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
            onSelect={() => selectScope({ level: "farm" })}
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
                  onSelect={() => selectScope(spScope)}
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
                            onSelect={() => selectScope(stallScope)}
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
                                    onSelect={() => selectScope(ctrlScope)}
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
            ? "bg-channel-info/10 font-medium text-channel-info dark:bg-channel-info/15 dark:text-channel-info"
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
