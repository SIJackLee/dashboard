"use client";

import { useMemo, useState, type DragEvent, type ReactNode } from "react";
import { PanelRight, PanelRightClose, X } from "lucide-react";
import { UnifiedBarnTrendPanel } from "@/components/farm/unified-barn-trend-panel";
import { buildTrendBrushOverview } from "@/components/farm/unified-barn-trend-panel-helpers";
import {
  BRUSH_PERIOD_WINDOW,
  UnifiedTrendPeriodBrush,
  type BrushWindow,
} from "@/components/farm/unified-trend-period-brush";
import { resolveThresholdsForScope } from "@/lib/data/alarm-scope";
import {
  DEFAULT_ALARM_SETTINGS,
  type AlarmSettings,
  type AlarmThresholds,
} from "@/lib/data/alarms";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { BarnReading } from "@/lib/data/iot";
import {
  isContextControllerTrend30d,
  type TrendControllerPeriodData,
  type TrendPeriodId,
  type TrendWindow15m,
} from "@/lib/data/farm-trend-types";
import type { FarmKey } from "@/lib/data/farm-key";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import { findControllerTrendSeries } from "@/lib/farm/controller-summary-display";
import {
  alarmScopeKeyFromFarmChartScope,
  buildFarmChartTree,
  chartScopeLabel,
  clampChartScopeToType,
  filterFarmChartTreeByType,
  filterReadingsByChartScope,
  isFarmChartControllerScope,
  parseChartWidgetDragPayload,
  placeFarmChartWidget,
  scopesEqual,
  CHART_WIDGET_DND_TYPE,
  type ChartTrendZoomHint,
  type FarmChartControllerScope,
  type FarmChartScope,
  type FarmChartWidgetSlotId,
  type FarmChartWidgetSlots,
} from "@/lib/farm/farm-chart-scope";
import {
  coverageIndexesFromSnap,
  useFarmTrendUplinkCoverage,
} from "@/lib/farm/use-farm-trend-uplink-coverage";
import type { UplinkCoverageIndex } from "@/lib/farm/trend-uplink-coverage";
import { farmChartUi } from "@/lib/ui/farm-chart-ui-scale";
import { dashboardAffordance } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";
import { StallUnitNoMark, ControllerNoMark } from "@/components/farm/controller-summary-parts";

type Props = {
  readings: BarnReading[];
  farmKey?: FarmKey | null;
  controllerTrendByPeriod?: Record<
    TrendPeriodId,
    TrendControllerPeriodData
  > | null;
  /** 추이 fetch — 빈 화면을 로딩/실패와 구분 */
  trendLoading?: boolean;
  trendError?: boolean;
  trendExtending?: boolean;
  window15mLoading?: boolean;
  window15m?: TrendWindow15m | null;
  onNeedWindow15m?: (fromMs: number, toMs: number) => void;
  period: TrendPeriodId;
  onPeriodChange?: (period: TrendPeriodId) => void;
  /** URL 딥링크 집계 범위 (제어 컴포넌트) */
  scope: FarmChartScope;
  onScopeChange?: (scope: FarmChartScope) => void;
  /** P2 — URL chartYBand/chartX* → 온도 레인 등 초기 줌 */
  initialZoom?: ChartTrendZoomHint | null;
  /** E — 집중 칩 → URL chartYBand 동기화 */
  onZoomChange?: (zoom: ChartTrendZoomHint | null) => void;
  /** 컨트롤러 행 토글 — 명령 이력 전용 차트 */
  commandPaneOpen?: boolean;
  onCommandPaneChange?: (open: boolean) => void;
  /** 왼쪽 위·아래 위젯 칸 (컨트롤러 단건). 임베드는 미사용 */
  widgets?: FarmChartWidgetSlots;
  onWidgetsChange?: (slots: FarmChartWidgetSlots) => void;
  alarmSettings?: AlarmSettings;
  /** LIVE/명령 반영 제어값 */
  thermoSettings?: Record<string, ControllerThermoSettings>;
  /** 조회 전용이면 온·습 상하한 숫자 편집 비활성 */
  canCommand?: boolean;
  isMobileStack?: boolean;
  /** 차트 탭 활성 — TopBar 레이어 툴바 enter/exit */
  layersToolbarActive?: boolean;
  /** 모델 입구 — 해당 축사 유형만 집계 (농장 전체 숨김) */
  embedStallTyCode?: string;
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

function stallExpandKey(ty: string, stallNo: string) {
  return `${ty}::${stallNo}`;
}

function scopeExpandKeyOf(scope: FarmChartScope): string {
  if (scope.level === "farm") return "farm";
  if (scope.level === "sp") return `sp:${scope.stallTyCode}`;
  if (scope.level === "stall") {
    return `stall:${scope.stallTyCode}:${scope.stallNo}`;
  }
  return `ctrl:${scope.stallTyCode}:${scope.stallNo}:${scope.controllerKey}`;
}

function expandedSpFromScope(scope: FarmChartScope): Record<string, boolean> {
  if (scope.level === "farm") return {};
  return { [scope.stallTyCode]: true };
}

function expandedStallFromScope(
  scope: FarmChartScope,
): Record<string, boolean> {
  if (scope.level === "farm" || scope.level === "sp") return {};
  return { [stallExpandKey(scope.stallTyCode, scope.stallNo)]: true };
}

/**
 * 농장 보기 «차트» 탭 — 좌측 컨트롤러 위젯 두 칸 + 우측 집계 범위 트리.
 * 기본 집계: 선택 농장 전체. 유형 → 축사 → 컨트롤러 (URL chartSp/Stall/Ctrl).
 * 위젯 칸은 chartW1/chartW2. 트리에서 컨트롤러를 끌어다 넣으면 단건 추이.
 */
export function FarmChartView({
  readings,
  farmKey = null,
  controllerTrendByPeriod,
  trendLoading = false,
  trendError = false,
  trendExtending = false,
  window15mLoading = false,
  window15m = null,
  onNeedWindow15m,
  period,
  onPeriodChange,
  scope,
  onScopeChange,
  initialZoom = null,
  onZoomChange,
  commandPaneOpen = false,
  onCommandPaneChange,
  widgets,
  onWidgetsChange,
  alarmSettings,
  thermoSettings,
  canCommand = false,
  isMobileStack = false,
  layersToolbarActive = true,
  embedStallTyCode,
  className,
}: Props) {
  const lockedTy = embedStallTyCode
    ? normalizeStallTyCode(embedStallTyCode)
    : "";
  const embed = Boolean(lockedTy);
  const effectiveScope = lockedTy
    ? clampChartScopeToType(scope, lockedTy)
    : scope;

  const [expandedSp, setExpandedSp] = useState(() =>
    expandedSpFromScope(effectiveScope),
  );
  const [expandedStall, setExpandedStall] = useState(() =>
    expandedStallFromScope(effectiveScope),
  );
  const [expandScopeKey, setExpandScopeKey] = useState(() =>
    scopeExpandKeyOf(effectiveScope),
  );
  /** 모바일 — 집계 오버레이 */
  const [scopePanelOpen, setScopePanelOpen] = useState(false);
  /** PC — 우측 집계 레일 (필드 현황과 동일 접기 정책) */
  const [scopeRailOpen, setScopeRailOpen] = useState(true);
  const tree = useMemo(() => {
    const all = buildFarmChartTree(readings);
    return lockedTy ? filterFarmChartTreeByType(all, lockedTy) : all;
  }, [readings, lockedTy]);
  const scopedReadings = useMemo(
    () => filterReadingsByChartScope(readings, effectiveScope),
    [readings, effectiveScope],
  );

  const controllers = useMemo(
    () =>
      scopedReadings.map((r) => ({
        key: r.controllerKey,
        reading: r,
      })),
    [scopedReadings],
  );

  const uplinkCoverageSnap = useFarmTrendUplinkCoverage({
    farmKey,
    enabled: layersToolbarActive,
    h24: controllerTrendByPeriod?.["24h"],
    d30: controllerTrendByPeriod?.["30d"],
    window15m,
  });
  const uplinkCoverage = coverageIndexesFromSnap(uplinkCoverageSnap);

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

  const label = chartScopeLabel(effectiveScope, readings);
  const chartHeight = embed ? 280 : isMobileStack ? 320 : 420;

  /** 딥링크 범위 변경 시 트리 펼침. 첫 렌더는 초기 state와 키가 같아 setState 없음. */
  const nextExpandScopeKey = scopeExpandKeyOf(effectiveScope);
  if (nextExpandScopeKey !== expandScopeKey) {
    setExpandScopeKey(nextExpandScopeKey);
    if (effectiveScope.level !== "farm") {
      setExpandedSp((prev) => ({
        ...prev,
        [effectiveScope.stallTyCode]: true,
      }));
      if (effectiveScope.level !== "sp") {
        const sk = stallExpandKey(
          effectiveScope.stallTyCode,
          effectiveScope.stallNo,
        );
        setExpandedStall((prev) => ({ ...prev, [sk]: true }));
      }
    }
  }

  const selectScope = (next: FarmChartScope) => {
    const clamped = lockedTy ? clampChartScopeToType(next, lockedTy) : next;
    if (embed && clamped.level === "farm") return;
    onScopeChange?.(clamped);
    if (isMobileStack) setScopePanelOpen(false);
  };

  const toggleCommandPane = (ctrlScope: FarmChartScope) => {
    const same = scopesEqual(effectiveScope, ctrlScope);
    if (!same) {
      selectScope(ctrlScope);
      if (!commandPaneOpen) onCommandPaneChange?.(true);
      return;
    }
    onCommandPaneChange?.(!commandPaneOpen);
  };

  const widgetSlots: FarmChartWidgetSlots = widgets ?? { w1: null, w2: null };
  const useSharedBrush = isContextControllerTrend30d(
    controllerTrendByPeriod?.["30d"],
  );
  const [sharedBrushWindow, setSharedBrushWindow] = useState<BrushWindow>(
    () => BRUSH_PERIOD_WINDOW[period],
  );
  const [sharedBrushPeriod, setSharedBrushPeriod] = useState(period);
  if (period !== sharedBrushPeriod) {
    setSharedBrushPeriod(period);
    setSharedBrushWindow(BRUSH_PERIOD_WINDOW[period]);
  }
  const sharedBrushOverview = useMemo(
    () =>
      buildTrendBrushOverview(
        readings.map((r) => ({ reading: r })),
        controllerTrendByPeriod,
        alarmSettings,
      ),
    [readings, controllerTrendByPeriod, alarmSettings],
  );
  const [dragOverSlot, setDragOverSlot] = useState<FarmChartWidgetSlotId | null>(
    null,
  );

  const assignWidget = (
    target: FarmChartWidgetSlotId,
    ctrl: FarmChartControllerScope,
  ) => {
    onWidgetsChange?.(placeFarmChartWidget(widgetSlots, target, ctrl));
    selectScope(ctrl);
  };

  const clearWidget = (target: FarmChartWidgetSlotId) => {
    onWidgetsChange?.({ ...widgetSlots, [target]: null });
  };

  const onWidgetDragOver = (
    e: DragEvent,
    target: FarmChartWidgetSlotId,
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (dragOverSlot !== target) setDragOverSlot(target);
  };

  const onWidgetDrop = (e: DragEvent, target: FarmChartWidgetSlotId) => {
    e.preventDefault();
    setDragOverSlot(null);
    const raw =
      e.dataTransfer.getData(CHART_WIDGET_DND_TYPE) ||
      e.dataTransfer.getData("text/plain");
    const ctrl = parseChartWidgetDragPayload(raw);
    if (!ctrl) return;
    if (lockedTy && normalizeStallTyCode(ctrl.stallTyCode) !== lockedTy) {
      return;
    }
    assignWidget(target, ctrl);
  };

  const placedSlotOf = (
    scope: FarmChartScope,
  ): FarmChartWidgetSlotId | null => {
    if (!isFarmChartControllerScope(scope)) return null;
    if (widgetSlots.w1 && scopesEqual(widgetSlots.w1, scope)) return "w1";
    if (widgetSlots.w2 && scopesEqual(widgetSlots.w2, scope)) return "w2";
    return null;
  };

  const scopeTree = (
    <nav
      className="space-y-0.5"
      aria-label="집계 범위 트리"
    >
      {embed ? null : (
        <ScopeRow
          selected={scopesEqual(effectiveScope, { level: "farm" })}
          onSelect={() => selectScope({ level: "farm" })}
          depth={0}
          label="농장 전체"
          meta={`${readings.length}대`}
          tone={scopeTones.farm}
          touchFriendly={isMobileStack}
        />
      )}

      {tree.map((sp) => {
        const spOpen = expandedSp[sp.stallTyCode] ?? true;
        const spScope: FarmChartScope = {
          level: "sp",
          stallTyCode: sp.stallTyCode,
        };
        return (
          <div key={sp.stallTyCode} role="group" aria-label={sp.label}>
            <ScopeRow
              selected={scopesEqual(effectiveScope, spScope)}
              onSelect={() => selectScope(spScope)}
              depth={0}
              label={sp.label}
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
                        selected={scopesEqual(effectiveScope, stallScope)}
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
                                selected={scopesEqual(effectiveScope, ctrlScope)}
                                onSelect={() => selectScope(ctrlScope)}
                                depth={2}
                                label={
                                  <ControllerNoMark
                                    eqpmnNo={c.eqpmnNo}
                                    className="text-inherit"
                                  />
                                }
                                nameForA11y={`컨트롤러 ${c.label}`}
                                tone={
                                  scopeTones.byCtrl.get(c.controllerKey) ?? null
                                }
                                touchFriendly={isMobileStack}
                                dragPayload={ctrlScope}
                                placedSlot={placedSlotOf(ctrlScope)}
                                commandToggle={{
                                  pressed:
                                    commandPaneOpen &&
                                    scopesEqual(effectiveScope, ctrlScope),
                                  onToggle: () => toggleCommandPane(ctrlScope),
                                }}
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
      className={cn(
        "relative min-h-0",
        !embed && "flex h-full min-h-0 flex-1 flex-col",
        className,
      )}
      data-tour-id="farm-chart-view"
    >
      <div
        className={cn(
          "grid min-h-0 grid-cols-1 gap-3 lg:items-stretch",
          !embed && "min-h-0 flex-1 grid-rows-[minmax(0,1fr)]",
          "transition-[grid-template-columns] duration-motion-moderate ease-[var(--motion-ease-standard)]",
          embed
            ? scopeRailOpen
              ? "grid-cols-[minmax(0,1fr)_10.5rem]"
              : "grid-cols-[minmax(0,1fr)_2.5rem]"
            : !isMobileStack &&
              (scopeRailOpen
                ? "lg:grid-cols-[minmax(0,1fr)_16rem] xl:grid-cols-[minmax(0,1fr)_18rem]"
                : "lg:grid-cols-[minmax(0,1fr)_2.5rem]"),
          motionClass.farmChartScopeShell,
        )}
        data-farm-chart-scope={
          isMobileStack ? undefined : scopeRailOpen ? "open" : "collapsed"
        }
      >
        <div
          className={cn(
            "min-w-0 min-h-0",
            !embed && "flex h-full min-h-0 flex-1 flex-col",
            !embed && !isMobileStack && "overflow-hidden",
          )}
        >
          {embed ? (
          <UnifiedBarnTrendPanel
            label={label}
            controllers={controllers}
            controllerTrendByPeriod={controllerTrendByPeriod}
            trendLoading={trendLoading}
            trendError={trendError}
            trendExtending={trendExtending}
            window15mLoading={window15mLoading}
            window15m={window15m}
            onNeedWindow15m={onNeedWindow15m}
            uplinkCoverage={uplinkCoverage}
            period={period}
            onPeriodChange={onPeriodChange}
            alarmSettings={alarmSettings}
            thermoSettings={thermoSettings}
            chartScope={effectiveScope}
            onScopeChange={selectScope}
            initialZoom={initialZoom}
            onZoomChange={onZoomChange}
            commandPaneOpen={commandPaneOpen}
            canCommand={canCommand}
            isMobileStack={isMobileStack}
            chartHeight={chartHeight}
            plotFill={false}
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
          ) : (
            <div
              className={cn(
                "flex h-full min-h-0 flex-1 flex-col gap-2",
                !isMobileStack && "overflow-hidden",
              )}
              data-tour-id="farm-chart-widget-stack"
            >
              {useSharedBrush ? (
                <div
                  className={cn(
                    "flex shrink-0 items-stretch",
                    !isMobileStack && "px-px",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <UnifiedTrendPeriodBrush
                      window={sharedBrushWindow}
                      onWindowChange={setSharedBrushWindow}
                      overviewValues={sharedBrushOverview}
                      hoverPlacement="below"
                      labelGutter={Boolean(isMobileStack)}
                    />
                  </div>
                  {!isMobileStack ? (
                    <div className={farmChartUi.yGutter} aria-hidden />
                  ) : null}
                </div>
              ) : null}
              <div
                className={cn(
                  "flex min-h-0 flex-1 flex-col gap-2",
                  !isMobileStack && "overflow-hidden",
                )}
              >
              <ChartWidgetSlot
                slotId="w1"
                slotLabel="위칸"
                scope={widgetSlots.w1}
                readings={readings}
                dragOver={dragOverSlot === "w1"}
                onDragOver={(e) => onWidgetDragOver(e, "w1")}
                onDragLeave={() =>
                  setDragOverSlot((cur) => (cur === "w1" ? null : cur))
                }
                onDrop={(e) => onWidgetDrop(e, "w1")}
                onClear={() => clearWidget("w1")}
                onAssign={(ctrl) => assignWidget("w1", ctrl)}
                onEmptyActivate={() => {
                  if (isFarmChartControllerScope(effectiveScope)) {
                    assignWidget("w1", effectiveScope);
                  }
                }}
                selectedScope={effectiveScope}
                controllerTrendByPeriod={controllerTrendByPeriod}
                trendLoading={trendLoading}
                trendError={trendError}
                trendExtending={trendExtending}
                window15mLoading={window15mLoading}
                window15m={window15m}
                onNeedWindow15m={onNeedWindow15m}
                uplinkCoverage={uplinkCoverage}
                period={period}
                hidePeriodBrush
                brushWindow={sharedBrushWindow}
                onBrushWindowChange={setSharedBrushWindow}
                alarmSettings={alarmSettings}
                thermoSettings={thermoSettings}
                onScopeChange={selectScope}
                initialZoom={initialZoom}
                onZoomChange={onZoomChange}
                commandPaneOpen={commandPaneOpen}
                canCommand={canCommand}
                isMobileStack={isMobileStack}
                layersToolbarActive={layersToolbarActive}
                mobileScopeHandle={
                  isMobileStack
                    ? {
                        open: scopePanelOpen,
                        onOpen: () => setScopePanelOpen(true),
                      }
                    : null
                }
              />
              <ChartWidgetSlot
                slotId="w2"
                slotLabel="아래칸"
                scope={widgetSlots.w2}
                readings={readings}
                dragOver={dragOverSlot === "w2"}
                onDragOver={(e) => onWidgetDragOver(e, "w2")}
                onDragLeave={() =>
                  setDragOverSlot((cur) => (cur === "w2" ? null : cur))
                }
                onDrop={(e) => onWidgetDrop(e, "w2")}
                onClear={() => clearWidget("w2")}
                onAssign={(ctrl) => assignWidget("w2", ctrl)}
                onEmptyActivate={() => {
                  if (isFarmChartControllerScope(effectiveScope)) {
                    assignWidget("w2", effectiveScope);
                  }
                }}
                selectedScope={effectiveScope}
                controllerTrendByPeriod={controllerTrendByPeriod}
                trendLoading={trendLoading}
                trendError={trendError}
                trendExtending={trendExtending}
                window15mLoading={window15mLoading}
                window15m={window15m}
                onNeedWindow15m={onNeedWindow15m}
                uplinkCoverage={uplinkCoverage}
                period={period}
                hidePeriodBrush
                brushWindow={sharedBrushWindow}
                onBrushWindowChange={setSharedBrushWindow}
                alarmSettings={alarmSettings}
                thermoSettings={thermoSettings}
                onScopeChange={selectScope}
                initialZoom={initialZoom}
                onZoomChange={onZoomChange}
                commandPaneOpen={commandPaneOpen}
                canCommand={canCommand}
                isMobileStack={isMobileStack}
                layersToolbarActive={layersToolbarActive}
                mobileScopeHandle={null}
              />
              </div>
            </div>
          )}
        </div>

        {!isMobileStack ? (
          <div className="h-full min-h-0 min-w-0 overflow-hidden">
            <div
              className={cn(
                "ml-auto transition-[width,max-width] duration-motion-moderate ease-[var(--motion-ease-standard)]",
                scopeRailOpen
                  ? embed
                    ? "w-full max-w-[10.5rem]"
                    : "w-full max-w-[16rem] xl:max-w-[18rem]"
                  : "w-10 max-w-10",
              )}
            >
              <aside
                className={cn(
                  "flex h-full min-h-0 w-full flex-col rounded-xl border bg-card",
                  embed ? "max-h-full" : "lg:max-h-none",
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
                    <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "min-w-0 truncate font-semibold",
                        farmChartUi.fsLegend,
                      )}
                    >
                      집계 범위
                    </p>
                    {!embed ? (
                      <p
                        className={cn(
                          "truncate text-muted-foreground",
                          farmChartUi.fsLegend,
                        )}
                      >
                        컨트롤러를 왼쪽 칸으로 끌어다 놓으세요
                      </p>
                    ) : null}
                    </div>
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
                      ? "min-h-0 flex-1 opacity-100 lg:overflow-y-auto"
                      : "pointer-events-none max-h-0 overflow-hidden opacity-0",
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

function ChartWidgetSlot({
  slotId,
  slotLabel,
  scope,
  readings,
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onClear,
  onAssign,
  onEmptyActivate,
  selectedScope,
  controllerTrendByPeriod,
  trendLoading,
  trendError,
  trendExtending,
  window15mLoading,
  window15m,
  onNeedWindow15m,
  uplinkCoverage,
  period,
  hidePeriodBrush = false,
  brushWindow,
  onBrushWindowChange,
  alarmSettings,
  thermoSettings,
  onScopeChange,
  initialZoom,
  onZoomChange,
  commandPaneOpen,
  canCommand,
  isMobileStack,
  layersToolbarActive,
  mobileScopeHandle,
}: {
  slotId: FarmChartWidgetSlotId;
  slotLabel: string;
  scope: FarmChartControllerScope | null;
  readings: BarnReading[];
  dragOver: boolean;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent) => void;
  onClear: () => void;
  onAssign: (ctrl: FarmChartControllerScope) => void;
  onEmptyActivate: () => void;
  selectedScope: FarmChartScope;
  controllerTrendByPeriod?: Record<
    TrendPeriodId,
    TrendControllerPeriodData
  > | null;
  trendLoading?: boolean;
  trendError?: boolean;
  trendExtending?: boolean;
  window15mLoading?: boolean;
  window15m?: TrendWindow15m | null;
  onNeedWindow15m?: (fromMs: number, toMs: number) => void;
  uplinkCoverage: UplinkCoverageIndex[];
  period: TrendPeriodId;
  hidePeriodBrush?: boolean;
  brushWindow?: BrushWindow;
  onBrushWindowChange?: (window: BrushWindow) => void;
  alarmSettings?: AlarmSettings;
  thermoSettings?: Record<string, ControllerThermoSettings>;
  onScopeChange?: (scope: FarmChartScope) => void;
  initialZoom?: ChartTrendZoomHint | null;
  onZoomChange?: (zoom: ChartTrendZoomHint | null) => void;
  commandPaneOpen?: boolean;
  canCommand?: boolean;
  isMobileStack?: boolean;
  layersToolbarActive?: boolean;
  mobileScopeHandle?: {
    open: boolean;
    onOpen: () => void;
  } | null;
}) {
  const scopedReadings = useMemo(
    () => (scope ? filterReadingsByChartScope(readings, scope) : []),
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
  const label = scope ? chartScopeLabel(scope, readings) : slotLabel;
  const selectedCtrlHint = isFarmChartControllerScope(selectedScope)
    ? chartScopeLabel(selectedScope, readings)
    : null;
  const overlayOpen = Boolean(
    commandPaneOpen && scope && scopesEqual(selectedScope, scope),
  );

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card",
        !isMobileStack && "basis-0",
        farmChartUi.root,
        motionClass.farmChartPanelShell,
        dragOver && "border-channel-info/50 bg-channel-info/10",
      )}
      data-farm-chart-widget={slotId}
      onDragOver={onDragOver}
      onDragLeave={(e) => {
        const next = e.relatedTarget as Node | null;
        if (next && e.currentTarget.contains(next)) return;
        onDragLeave();
      }}
      onDrop={onDrop}
    >
      {scope ? (
        <UnifiedBarnTrendPanel
          label={label}
          controllers={controllers}
          controllerTrendByPeriod={controllerTrendByPeriod}
          trendLoading={trendLoading}
          trendError={trendError}
          trendExtending={trendExtending}
          window15mLoading={window15mLoading}
          window15m={window15m}
          onNeedWindow15m={onNeedWindow15m}
          uplinkCoverage={uplinkCoverage}
          period={period}
          alarmSettings={alarmSettings}
          thermoSettings={thermoSettings}
          chartScope={scope}
          onScopeChange={(next) => {
            if (isFarmChartControllerScope(next)) onAssign(next);
            else onScopeChange?.(next);
          }}
          initialZoom={initialZoom}
          onZoomChange={onZoomChange}
          commandPaneOpen={overlayOpen}
          canCommand={canCommand}
          isMobileStack={isMobileStack}
          plotFill
          headingMode="widget"
          hidePeriodBrush={hidePeriodBrush}
          brushWindow={brushWindow}
          onBrushWindowChange={onBrushWindowChange}
          layersToolbarActive={layersToolbarActive}
          mobileScopeHandle={mobileScopeHandle}
          headerActions={
            <button
              type="button"
              onClick={onClear}
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground",
                "hover:bg-muted/50 hover:text-foreground",
                motionClass.microHover,
              )}
              aria-label={`${slotLabel}에서 빼기`}
              title={`${slotLabel}에서 빼기`}
            >
              <X className="size-4" aria-hidden />
            </button>
          }
          className="mt-0 h-full min-h-0 flex-1"
        />
      ) : (
        <button
          type="button"
          onClick={onEmptyActivate}
          className={cn(
            "flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center gap-1 px-4 text-center",
            farmChartUi.fsLegend,
            "text-muted-foreground",
            motionClass.microHover,
          )}
          aria-label={`${slotLabel}. 컨트롤러를 끌어다 놓으세요`}
        >
          <span className="font-medium text-foreground">{slotLabel}</span>
          <span>
            집계 범위에서 컨트롤러를 이 칸으로 끌어다 놓으면 그 컨트롤러의
            추이만 봅니다.
          </span>
          {selectedCtrlHint ? (
            <span>선택한 {selectedCtrlHint}를 넣으려면 이 칸을 누르세요.</span>
          ) : null}
        </button>
      )}
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
  commandToggle,
  dragPayload,
  placedSlot,
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
  commandToggle?: {
    pressed: boolean;
    onToggle: () => void;
  };
  dragPayload?: FarmChartControllerScope;
  placedSlot?: FarmChartWidgetSlotId | null;
}) {
  const toneLabel =
    tone === "guide"
      ? "임계 이탈"
      : tone === "offline"
        ? "통신 두절"
        : undefined;
  const labelText =
    nameForA11y ?? (typeof label === "string" ? label : undefined);

  const startWidgetDrag = (e: DragEvent) => {
    if (!dragPayload) return;
    const json = JSON.stringify(dragPayload);
    e.dataTransfer.setData(CHART_WIDGET_DND_TYPE, json);
    e.dataTransfer.setData("text/plain", json);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      className={cn(
        "flex items-center gap-0.5",
        dragPayload && "cursor-grab",
      )}
      style={{ paddingLeft: `${depth * 0.75}rem` }}
      draggable={Boolean(dragPayload)}
      onDragStart={startWidgetDrag}
    >
      {expandable ? (
        <button
          type="button"
          aria-label={expanded ? "접기" : "펼치기"}
          className={cn(
            "flex shrink-0 items-center justify-center rounded",
            farmChartUi.fsLegend,
            touchFriendly ? "h-10 w-10" : "h-6 w-6",
            motionClass.microHover,
            dashboardAffordance.chipToggleIdle,
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
        draggable={Boolean(dragPayload)}
        onDragStart={startWidgetDrag}
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
          "flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md border px-2 text-left",
          farmChartUi.fsLegend,
          touchFriendly ? "min-h-11 py-2.5" : "py-1",
          motionClass.microHover,
          dashboardAffordance.hitSurface,
          selected
            ? "border-channel-info/30 bg-channel-info/10 font-medium dark:bg-channel-info/15"
            : "border-transparent hover:border-border hover:bg-muted",
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
          <span
            className={cn(
              typeof label === "string" ? "truncate" : "shrink-0",
            )}
          >
            {label}
          </span>
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
      {placedSlot ? (
        <span
          className={cn(
            "shrink-0 text-muted-foreground",
            farmChartUi.fsLegend,
          )}
        >
          {placedSlot === "w1" ? "위칸" : "아래칸"}
        </span>
      ) : null}
      {commandToggle ? (
        <button
          type="button"
          data-tour-id="farm-chart-command-toggle"
          aria-pressed={commandToggle.pressed}
          aria-label={
            commandToggle.pressed ? "명령 이력 숨기기" : "명령 이력 보기"
          }
          title={commandToggle.pressed ? "명령 이력 숨기기" : "명령 이력 보기"}
          onClick={(e) => {
            e.stopPropagation();
            commandToggle.onToggle();
          }}
          className={cn(
            "shrink-0 rounded-md border px-1.5 font-medium",
            farmChartUi.fsLegend,
            touchFriendly ? "min-h-11 py-2.5" : "py-1",
            motionClass.microHover,
            commandToggle.pressed
              ? "border-channel-info/30 bg-channel-info/10 text-channel-info dark:bg-channel-info/15"
              : cn(dashboardAffordance.chipToggleIdle, "text-muted-foreground"),
          )}
        >
          명령
        </button>
      ) : null}
    </div>
  );
}
