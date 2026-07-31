"use client";

import { useMemo, useState } from "react";
import { UnifiedBarnTrendPanel } from "@/components/farm/unified-barn-trend-panel";
import { resolveThresholdsForScope } from "@/lib/data/alarm-scope";
import {
  DEFAULT_ALARM_SETTINGS,
  type AlarmSettings,
  type AlarmSeverity,
  type AlarmThresholds,
} from "@/lib/data/alarms";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { BarnReading } from "@/lib/data/iot";
import type {
  TrendControllerPeriodData,
  TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import { findControllerTrendSeries } from "@/lib/farm/controller-summary-display";
import {
  alarmScopeKeyFromFarmChartScope,
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
  /** LIVE/명령 반영 제어값 */
  thermoSettings?: Record<string, ControllerThermoSettings>;
  /** 조회 전용이면 알람·설정모드 비활성 */
  canCommand?: boolean;
  isMobileStack?: boolean;
  /** 차트 탭 활성 — TopBar 레이어 툴바 enter/exit */
  layersToolbarActive?: boolean;
  className?: string;
};

/**
 * 집계 트리 톤
 * - critical: 경고(빨강) · warning: 주의(주황) · offline: 통신 두절(회색)
 * 롤업 우선: 경고 > 주의 > 통신 두절
 */
type ScopeAlarmTone = Extract<AlarmSeverity, "warning" | "critical"> | "offline";

const SCOPE_TONE_RANK: Record<ScopeAlarmTone, number> = {
  offline: 1,
  warning: 2,
  critical: 3,
};

function worseScopeTone(
  a: ScopeAlarmTone | null | undefined,
  b: ScopeAlarmTone,
): ScopeAlarmTone;
function worseScopeTone(
  a: ScopeAlarmTone,
  b: ScopeAlarmTone | null | undefined,
): ScopeAlarmTone;
function worseScopeTone(
  a: ScopeAlarmTone | null | undefined,
  b: ScopeAlarmTone | null | undefined,
): ScopeAlarmTone | null;
function worseScopeTone(
  a: ScopeAlarmTone | null | undefined,
  b: ScopeAlarmTone | null | undefined,
): ScopeAlarmTone | null {
  if (a == null) return b ?? null;
  if (b == null) return a;
  return SCOPE_TONE_RANK[a] >= SCOPE_TONE_RANK[b] ? a : b;
}

function stallToneKey(stallTyCode: string, stallNo: string): string {
  return `${normalizeStallTyCode(stallTyCode)}::${stallNo.trim()}`;
}

/** 선택 기간 추이 시리즈가 농장 알람 구간을 이탈했는지 */
function toneFromPeriodSeries(
  temp: (number | null)[] | undefined,
  humidity: (number | null)[] | undefined,
  thresholds: AlarmThresholds,
): ScopeAlarmTone | null {
  let tone: ScopeAlarmTone | null = null;
  for (const t of temp ?? []) {
    if (t == null || !Number.isFinite(t)) continue;
    if (t >= thresholds.tempHigh) {
      tone = worseScopeTone(tone, "critical");
    } else if (t <= thresholds.tempLow) {
      tone = worseScopeTone(tone, "warning");
    }
  }
  for (const h of humidity ?? []) {
    if (h == null || !Number.isFinite(h)) continue;
    if (h >= thresholds.humidityHigh || h <= thresholds.humidityLow) {
      tone = worseScopeTone(tone, "warning");
    }
  }
  return tone;
}

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
  thermoSettings,
  canCommand = false,
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

  /**
   * B안 — 현재 기간 추이 이탈로 색칠 (LIVE 아님).
   * 임계는 농장 전체 차트 알람선과 동일. 통신 두절만 LIVE.
   */
  const alarmTones = useMemo(() => {
    const settings = alarmSettings ?? DEFAULT_ALARM_SETTINGS;
    const farmScopeKey = alarmScopeKeyFromFarmChartScope(readings, {
      level: "farm",
    });
    const thresholds = farmScopeKey
      ? resolveThresholdsForScope(settings, farmScopeKey)
      : settings.global;

    const byCtrl = new Map<string, ScopeAlarmTone>();
    const byStall = new Map<string, ScopeAlarmTone>();
    const bySp = new Map<string, ScopeAlarmTone>();
    let farm: ScopeAlarmTone | null = null;

    for (const r of readings) {
      const ctrlKey = r.controllerKey?.trim();
      if (!ctrlKey) continue;

      let tone: ScopeAlarmTone | null = null;
      if (r.status === "offline") {
        tone = "offline";
      }

      const series = findControllerTrendSeries(
        controllerTrendByPeriod,
        period,
        r.stallTyCode,
        r.stallNo,
        r.controllerKey,
      );
      if (series) {
        tone = worseScopeTone(
          tone,
          toneFromPeriodSeries(series.temp, series.humidity, thresholds),
        );
      }

      if (!tone) continue;

      byCtrl.set(ctrlKey, worseScopeTone(byCtrl.get(ctrlKey), tone));
      const sp = r.stallTyCode ? normalizeStallTyCode(r.stallTyCode) : "";
      const stall = r.stallNo?.trim() ?? "";
      if (sp && stall) {
        const sk = stallToneKey(sp, stall);
        byStall.set(sk, worseScopeTone(byStall.get(sk), tone));
      }
      if (sp) {
        bySp.set(sp, worseScopeTone(bySp.get(sp), tone));
      }
      farm = worseScopeTone(farm, tone);
    }

    return { byCtrl, byStall, bySp, farm };
  }, [readings, alarmSettings, controllerTrendByPeriod, period]);

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
          thermoSettings={thermoSettings}
          chartScope={scope}
          onScopeChange={onScopeChange}
          canCommand={canCommand}
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
            tone={alarmTones.farm}
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
                  tone={alarmTones.bySp.get(sp.stallTyCode) ?? null}
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
                            tone={
                              alarmTones.byStall.get(
                                stallToneKey(sp.stallTyCode, stall.stallNo),
                              ) ?? null
                            }
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
                                    tone={
                                      alarmTones.byCtrl.get(c.controllerKey) ??
                                      null
                                    }
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
  tone,
  expandable,
  expanded,
  onToggleExpand,
}: {
  selected: boolean;
  onSelect: () => void;
  depth: number;
  label: string;
  meta?: string;
  tone?: ScopeAlarmTone | null;
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const toneLabel =
    tone === "critical"
      ? "경고"
      : tone === "warning"
        ? "주의"
        : tone === "offline"
          ? "통신 두절"
          : undefined;

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
        title={toneLabel ? `${label} · ${toneLabel}` : undefined}
        aria-label={toneLabel ? `${label}, ${toneLabel}` : undefined}
        className={cn(
          "flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-[0.8rem]",
          motionClass.microHover,
          selected
            ? "bg-channel-info/10 font-medium dark:bg-channel-info/15"
            : "hover:bg-muted/50",
          !selected && !tone && "text-foreground",
          !selected && tone === "warning" && "text-amber-700 dark:text-amber-400",
          !selected && tone === "critical" && "text-destructive",
          !selected && tone === "offline" && "text-muted-foreground",
          selected && !tone && "text-channel-info dark:text-channel-info",
          selected &&
            tone === "warning" &&
            "text-amber-800 dark:text-amber-300",
          selected && tone === "critical" && "text-destructive",
          selected && tone === "offline" && "text-muted-foreground",
        )}
        aria-current={selected ? "true" : undefined}
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          {tone ? (
            <span
              className={cn(
                "inline-block size-1.5 shrink-0 rounded-full",
                tone === "critical" && "bg-destructive",
                tone === "warning" && "bg-amber-500",
                tone === "offline" && "bg-muted-foreground/70",
              )}
              aria-hidden
            />
          ) : null}
          <span className="truncate">{label}</span>
        </span>
        {meta ? (
          <span
            className={cn(
              "shrink-0 text-[0.65rem]",
              tone === "critical"
                ? "text-destructive/80"
                : tone === "warning"
                  ? "text-amber-700/80 dark:text-amber-400/80"
                  : "text-muted-foreground",
            )}
          >
            {meta}
          </span>
        ) : null}
      </button>
    </div>
  );
}
