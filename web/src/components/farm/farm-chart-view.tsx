"use client";

import { useMemo, useState } from "react";
import { PanelRight, PanelRightClose, X } from "lucide-react";
import { UnifiedBarnTrendPanel } from "@/components/farm/unified-barn-trend-panel";
import { resolveThresholdsForScope } from "@/lib/data/alarm-scope";
import {
  DEFAULT_ALARM_SETTINGS,
  type AlarmSettings,
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
  type ChartTrendZoomHint,
  type FarmChartScope,
} from "@/lib/farm/farm-chart-scope";
import { farmChartUi } from "@/lib/ui/farm-chart-ui-scale";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";
import { StallUnitNoMark } from "@/components/farm/controller-summary-parts";
import type { ReactNode } from "react";

type Props = {
  readings: BarnReading[];
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  period: TrendPeriodId;
  onPeriodChange?: (period: TrendPeriodId) => void;
  /** URL 딥링크 집계 범위 (제어 컴포넌트) */
  scope: FarmChartScope;
  onScopeChange?: (scope: FarmChartScope) => void;
  /** P2 — URL chartYBand/chartX* → 온도 레인 등 초기 줌 */
  initialZoom?: ChartTrendZoomHint | null;
  /** E — 집중 칩 → URL chartYBand 동기화 */
  onZoomChange?: (zoom: ChartTrendZoomHint | null) => void;
  alarmSettings?: AlarmSettings;
  /** LIVE/명령 반영 제어값 */
  thermoSettings?: Record<string, ControllerThermoSettings>;
  //** 조회 전용이면 임계 가이드·설정모드 비활성 */
  canCommand?: boolean;
  isMobileStack?: boolean;
  /** 차트 탭 활성 — TopBar 레이어 툴바 enter/exit */
  layersToolbarActive?: boolean;
  className?: string;
};

/**
 * 집계 트리 톤 (이상상황 ≠ 임계 가이드)
 * - offline: 통신 두절 (정책상 이상상황)
 * - guide: 온·습 임계 이탈 (표시 가이드, 알람 아님)
 * 롤업 우선: 통신 두절 > 임계 이탈
 */
type ScopeTreeTone = "offline" | "guide";

const SCOPE_TONE_RANK: Record<ScopeTreeTone, number> = {
  guide: 1,
  offline: 2,
};

function worseScopeTone(
  a: ScopeTreeTone | null | undefined,
  b: ScopeTreeTone,
): ScopeTreeTone;
function worseScopeTone(
  a: ScopeTreeTone,
  b: ScopeTreeTone | null | undefined,
): ScopeTreeTone;
function worseScopeTone(
  a: ScopeTreeTone | null | undefined,
  b: ScopeTreeTone | null | undefined,
): ScopeTreeTone | null;
function worseScopeTone(
  a: ScopeTreeTone | null | undefined,
  b: ScopeTreeTone | null | undefined,
): ScopeTreeTone | null {
  if (a == null) return b ?? null;
  if (b == null) return a;
  return SCOPE_TONE_RANK[a] >= SCOPE_TONE_RANK[b] ? a : b;
}

function stallToneKey(stallTyCode: string, stallNo: string): string {
  return `${normalizeStallTyCode(stallTyCode)}::${stallNo.trim()}`;
}

/** 선택 기간 추이가 임계 가이드 구간을 이탈했는지 (알람 아님) */
function guideToneFromPeriodSeries(
  temp: (number | null)[] | undefined,
  humidity: (number | null)[] | undefined,
  thresholds: AlarmThresholds,
): ScopeTreeTone | null {
  for (const t of temp ?? []) {
    if (t == null || !Number.isFinite(t)) continue;
    if (t >= thresholds.tempHigh || t <= thresholds.tempLow) return "guide";
  }
  for (const h of humidity ?? []) {
    if (h == null || !Number.isFinite(h)) continue;
    if (h >= thresholds.humidityHigh || h <= thresholds.humidityLow) {
      return "guide";
    }
  }
  return null;
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
  initialZoom = null,
  onZoomChange,
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
  /** 모바일 — 집계 오버레이 */
  const [scopePanelOpen, setScopePanelOpen] = useState(false);
  /** PC — 우측 집계 레일 (필드 현황과 동일 접기 정책) */
  const [scopeRailOpen, setScopeRailOpen] = useState(true);

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
   * 집계 트리: 통신 두절(LIVE) + 임계 가이드 이탈(기간 추이). 임계 이탈은 이상상황과 분리.
   */
  const scopeTones = useMemo(() => {
    const settings = alarmSettings ?? DEFAULT_ALARM_SETTINGS;
    const farmScopeKey = alarmScopeKeyFromFarmChartScope(readings, {
      level: "farm",
    });
    const thresholds = farmScopeKey
      ? resolveThresholdsForScope(settings, farmScopeKey)
      : settings.global;

    const byCtrl = new Map<string, ScopeTreeTone>();
    const byStall = new Map<string, ScopeTreeTone>();
    const bySp = new Map<string, ScopeTreeTone>();
    let farm: ScopeTreeTone | null = null;

    for (const r of readings) {
      const ctrlKey = r.controllerKey?.trim();
      if (!ctrlKey) continue;

      let tone: ScopeTreeTone | null = null;
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
          guideToneFromPeriodSeries(series.temp, series.humidity, thresholds),
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
  const chartHeight = isMobileStack ? 320 : 420;

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
    if (isMobileStack) setScopePanelOpen(false);
  };

  const scopeTree = (
    <nav
      className="space-y-0.5"
      aria-label="집계 범위 트리"
    >
      <ScopeRow
        selected={scopesEqual(scope, { level: "farm" })}
        onSelect={() => selectScope({ level: "farm" })}
        depth={0}
        label="농장 전체"
        meta={`${readings.length}대`}
        tone={scopeTones.farm}
        touchFriendly={isMobileStack}
      />

      {tree.map((sp) => {
        const spOpen = expandedSp[sp.stallTyCode] ?? true;
        const spScope: FarmChartScope = {
          level: "sp",
          stallTyCode: sp.stallTyCode,
        };
        return (
          <div key={sp.stallTyCode} role="group" aria-label={sp.label}>
            <ScopeRow
              selected={scopesEqual(scope, spScope)}
              onSelect={() => selectScope(spScope)}
              depth={0}
              label={sp.label}
              meta={`${sp.controllerCount}대`}
              tone={scopeTones.bySp.get(sp.stallTyCode) ?? null}
              expandable
              expanded={spOpen}
              onToggleExpand={() =>
                setExpandedSp((prev) => ({
                  ...prev,
                  [sp.stallTyCode]: !spOpen,
                }))
              }
              touchFriendly={isMobileStack}
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
                        label={
                          <StallUnitNoMark
                            stallNo={
                              stall.stallNo.startsWith("__")
                                ? null
                                : stall.stallNo
                            }
                            className="text-inherit"
                          />
                        }
                        nameForA11y={stall.label}
                        meta={`${stall.controllers.length}대`}
                        tone={
                          scopeTones.byStall.get(
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
                        touchFriendly={isMobileStack}
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
                                  scopeTones.byCtrl.get(c.controllerKey) ?? null
                                }
                                touchFriendly={isMobileStack}
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
  );

  return (
    <div
      className={cn("relative min-h-0", className)}
      data-tour-id="farm-chart-view"
    >
      <div
        className={cn(
          "grid min-h-0 grid-cols-1 gap-3 lg:items-stretch",
          "transition-[grid-template-columns] duration-motion-moderate ease-[var(--motion-ease-standard)]",
          !isMobileStack &&
            (scopeRailOpen
              ? "lg:grid-cols-[minmax(0,1fr)_16rem] xl:grid-cols-[minmax(0,1fr)_18rem]"
              : "lg:grid-cols-[minmax(0,1fr)_2.5rem]"),
          motionClass.farmChartScopeShell,
        )}
        data-farm-chart-scope={
          isMobileStack ? undefined : scopeRailOpen ? "open" : "collapsed"
        }
      >
        <div className="min-w-0 min-h-0">
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
            initialZoom={initialZoom}
            onZoomChange={onZoomChange}
            canCommand={canCommand}
            isMobileStack={isMobileStack}
            chartHeight={chartHeight}
            layersToolbarActive={layersToolbarActive}
            mobileScopeHandle={
              isMobileStack
                ? {
                    open: scopePanelOpen,
                    onOpen: () => setScopePanelOpen(true),
                  }
                : null
            }
            className="mt-0"
          />
        </div>

        {!isMobileStack ? (
          <div className="min-w-0 overflow-hidden">
            <div
              className={cn(
                "ml-auto transition-[width,max-width] duration-motion-moderate ease-[var(--motion-ease-standard)]",
                scopeRailOpen
                  ? "w-full max-w-[16rem] xl:max-w-[18rem]"
                  : "w-10 max-w-10",
              )}
            >
              <aside
                className={cn(
                  "flex w-full flex-col rounded-xl border bg-card",
                  "lg:max-h-[min(70dvh,36rem)]",
                  farmChartUi.root,
                  motionClass.farmChartPanelShell,
                )}
                data-tour-id="farm-chart-scope-panel"
                data-collapsed={scopeRailOpen ? "false" : "true"}
                aria-label="차트 집계 범위"
              >
                <div
                  className={cn(
                    "flex shrink-0 items-center border-b",
                    scopeRailOpen
                      ? "gap-1.5 px-2 py-1.5"
                      : "justify-center px-0.5 py-1.5",
                  )}
                >
                  {scopeRailOpen ? (
                    <p
                      className={cn(
                        "min-w-0 flex-1 truncate font-semibold",
                        farmChartUi.fsLegend,
                      )}
                    >
                      집계 범위
                    </p>
                  ) : null}
                  {scopeRailOpen ? (
                    <button
                      type="button"
                      onClick={() => setScopeRailOpen(false)}
                      className={cn(
                        "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground",
                        "hover:bg-muted/50 hover:text-foreground",
                        motionClass.microHover,
                      )}
                      aria-label="집계 범위 숨기기"
                      data-tour-id="farm-chart-scope-hide"
                    >
                      <PanelRightClose className="size-4" aria-hidden />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setScopeRailOpen(true)}
                      className={cn(
                        "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground",
                        "hover:bg-muted/50 hover:text-foreground",
                        motionClass.microHover,
                      )}
                      aria-label="집계 범위 나타내기"
                      data-tour-id="farm-chart-scope-show"
                    >
                      <PanelRight className="size-4" aria-hidden />
                    </button>
                  )}
                </div>
                <div
                  className={cn(
                    "overflow-hidden transition-[opacity,max-height] duration-motion-moderate ease-[var(--motion-ease-standard)]",
                    scopeRailOpen
                      ? "max-h-[200rem] opacity-100 lg:overflow-y-auto"
                      : "pointer-events-none max-h-0 opacity-0",
                  )}
                  aria-hidden={!scopeRailOpen}
                >
                  <div className="p-3">{scopeTree}</div>
                </div>
              </aside>
            </div>
          </div>
        ) : null}
      </div>

      {isMobileStack && scopePanelOpen ? (
        <div
          className="absolute inset-0 z-30"
          data-tour-id="farm-chart-scope-overlay"
        >
          <button
            type="button"
            className={cn(
              "absolute inset-0 border-0",
              "bg-background/40 backdrop-blur-sm dark:bg-black/40",
              motionClass.enterFade,
            )}
            aria-label="집계 범위 닫기"
            onClick={() => setScopePanelOpen(false)}
          />
          <aside
            className={cn(
              "absolute inset-y-0 right-0 z-[1] flex w-[min(100%,20rem)] flex-col",
              "border-l border-border/80 bg-card/95 backdrop-blur-md",
              farmChartUi.root,
              motionClass.farmChartPanelShell,
              motionClass.enterFade,
            )}
            data-tour-id="farm-chart-scope-panel"
            aria-label="차트 집계 범위"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
              <div className="min-w-0">
                <p className={cn("font-semibold", farmChartUi.fsLegend)}>
                  집계 범위
                </p>
                <p
                  className={cn(
                    "truncate text-muted-foreground",
                    farmChartUi.fsLegend,
                  )}
                >
                  {label}
                </p>
              </div>
              <button
                type="button"
                className={cn(
                  "inline-flex size-9 shrink-0 items-center justify-center rounded-md",
                  "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
                aria-label="집계 범위 닫기"
                onClick={() => setScopePanelOpen(false)}
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
              {scopeTree}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function ScopeRow({
  selected,
  onSelect,
  depth,
  label,
  nameForA11y,
  meta,
  tone,
  expandable,
  expanded,
  onToggleExpand,
  touchFriendly = false,
}: {
  selected: boolean;
  onSelect: () => void;
  depth: number;
  label: ReactNode;
  /** ReactNode label일 때 title/aria용 정식 명칭 */
  nameForA11y?: string;
  meta?: string;
  tone?: ScopeTreeTone | null;
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  touchFriendly?: boolean;
}) {
  const toneLabel =
    tone === "guide"
      ? "임계 이탈"
      : tone === "offline"
        ? "통신 두절"
        : undefined;
  const labelText =
    nameForA11y ?? (typeof label === "string" ? label : undefined);

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
            "flex shrink-0 items-center justify-center rounded text-muted-foreground",
            farmChartUi.fsLegend,
            touchFriendly ? "h-10 w-10" : "h-6 w-6",
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
        <span
          className={cn("inline-block shrink-0", touchFriendly ? "w-10" : "w-6")}
          aria-hidden
        />
      )}
      <button
        type="button"
        onClick={onSelect}
        title={
          toneLabel && labelText
            ? `${labelText} · ${toneLabel}`
            : toneLabel
              ? toneLabel
              : labelText
        }
        aria-label={
          toneLabel && labelText
            ? `${labelText}, ${toneLabel}`
            : toneLabel
              ? toneLabel
              : undefined
        }
        className={cn(
          "flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2 text-left",
          farmChartUi.fsLegend,
          touchFriendly ? "min-h-11 py-2.5" : "py-1",
          motionClass.microHover,
          selected
            ? "bg-channel-info/10 font-medium dark:bg-channel-info/15"
            : "hover:bg-muted/50",
          !selected && !tone && "text-foreground",
          !selected && tone === "guide" && "text-amber-700 dark:text-amber-400",
          !selected && tone === "offline" && "text-muted-foreground",
          selected && !tone && "text-channel-info dark:text-channel-info",
          selected &&
            tone === "guide" &&
            "text-amber-800 dark:text-amber-300",
          selected && tone === "offline" && "text-muted-foreground",
        )}
        aria-current={selected ? "true" : undefined}
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          {tone ? (
            <span
              className={cn(
                "inline-block size-1.5 shrink-0 rounded-full",
                tone === "guide" && "bg-amber-500",
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
              "shrink-0",
              farmChartUi.fsLegend,
              tone === "guide"
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
