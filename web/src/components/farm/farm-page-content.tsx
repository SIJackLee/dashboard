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
import { Map, List, LineChart, Bot } from "lucide-react";
import type { BarnMapSnapshot } from "@/lib/data/iot";
import type { BarnReading } from "@/lib/data/iot";
import type { TrendPeriodData, TrendPeriodId } from "@/lib/data/farm-trend-types";
import { FarmMapView } from "@/components/farm/farm-map-view";
import { FarmChartView } from "@/components/farm/farm-chart-view";
import { FarmAriaView } from "@/components/farm/farm-aria-view";
import { BarnTable } from "@/components/farm/barn-table";
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
  resolveFarmChartScope,
  type FarmChartScope,
} from "@/lib/farm/farm-chart-scope";
import { isFarmHubPanelLiveActive } from "@/lib/farm/farm-hub-keepalive";
import { useFarmHubViewShell } from "@/lib/farm/use-farm-hub-view-shell";
import { isScopedControllerEnriched } from "@/lib/farm/farm-scoped-panel-utils";
import type { ControllerGridData } from "@/lib/farm/controller-grid-data";
import { farmKeyId, parseFarmKeyFromQuery, type FarmKey } from "@/lib/data/farm-key";
import {
  prefetchFarmControllerTrend,
  useFarmControllerTrend,
} from "@/lib/farm/use-farm-controller-trend";
import { prefetchFarmStallTrend } from "@/lib/farm/use-farm-stall-trend";
import { fetchFarmPanelEnrichShared } from "@/lib/farm/fetch-farm-panel-enrich";
import {
  readFarmPanelCache,
  useFarmLiveRefreshOptional,
} from "@/lib/navigation/farm-live-refresh";
import { useHydrationSafeDashboardCompact } from "@/components/layout/dashboard-viewport-context";
import { dashboardChroma, dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import { motionClass } from "@/lib/ui/motion-classes";
import { useFarmTourActive } from "@/lib/onboarding/use-farm-tour-active";
import { DELIN_NAME } from "@/lib/aria/aria-mode";
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
  /** ScopeBar 농장 선택 옆 슬롯 — undefined=미확인, null=없음, Element=portal */
  const [scopeToggleSlot, setScopeToggleSlot] = useState<
    Element | null | undefined
  >(undefined);

  useEffect(() => {
    if (hideViewTabs || !hubMode) {
      queueMicrotask(() => setScopeToggleSlot(null));
      return;
    }
    queueMicrotask(() => {
      setScopeToggleSlot(
        document.querySelector("[data-farm-view-toggle-slot]"),
      );
    });
  }, [hideViewTabs, hubMode]);

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
    setTourView,
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

  useEffect(() => {
    enrichGenRef.current += 1;
  }, [lazyListFarmKey]);

  useEffect(() => {
    enrichFarmRef.current = null;
  }, [lazyListFarmKey]);

  /** LIVE 안정 후 idle — 활성 탭에 맞는 stall·controller 추이·list enrich만 */
  useEffect(() => {
    if (!gridFarmKey || tourActive) return;
    if (view === "aria") return;
    let cancelled = false;
    let idleId = 0;
    const run = () => {
      if (cancelled) return;
      if (view === "map" || view === "chart" || view === "list") {
        void prefetchFarmControllerTrend(gridFarmKey);
        void prefetchFarmStallTrend(gridFarmKey).then((trend) => {
          if (cancelled) return;
          liveRefreshRef.current?.hydrateStallTrend(gridFarmKey, trend);
        });
      }
      if (view === "list") {
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
  }, [gridFarmKey, tourActive, enrichListIfNeeded, view]);

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
        (view === "map" || view === "chart" || view === "list"),
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
  const listSp = view === "list" ? shallowParams.get("sp") ?? undefined : undefined;
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

  const onTrendPeriodChange = useCallback(
    (period: TrendPeriodId) => {
      const params = new URLSearchParams(currentFarmSearchParams().toString());
      setTrendPeriodParam(params, period);
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

  const embedInScopeHeader = Boolean(scopeToggleSlot);
  const awaitingScopeSlot =
    hubMode && !hideViewTabs && scopeToggleSlot === undefined;

  const viewTabBtn = (active: boolean) =>
    cn(
      "relative z-[1] inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium",
      embedInScopeHeader
        ? "flex-1 px-2.5 py-1.5 sm:flex-none sm:px-3"
        : "gap-2 px-5 py-2.5",
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
        embedInScopeHeader
          ? "w-full text-sm md:text-sm sm:w-auto"
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
    </div>
  ) : null;

  return (
    <div className={cn(embedInScopeHeader ? "space-y-3" : "space-y-4")}>
      <FarmFeatureTour
        view={view === "list" ? "list" : "map"}
        setView={setTourView}
        enabled={!hideViewTabs}
      />
      {viewToggle && scopeToggleSlot
        ? createPortal(viewToggle, scopeToggleSlot)
        : awaitingScopeSlot
          ? null
          : viewToggle}

      <div className="relative min-h-0 overflow-hidden" data-farm-view-slot>
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

        {chartEverOpened ? (
          <div
            className={panelMotionClass("chart")}
            aria-hidden={view !== "chart"}
            data-farm-view-panel="chart"
            data-farm-view-active={view === "chart"}
          >
            <FarmChartView
              readings={readings}
              controllerTrendByPeriod={gridControllerTrend}
              period={trendPeriod}
              onPeriodChange={onTrendPeriodChange}
              scope={chartScope}
              onScopeChange={onChartScopeChange}
              alarmSettings={alarmSettings}
              thermoSettings={thermoSettings}
              canCommand={controller?.canCommand ?? false}
              isMobileStack={viewportCompact}
              layersToolbarActive={view === "chart"}
            />
          </div>
        ) : null}

        {ariaEverOpened ? (
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
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
