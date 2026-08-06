"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { Warehouse, Map, List, LineChart, Bot } from "lucide-react";
import type { BarnMapSnapshot } from "@/lib/data/iot";
import type { BarnReading } from "@/lib/data/iot";
import type { TrendPeriodData, TrendPeriodId } from "@/lib/data/farm-trend-types";
import { FarmMapView } from "@/components/farm/farm-map-view";
import { FarmChartView } from "@/components/farm/farm-chart-view";
import { FarmAriaView } from "@/components/farm/farm-aria-view";
import { BarnTable } from "@/components/farm/barn-table";
import {
  FarmFieldStatusGrid,
  firstControllerKeyForBarn,
  readingsMatchingBarn,
} from "@/components/farm/farm-field-status-grid";
import { FarmFeatureTour } from "@/components/onboarding/feature-tour";
import {
  currentFarmSearchParams,
  pinFarmHubViewParam,
  replaceFarmUrlShallow,
  resolveListLayoutParam,
  resolveListViewMode,
  resolveTrendPeriodParam,
  setTrendPeriodParam,
  type FarmHubView,
} from "@/lib/farm/farm-view-url";
import {
  applyFarmChartScopeParams,
  applyFarmChartZoomParams,
  clearFarmChartZoomParams,
  resolveFarmChartScope,
  resolveFarmChartZoomHint,
  type ChartTrendZoomHint,
  type FarmChartScope,
} from "@/lib/farm/farm-chart-scope";
import { isFarmHubPanelLiveActive } from "@/lib/farm/farm-hub-keepalive";
import { useFarmHubViewShell } from "@/lib/farm/use-farm-hub-view-shell";
import { farmFieldMergeEnabled } from "@/lib/farm/farm-field-merge-enabled";
import { isScopedControllerEnriched } from "@/lib/farm/farm-scoped-panel-utils";
import type { ControllerGridData } from "@/lib/farm/controller-grid-data";
import { farmKeyId, parseFarmKeyFromQuery, parseFarmKeyId, type FarmKey } from "@/lib/data/farm-key";
import {
  invalidateFarmControllerTrendCache,
  prefetchFarmControllerTrend,
  useFarmControllerTrend,
} from "@/lib/farm/use-farm-controller-trend";
import {
  invalidateFarmStallTrendCache,
  prefetchFarmStallTrend,
} from "@/lib/farm/use-farm-stall-trend";
import { fetchFarmPanelEnrichShared } from "@/lib/farm/fetch-farm-panel-enrich";
import {
  readFarmPanelCache,
  useFarmLiveRefreshOptional,
} from "@/lib/navigation/farm-live-refresh";
import { useHydrationSafeDashboardCompact } from "@/components/layout/dashboard-viewport-context";
import { dashboardChroma, dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import { useFieldListFilterMotion } from "@/components/farm/use-field-list-filter-motion";
import { motionClass } from "@/lib/ui/motion-classes";
import { useFarmTourActive } from "@/lib/onboarding/use-farm-tour-active";
import { DELIN_NAME } from "@/lib/aria/aria-mode";
import { delinEnabled } from "@/lib/aria/delin-enabled";
import { STAGGER_MOUNT_MIN_READINGS } from "@/lib/farm/stagger-mount";

type Props = {
  readings: BarnReading[];
  barnSnapshots: BarnMapSnapshot[];
  gridCols: number;
  gridRows: number;
  trendByPeriod?: Record<TrendPeriodId, TrendPeriodData> | null;
  controller?: ControllerGridData | null;
  hubMode?: boolean;
  hideViewTabs?: boolean;
  hubUrlEpoch?: number;
  onHubUrlChange?: () => void;
  gridCompactShell?: boolean;
  liveRefreshManaged?: boolean;
  /** hub 캐시 단일 농장 — 목록 탭 첫 진입 시 scoped panel 보강 */
  lazyListEnrichment?: boolean;
  /** SSR과 일치하는 초기 그리드/목록/차트/ARIA 탭 (hubMode) */
  initialHubView?: FarmHubView;
  lazyListFarmKey?: FarmKey | null;
};

export function FarmPageContent({
  readings,
  barnSnapshots,
  gridCols,
  gridRows,
  trendByPeriod,
  controller,
  hubMode = false,
  hideViewTabs = false,
  hubUrlEpoch = 0,
  onHubUrlChange,
  gridCompactShell = false,
  liveRefreshManaged = false,
  lazyListEnrichment = false,
  lazyListFarmKey = null,
  initialHubView,
}: Props) {
  const viewportCompact = useHydrationSafeDashboardCompact();
  const tourActive = useFarmTourActive();
  const searchParams = useSearchParams();
  const liveRefresh = useFarmLiveRefreshOptional();
  const liveRefreshRef = useRef(liveRefresh);
  useEffect(() => {
    liveRefreshRef.current = liveRefresh;
  });
  const enrichFarmRef = useRef<string | null>(null);
  const enrichGenRef = useRef(0);
  const tourActiveRef = useRef(tourActive);
  useEffect(() => {
    tourActiveRef.current = tourActive;
  });

  const tablistRef = useRef<HTMLDivElement>(null);
  const [tabPill, setTabPill] = useState({ left: 0, width: 0 });
  /** TopBar 보기 토글 슬롯 — undefined=미확인, null=없음, Element=portal */
  const [scopeToggleSlot, setScopeToggleSlot] = useState<
    Element | null | undefined
  >(undefined);

  useEffect(() => {
    if (hideViewTabs || !hubMode) {
      queueMicrotask(() => setScopeToggleSlot(null));
      return;
    }
    const attr = viewportCompact ? "mobile" : "desktop";
    queueMicrotask(() => {
      setScopeToggleSlot(
        document.querySelector(`[data-farm-view-toggle-slot="${attr}"]`),
      );
    });
  }, [hideViewTabs, hubMode, viewportCompact]);

  const gridFarmKey = useMemo<FarmKey | null>(() => {
    const first = readings[0]?.farmKey ?? null;
    if (!first) return null;
    const firstId = farmKeyId(first);
    const allSame = readings.every(
      (r) => r.farmKey && farmKeyId(r.farmKey) === firstId,
    );
    return allSame ? first : null;
  }, [readings]);

  const keepAliveFarmId = gridFarmKey ? farmKeyId(gridFarmKey) : "";
  const prevTrendFarmIdRef = useRef(keepAliveFarmId);

  useEffect(() => {
    const prev = prevTrendFarmIdRef.current;
    if (prev && prev !== keepAliveFarmId) {
      const left = parseFarmKeyId(prev);
      if (left) {
        invalidateFarmStallTrendCache(left);
        invalidateFarmControllerTrendCache(left);
      }
    }
    prevTrendFarmIdRef.current = keepAliveFarmId;
  }, [keepAliveFarmId]);

  const enrichListIfNeeded = useCallback(async () => {
    if (!lazyListEnrichment || !lazyListFarmKey) return;
    if (tourActiveRef.current) return;

    const lr = liveRefreshRef.current;
    if (!lr) return;

    const sliceController = lr.slice.controller;
    if (isScopedControllerEnriched(sliceController)) return;

    const farmId = farmKeyId(lazyListFarmKey);
    const cached = readFarmPanelCache(farmId);
    if (cached && isScopedControllerEnriched(cached.controller)) {
      lr.hydrateScopedPanel(cached);
      return;
    }

    const gen = ++enrichGenRef.current;
    try {
      const data = await fetchFarmPanelEnrichShared(lazyListFarmKey);
      if (gen !== enrichGenRef.current) return;
      if (farmKeyId(data.farmKey) !== farmId) return;
      liveRefreshRef.current?.hydrateScopedPanel(data);
    } catch {
      // 목록은 grid readings로 제한 표시 — enrich 실패해도 기존 카드 유지
    }
  }, [lazyListEnrichment, lazyListFarmKey]);

  const {
    view,
    viewSlide,
    urlHydrated,
    urlTick,
    setUrlTick,
    listEverOpened,
    chartEverOpened,
    ariaEverOpened,
    setView,
  } = useFarmHubViewShell({
    hubMode,
    hubUrlEpoch,
    onHubUrlChange,
    initialHubView,
    searchParams,
    keepAliveFarmId,
    onOpenList: () => {
      void enrichListIfNeeded();
    },
  });

  const fieldMerge = farmFieldMergeEnabled();
  const fieldActive = view === "map" || view === "list";
  const openChartFromField = useCallback(() => {
    setView("chart");
  }, [setView]);
  const [fieldFocusCtrl, setFieldFocusCtrl] = useState<string | null>(null);
  const [fieldSelectedBarnId, setFieldSelectedBarnId] = useState<string | null>(
    null,
  );
  /** PC 스플릿 — 좌측 현황 열 표시 */
  const [fieldStatusOpen, setFieldStatusOpen] = useState(true);

  const selectBarnForList = useCallback(
    (barn: BarnMapSnapshot) => {
      setFieldSelectedBarnId((prev) => {
        if (prev === barn.meta.id) {
          setFieldFocusCtrl(null);
          return null;
        }
        const key = firstControllerKeyForBarn(barn, readings);
        setFieldFocusCtrl(null);
        if (key) {
          requestAnimationFrame(() => {
            setFieldFocusCtrl(key);
          });
        }
        return barn.meta.id;
      });
    },
    [readings],
  );

  const clearFieldBarnFilter = useCallback(() => {
    setFieldSelectedBarnId(null);
    setFieldFocusCtrl(null);
  }, []);

  const fieldListReadings = useMemo(() => {
    if (!fieldMerge || !fieldSelectedBarnId) return readings;
    const barn = barnSnapshots.find((b) => b.meta.id === fieldSelectedBarnId);
    if (!barn) return readings;
    return readingsMatchingBarn(barn, readings);
  }, [fieldMerge, fieldSelectedBarnId, barnSnapshots, readings]);

  const fieldFilterKey = fieldSelectedBarnId ?? "all";
  const {
    displayRows: fieldMotionRows,
    phase: fieldFilterPhase,
    enterEpoch: fieldFilterEnterEpoch,
  } = useFieldListFilterMotion(fieldFilterKey, fieldListReadings);

  useEffect(() => {
    if (!fieldMerge || !fieldActive) return;
    void enrichListIfNeeded();
  }, [fieldMerge, fieldActive, enrichListIfNeeded]);

  useEffect(() => {
    enrichGenRef.current += 1;
  }, [lazyListFarmKey]);

  useEffect(() => {
    enrichFarmRef.current = null;
  }, [lazyListFarmKey]);

  /** LIVE 안정 후 idle — 활성 탭에 맞는 stall·controller 추이·list enrich만 */
  useEffect(() => {
    if (!gridFarmKey || tourActive) return;
    let cancelled = false;
    let idleId = 0;
    const run = () => {
      if (cancelled) return;
      if (
        view === "map" ||
        view === "chart" ||
        view === "list" ||
        view === "aria"
      ) {
        void prefetchFarmControllerTrend(gridFarmKey);
        void prefetchFarmStallTrend(gridFarmKey).then((trend) => {
          if (cancelled) return;
          liveRefreshRef.current?.hydrateStallTrend(gridFarmKey, trend);
        });
      }
      if (view === "list" || (fieldMerge && view === "map")) {
        void enrichListIfNeeded();
      }
    };
    const ric =
      typeof window !== "undefined" && "requestIdleCallback" in window
        ? window.requestIdleCallback.bind(window)
        : null;
    if (ric) {
      idleId = ric(run, { timeout: 2500 });
    } else {
      idleId = window.setTimeout(run, 600);
    }
    return () => {
      cancelled = true;
      if (ric && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      } else {
        window.clearTimeout(idleId);
      }
    };
  }, [gridFarmKey, tourActive, enrichListIfNeeded, view, fieldMerge]);

  useEffect(() => {
    if (!lazyListEnrichment || !lazyListFarmKey) return;
    if (tourActive) return;
    if (view !== "list") return;

    const farmId = farmKeyId(lazyListFarmKey);
    if (enrichFarmRef.current === farmId) return;
    if (isScopedControllerEnriched(liveRefresh?.slice.controller)) {
      enrichFarmRef.current = farmId;
      return;
    }

    enrichFarmRef.current = farmId;
    void enrichListIfNeeded();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 의도적 생략
  }, [
    lazyListEnrichment,
    lazyListFarmKey,
    tourActive,
    view,
    liveRefresh?.slice.controller?.alarmSettings,
    liveRefresh?.slice.controller?.thermoSettings,
    enrichListIfNeeded,
  ]);

  const wasTourActiveRef = useRef(false);
  useEffect(() => {
    const wasActive = wasTourActiveRef.current;
    wasTourActiveRef.current = tourActive;
    if (tourActive || !wasActive) return;
    if (!listEverOpened && view !== "list") return;
    if (!lazyListEnrichment || !lazyListFarmKey) return;
    if (isScopedControllerEnriched(liveRefresh?.slice.controller)) return;
    enrichFarmRef.current = null;
    queueMicrotask(() => {
      void enrichListIfNeeded();
    });
  }, [
    tourActive,
    listEverOpened,
    view,
    lazyListEnrichment,
    lazyListFarmKey,
    liveRefresh?.slice.controller,
    enrichListIfNeeded,
  ]);

  const ariaFarm = useMemo<FarmKey | null>(() => {
    void urlTick;
    void hubUrlEpoch;
    const params = urlHydrated
      ? currentFarmSearchParams()
      : new URLSearchParams(searchParams.toString());
    return (
      parseFarmKeyFromQuery(params.get("lsind"), params.get("item")) ??
      gridFarmKey
    );
  }, [urlHydrated, hubUrlEpoch, urlTick, searchParams, gridFarmKey]);

  const { data: gridControllerTrend, loading: gridTrendLoading, isStale: gridTrendStale } =
    useFarmControllerTrend({
      farmKey: gridFarmKey,
      enabled:
        Boolean(gridFarmKey) &&
        (view === "map" ||
          view === "chart" ||
          view === "list" ||
          view === "aria"),
    });

  const shallowParams = useMemo(() => {
    void urlTick;
    void hubUrlEpoch;
    if (!urlHydrated) {
      return new URLSearchParams(searchParams.toString());
    }
    return currentFarmSearchParams();
  }, [urlHydrated, hubUrlEpoch, urlTick, searchParams]);

  const urlCtrl = shallowParams.get("ctrl");
  const listSp =
    fieldMerge || view === "list"
      ? shallowParams.get("sp") ?? undefined
      : undefined;
  const listMode = useMemo(() => {
    return resolveListViewMode(shallowParams, "controller");
  }, [shallowParams]);
  const listLayout = resolveListLayoutParam(shallowParams);
  const trendPeriod = useMemo(
    () => resolveTrendPeriodParam(shallowParams),
    [shallowParams],
  );
  const chartScope = useMemo(
    () => resolveFarmChartScope(shallowParams),
    [shallowParams],
  );
  const chartZoomHint = useMemo(
    () => resolveFarmChartZoomHint(shallowParams),
    [shallowParams],
  );

  const onTrendPeriodChange = useCallback(
    (period: TrendPeriodId) => {
      const params = new URLSearchParams(currentFarmSearchParams().toString());
      setTrendPeriodParam(params, period);
      clearFarmChartZoomParams(params);
      pinFarmHubViewParam(params, view);
      replaceFarmUrlShallow(params);
      setUrlTick((n) => n + 1);
    },
    [view, setUrlTick],
  );

  const onChartScopeChange = useCallback(
    (scope: FarmChartScope) => {
      const params = new URLSearchParams(currentFarmSearchParams().toString());
      applyFarmChartScopeParams(params, scope);
      clearFarmChartZoomParams(params);
      pinFarmHubViewParam(params, "chart");
      replaceFarmUrlShallow(params);
      setUrlTick((n) => n + 1);
    },
    [setUrlTick],
  );

  const onChartZoomChange = useCallback(
    (zoom: ChartTrendZoomHint | null) => {
      const params = new URLSearchParams(currentFarmSearchParams().toString());
      applyFarmChartZoomParams(params, zoom);
      pinFarmHubViewParam(params, "chart");
      replaceFarmUrlShallow(params);
      setUrlTick((n) => n + 1);
    },
    [setUrlTick],
  );

  const thermoSettings = controller?.thermoSettings ?? {};
  const alarmSettings = controller?.alarmSettings;

  useLayoutEffect(() => {
    const root = tablistRef.current;
    if (!root) return;
    const selected = root.querySelector<HTMLElement>(
      '[role="tab"][aria-selected="true"]',
    );
    if (!selected) return;
    const next = { left: selected.offsetLeft, width: selected.offsetWidth };
    setTabPill((prev) =>
      prev.left === next.left && prev.width === next.width ? prev : next,
    );
  }, [view, hideViewTabs, gridCompactShell, viewportCompact, scopeToggleSlot]);

  const tabNavClass =
    gridCompactShell || viewportCompact || Boolean(scopeToggleSlot)
      ? "text-sm font-medium md:text-sm"
      : dashboardUi.tabNav;

  const panelMotionClass = (panel: FarmHubView) => {
    const active = view === panel;
    const exiting = viewSlide?.from === panel;
    const entering = viewSlide?.to === panel;
    if (!active && !exiting) return "hidden";
    return cn(
      exiting && "pointer-events-none absolute inset-x-0 top-0 z-0 w-full",
      active && "relative z-[1] w-full",
      exiting &&
        (viewSlide!.dir === 1
          ? motionClass.viewSlideExitNext
          : motionClass.viewSlideExitPrev),
      entering &&
        (viewSlide!.dir === 1
          ? motionClass.viewSlideEnterNext
          : motionClass.viewSlideEnterPrev),
    );
  };

  /** 현장 통합 — map|list 를 하나의 스플릿 패널로 */
  const fieldPanelMotionClass = () => {
    const active = fieldActive;
    const fromField =
      viewSlide != null &&
      (viewSlide.from === "map" || viewSlide.from === "list");
    const toField =
      viewSlide != null &&
      (viewSlide.to === "map" || viewSlide.to === "list");
    const exiting = Boolean(fromField && !active);
    const entering = Boolean(toField && active);
    if (!active && !exiting) return "hidden";
    return cn(
      exiting && "pointer-events-none absolute inset-x-0 top-0 z-0 w-full",
      active && "relative z-[1] w-full",
      exiting &&
        viewSlide &&
        (viewSlide.dir === 1
          ? motionClass.viewSlideExitNext
          : motionClass.viewSlideExitPrev),
      entering &&
        viewSlide &&
        (viewSlide.dir === 1
          ? motionClass.viewSlideEnterNext
          : motionClass.viewSlideEnterPrev),
    );
  };

  const embedInScopeHeader = Boolean(scopeToggleSlot);
  const awaitingScopeSlot =
    hubMode && !hideViewTabs && scopeToggleSlot === undefined;

  const viewTabBtn = (active: boolean) =>
    cn(
      "relative z-[1] inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium",
      embedInScopeHeader && viewportCompact
        ? "min-w-0 flex-1 px-2 py-2.5"
        : embedInScopeHeader
          ? "shrink-0 px-2.5 py-1.5 sm:px-3"
          : "shrink-0 gap-2 px-5 py-2.5",
      motionClass.microInteractive,
      tabNavClass,
      active
        ? dashboardChroma.chromeActiveText
        : dashboardChroma.chromeIdleText,
    );

  const viewToggle = !hideViewTabs ? (
    <div
      ref={tablistRef}
      className={cn(
        "relative inline-flex max-w-full flex-nowrap rounded-xl border bg-muted/40 p-1",
        embedInScopeHeader && viewportCompact
          ? "w-full text-sm"
          : embedInScopeHeader
            ? "w-auto shrink-0 text-sm"
            : gridCompactShell || viewportCompact
              ? "text-sm md:text-sm"
              : dashboardUi.body,
      )}
      role="tablist"
      aria-label="농장 보기"
      data-tour-id="view-toggle"
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1 bottom-1 z-0 rounded-lg",
          dashboardChroma.viewTabPill,
          motionClass.viewTabPill,
          tabPill.width <= 0 && "opacity-0",
        )}
        style={{
          left: tabPill.left,
          width: tabPill.width,
        }}
      />
      {fieldMerge ? (
        <button
          type="button"
          role="tab"
          aria-selected={fieldActive}
          className={viewTabBtn(fieldActive)}
          onClick={() => setView("map")}
        >
          <Warehouse className={dashboardUi.iconSm} aria-hidden />
          현장
        </button>
      ) : (
        <>
          <button
            type="button"
            role="tab"
            aria-selected={view === "map"}
            className={viewTabBtn(view === "map")}
            onClick={() => setView("map")}
          >
            <Map className={dashboardUi.iconSm} aria-hidden />
            그리드
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "list"}
            className={viewTabBtn(view === "list")}
            onClick={() => setView("list")}
          >
            <List className={dashboardUi.iconSm} aria-hidden />
            목록
          </button>
        </>
      )}
      <button
        type="button"
        role="tab"
        aria-selected={view === "chart"}
        className={viewTabBtn(view === "chart")}
        onClick={() => setView("chart")}
      >
        <LineChart className={dashboardUi.iconSm} aria-hidden />
        차트
      </button>
      {delinEnabled() ? (
        <button
          type="button"
          role="tab"
          aria-selected={view === "aria"}
          className={viewTabBtn(view === "aria")}
          onClick={() => setView("aria")}
        >
          <Bot className={dashboardUi.iconSm} aria-hidden />
          {DELIN_NAME}
        </button>
      ) : null}
    </div>
  ) : null;

  const listFocusKey = fieldMerge
    ? fieldFocusCtrl ?? urlCtrl
    : view === "list"
      ? urlCtrl
      : null;

  return (
    <div className={cn(embedInScopeHeader ? "space-y-3" : "space-y-4")}>
      <FarmFeatureTour
        view={view}
        setView={setView}
        enabled={!hideViewTabs}
      />
      {viewToggle && scopeToggleSlot
        ? createPortal(viewToggle, scopeToggleSlot)
        : awaitingScopeSlot
          ? null
          : viewToggle}

      <div className="relative min-h-0 overflow-hidden" data-farm-view-slot>
        {fieldMerge ? (
          <div
            className={cn("min-h-0 lg:min-h-[16rem]", fieldPanelMotionClass())}
            aria-hidden={!fieldActive}
            data-farm-view-panel="field"
            data-farm-view-active={fieldActive}
          >
            {viewportCompact ? (
              <FarmMapView
                barns={barnSnapshots}
                readings={readings}
                gridCols={gridCols}
                gridRows={gridRows}
                trendByPeriod={trendByPeriod}
                controllerTrendByPeriod={gridControllerTrend}
                controller={controller}
                hubMode={hubMode}
                compactShell={gridCompactShell}
                trendPeriod={trendPeriod}
                onTrendPeriodChange={onTrendPeriodChange}
                trendLoading={gridTrendLoading}
                trendStale={gridTrendStale}
                fieldMerge
                onOpenChart={openChartFromField}
              />
            ) : (
              <div
                className={cn(
                  "grid min-h-[28rem] grid-cols-1 gap-3 lg:items-start",
                  "transition-[grid-template-columns] duration-motion-moderate ease-[var(--motion-ease-standard)]",
                  fieldStatusOpen
                    ? "lg:grid-cols-[15rem_minmax(0,1fr)]"
                    : "lg:grid-cols-[2.5rem_minmax(0,1fr)]",
                )}
                data-tour-id="field-split"
                data-field-status={fieldStatusOpen ? "open" : "collapsed"}
              >
                <div className="min-w-0 overflow-hidden">
                  <div
                    className={cn(
                      "transition-[width,max-width] duration-motion-moderate ease-[var(--motion-ease-standard)]",
                      fieldStatusOpen
                        ? "w-[15rem] max-w-[15rem]"
                        : "w-10 max-w-10",
                    )}
                  >
                    <FarmFieldStatusGrid
                      barns={barnSnapshots}
                      readings={readings}
                      selectedBarnId={fieldSelectedBarnId}
                      onSelectBarn={selectBarnForList}
                      onShowAll={clearFieldBarnFilter}
                      collapsed={!fieldStatusOpen}
                      onHide={() => setFieldStatusOpen(false)}
                      onShow={() => setFieldStatusOpen(true)}
                    />
                  </div>
                </div>
                <div className="min-w-0 rounded-md border">
                  <div
                    className={cn(
                      "transition-opacity duration-motion-exit ease-[var(--motion-ease-exit)]",
                      fieldFilterPhase === "exiting"
                        ? "opacity-0"
                        : "opacity-100",
                    )}
                    data-field-list-filter={fieldFilterPhase}
                  >
                    <BarnTable
                      rows={fieldMotionRows}
                      controller={controller ?? null}
                      thermoSettings={thermoSettings}
                      alarmSettings={alarmSettings}
                      canCommand={controller?.canCommand ?? false}
                      initialSp={listSp}
                      initialListMode={listMode}
                      initialListLayout={listLayout}
                      focusControllerKey={listFocusKey}
                      hubMode={hubMode}
                      onHubUrlChange={onHubUrlChange}
                      liveRefreshManaged={liveRefreshManaged}
                      staggerMount={readings.length > STAGGER_MOUNT_MIN_READINGS}
                      onRequestPanelEnrichment={enrichListIfNeeded}
                      trendPeriod={trendPeriod}
                      onTrendPeriodChange={onTrendPeriodChange}
                      panelLiveActive={fieldActive}
                      listFilterEnterEpoch={fieldFilterEnterEpoch}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div
              className={cn(
                "min-h-0 lg:min-h-[16rem]",
                panelMotionClass("map"),
              )}
              aria-hidden={view !== "map"}
              data-farm-view-panel="map"
              data-farm-view-active={view === "map"}
            >
              <FarmMapView
                barns={barnSnapshots}
                readings={readings}
                gridCols={gridCols}
                gridRows={gridRows}
                trendByPeriod={trendByPeriod}
                controllerTrendByPeriod={gridControllerTrend}
                controller={controller}
                hubMode={hubMode}
                compactShell={gridCompactShell}
                trendPeriod={trendPeriod}
                onTrendPeriodChange={onTrendPeriodChange}
                trendLoading={gridTrendLoading}
                trendStale={gridTrendStale}
              />
            </div>

            {listEverOpened ? (
              <div
                className={panelMotionClass("list")}
                aria-hidden={view !== "list"}
                data-farm-view-panel="list"
                data-farm-view-active={view === "list"}
              >
                <BarnTable
                  rows={readings}
                  controller={controller ?? null}
                  thermoSettings={thermoSettings}
                  alarmSettings={alarmSettings}
                  canCommand={controller?.canCommand ?? false}
                  initialSp={listSp}
                  initialListMode={listMode}
                  initialListLayout={listLayout}
                  focusControllerKey={view === "list" ? urlCtrl : null}
                  hubMode={hubMode}
                  onHubUrlChange={onHubUrlChange}
                  liveRefreshManaged={liveRefreshManaged}
                  staggerMount={readings.length > STAGGER_MOUNT_MIN_READINGS}
                  onRequestPanelEnrichment={enrichListIfNeeded}
                  trendPeriod={trendPeriod}
                  onTrendPeriodChange={onTrendPeriodChange}
                  panelLiveActive={isFarmHubPanelLiveActive(view, "list")}
                />
              </div>
            ) : null}
          </>
        )}

        {chartEverOpened ? (
          <div
            className={panelMotionClass("chart")}
            aria-hidden={view !== "chart"}
            data-farm-view-panel="chart"
            data-farm-view-active={view === "chart"}
          >
            <div className="relative min-h-0">
              <FarmChartView
                readings={readings}
                controllerTrendByPeriod={gridControllerTrend}
                period={trendPeriod}
                onPeriodChange={onTrendPeriodChange}
                scope={chartScope}
                onScopeChange={onChartScopeChange}
                initialZoom={chartZoomHint}
                onZoomChange={onChartZoomChange}
                alarmSettings={alarmSettings}
                thermoSettings={thermoSettings}
                canCommand={controller?.canCommand ?? false}
                isMobileStack={viewportCompact}
                layersToolbarActive={view === "chart"}
              />
            </div>
          </div>
        ) : null}

        {delinEnabled() && ariaEverOpened ? (
          <div
            className={panelMotionClass("aria")}
            aria-hidden={view !== "aria"}
            data-farm-view-panel="aria"
            data-farm-view-active={view === "aria"}
          >
            <FarmAriaView
              currentFarm={ariaFarm}
              isMobileStack={viewportCompact}
              panelLiveActive={isFarmHubPanelLiveActive(view, "aria")}
              readings={readings}
              controllerTrendByPeriod={gridControllerTrend}
              trendLoading={gridTrendLoading && !gridControllerTrend}
              trendPeriod={trendPeriod}
              onTrendPeriodChange={onTrendPeriodChange}
              alarmSettings={alarmSettings}
              thermoSettings={thermoSettings}
              canCommand={controller?.canCommand ?? false}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
