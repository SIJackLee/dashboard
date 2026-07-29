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
import { Map, List, LineChart } from "lucide-react";
import type { BarnMapSnapshot } from "@/lib/data/iot";
import type { BarnReading } from "@/lib/data/iot";
import type { TrendPeriodData, TrendPeriodId } from "@/lib/data/farm-trend-types";
import { FarmMapView } from "@/components/farm/farm-map-view";
import { FarmChartView } from "@/components/farm/farm-chart-view";
import { BarnTable } from "@/components/farm/barn-table";
import { FarmFeatureTour } from "@/components/onboarding/feature-tour";
import {
  applyHubScopedViewParams,
  currentFarmSearchParams,
  replaceFarmUrlShallow,
  resolveFarmHubView,
  resolveListLayoutParam,
  resolveListViewMode,
  resolveTrendPeriodParam,
  setTrendPeriodParam,
  type FarmHubView,
} from "@/lib/farm/farm-view-url";
import { isScopedControllerEnriched } from "@/lib/farm/farm-scoped-panel-utils";
import type { ControllerGridData } from "@/lib/farm/controller-grid-data";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
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
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import { motionClass } from "@/lib/ui/motion-classes";
import { useFarmTourActive } from "@/lib/onboarding/use-farm-tour-active";
import { STAGGER_MOUNT_MIN_READINGS } from "@/lib/farm/stagger-mount";

const FARM_HUB_VIEW_ORDER: Record<FarmHubView, number> = {
  map: 0,
  list: 1,
  chart: 2,
};

/** globals.css farm-view-slide-* (moderate enter + exit) */
const FARM_VIEW_SLIDE_MS = 280;

type FarmViewSlide = {
  from: FarmHubView;
  to: FarmHubView;
  dir: 1 | -1;
};

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
  /** SSR과 일치하는 초기 그리드/목록/차트 탭 (hubMode) */
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
  /** shallow URL(window)은 mount 후에만 — hydration 시 searchParams와 불일치 방지 */
  const [urlHydrated, setUrlHydrated] = useState(false);
  /** SSR·첫 페인트와 동일한 URL 기준 초기 탭 (window 읽지 않음) */
  const bootstrapView: FarmHubView =
    initialHubView ?? resolveFarmHubView(searchParams.get("view"));
  const [view, setViewState] = useState<FarmHubView>(bootstrapView);
  const [viewSlide, setViewSlide] = useState<FarmViewSlide | null>(null);
  const [listEverOpened, setListEverOpened] = useState(bootstrapView === "list");
  const [chartEverOpened, setChartEverOpened] = useState(
    bootstrapView === "chart",
  );
  const [urlTick, setUrlTick] = useState(0);
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

  const beginViewSlide = useCallback((from: FarmHubView, to: FarmHubView) => {
    if (from === to) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setViewSlide(null);
      return;
    }
    const dir: 1 | -1 =
      FARM_HUB_VIEW_ORDER[to] >= FARM_HUB_VIEW_ORDER[from] ? 1 : -1;
    setViewSlide({ from, to, dir });
  }, []);

  useEffect(() => {
    queueMicrotask(() => setUrlHydrated(true));
  }, []);
  const tourActiveRef = useRef(tourActive);
  useEffect(() => {
    tourActiveRef.current = tourActive;
  });

  useEffect(() => {
    if (!hubMode) return;
    queueMicrotask(() => {
      const next = resolveFarmHubView(currentFarmSearchParams().get("view"));
      setViewState((prev) => {
        if (prev !== next) {
          queueMicrotask(() => beginViewSlide(prev, next));
        }
        return next;
      });
      if (next === "list") setListEverOpened(true);
      if (next === "chart") setChartEverOpened(true);
    });
  }, [hubMode, hubUrlEpoch, beginViewSlide]);

  // 비허브 — 라우터 네비게이션(view=list|chart)에 뷰 상태 동기화.
  // 탭 토글은 shallow replaceState라 useSearchParams가 갱신되지 않아 여기서 재정의되지 않음.
  const [lastViewParam, setLastViewParam] = useState<string | null>(
    () => searchParams.get("view"),
  );
  const viewParam = searchParams.get("view");
  if (!hubMode && viewParam !== lastViewParam) {
    setLastViewParam(viewParam);
    const next = resolveFarmHubView(viewParam);
    if (view !== next) {
      beginViewSlide(view, next);
      setViewState(next);
    }
    if (next === "list") setListEverOpened(true);
    if (next === "chart") setChartEverOpened(true);
  }

  if (view === "list" && !listEverOpened) {
    setListEverOpened(true);
  }
  if (view === "chart" && !chartEverOpened) {
    setChartEverOpened(true);
  }
  // 그리드·목록 공유 프리페치 — map/list 훅이 모듈 캐시를 공유해 이중 fetch 방지.
  // FarmKey는 객체이므로 참조가 아닌 farmKeyId로 단일 농장 여부 판정.
  const gridFarmKey = useMemo<FarmKey | null>(() => {
    const first = readings[0]?.farmKey ?? null;
    if (!first) return null;
    const firstId = farmKeyId(first);
    const allSame = readings.every(
      (r) => r.farmKey && farmKeyId(r.farmKey) === firstId,
    );
    return allSame ? first : null;
  }, [readings]);
  // 투어 중에도 유지 — 목록 챕터(C) 진입 전 목록 enrich에 쓸 수 있음.
  // 목록 enrich·soft panel fetch만 tourActive로 일시정지.
  // listEverOpened 후에도 유지해 목록 BarnTable과 캐시를 공유한다.
  const { data: gridControllerTrend, loading: gridTrendLoading, isStale: gridTrendStale } = useFarmControllerTrend({
    farmKey: gridFarmKey,
    enabled:
      Boolean(gridFarmKey) &&
      (view === "map" || view === "chart" || listEverOpened || chartEverOpened),
  });

  const shallowParams = useMemo(() => {
    void urlTick;
    void hubUrlEpoch;
    // SSR·hydration: useSearchParams (서버 HTML과 동일).
    // mount 이후: shallow replaceState 반영을 위해 window.location.
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

  const onTrendPeriodChange = useCallback(
    (period: TrendPeriodId) => {
      const params = new URLSearchParams(currentFarmSearchParams().toString());
      setTrendPeriodParam(params, period);
      replaceFarmUrlShallow(params);
      onHubUrlChange?.();
      setUrlTick((n) => n + 1);
    },
    [onHubUrlChange],
  );
  const thermoSettings = controller?.thermoSettings ?? {};
  const alarmSettings = controller?.alarmSettings;

  const enrichListIfNeeded = useCallback(async () => {
    if (!lazyListEnrichment || !lazyListFarmKey) return;
    // A2 — 투어 중 목록 보강 억제 (카드가 뒤늦게 튀어나와 난잡해지는 것 방지)
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

  useEffect(() => {
    enrichGenRef.current += 1;
  }, [lazyListFarmKey]);

  /** LIVE 안정 후 idle — stall·controller 추이·panel enrich를 백그라운드에 채움 */
  useEffect(() => {
    if (!gridFarmKey || tourActive) return;
    let cancelled = false;
    let idleId = 0;
    const run = () => {
      if (cancelled) return;
      void prefetchFarmControllerTrend(gridFarmKey);
      void prefetchFarmStallTrend(gridFarmKey).then((trend) => {
        if (cancelled) return;
        liveRefreshRef.current?.hydrateStallTrend(gridFarmKey, trend);
      });
      void enrichListIfNeeded();
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
  }, [gridFarmKey, tourActive, enrichListIfNeeded]);

  useEffect(() => {
    enrichFarmRef.current = null;
  }, [lazyListFarmKey]);

  useEffect(() => {
    if (!lazyListEnrichment || !lazyListFarmKey) return;
    if (tourActive) return;

    const farmId = farmKeyId(lazyListFarmKey);
    if (enrichFarmRef.current === farmId) return;
    if (isScopedControllerEnriched(liveRefresh?.slice.controller)) {
      enrichFarmRef.current = farmId;
      return;
    }

    enrichFarmRef.current = farmId;
    void enrichListIfNeeded();
  // controller 전체 포함 시 enrich 루프 — 설정 필드만 감시
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 의도적 생략
  }, [
    lazyListEnrichment,
    lazyListFarmKey,
    tourActive,
    liveRefresh?.slice.controller?.alarmSettings,
    liveRefresh?.slice.controller?.thermoSettings,
    enrichListIfNeeded,
  ]);

  // 투어 종료(active→inactive) 직후 목록 보강 재개
  const wasTourActiveRef = useRef(false);
  useEffect(() => {
    const wasActive = wasTourActiveRef.current;
    wasTourActiveRef.current = tourActive;
    if (tourActive || !wasActive) return;
    if (!listEverOpened && view !== "list") return;
    if (!lazyListEnrichment || !lazyListFarmKey) return;
    if (isScopedControllerEnriched(liveRefresh?.slice.controller)) return;
    enrichFarmRef.current = null;
    // effect 동기 setState 경고 회피 — 마이크로태스크로 보강 시작
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

  const applyViewChange = useCallback(
    (next: FarmHubView) => {
      if (next === "list") {
        setListEverOpened(true);
        void enrichListIfNeeded();
      }
      if (next === "chart") {
        setChartEverOpened(true);
      }
      /* 낙관적 UI — 탭·URL 즉시, transition 지연 없음 */
      beginViewSlide(view, next);
      setViewState(next);
      if (hubMode) {
        const params = new URLSearchParams(
          currentFarmSearchParams().toString(),
        );
        applyHubScopedViewParams(params, next);
        replaceFarmUrlShallow(params);
        onHubUrlChange?.();
        setUrlTick((n) => n + 1);
        return;
      }
      const params = new URLSearchParams(currentFarmSearchParams().toString());
      params.delete("tab");
      if (next === "list") {
        params.set("view", "list");
      } else if (next === "chart") {
        params.set("view", "chart");
        params.delete("listMode");
      } else {
        params.delete("view");
        params.delete("listMode");
      }
      replaceFarmUrlShallow(params);
      setUrlTick((n) => n + 1);
    },
    [hubMode, onHubUrlChange, enrichListIfNeeded, beginViewSlide, view],
  );

  const setView = useCallback(
    (next: FarmHubView) => {
      applyViewChange(next);
    },
    [applyViewChange],
  );

  /** 온보딩 투어 — map|list 만 */
  const setTourView = useCallback(
    (next: "map" | "list") => {
      applyViewChange(next);
    },
    [applyViewChange],
  );

  useEffect(() => {
    if (!viewSlide) return;
    const t = window.setTimeout(() => setViewSlide(null), FARM_VIEW_SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [viewSlide]);

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
  const awaitingScopeSlot = hubMode && !hideViewTabs && scopeToggleSlot === undefined;

  const viewToggle = !hideViewTabs ? (
    <div
      ref={tablistRef}
      className={cn(
        "relative inline-flex rounded-xl border bg-muted/20 p-1",
        embedInScopeHeader
          ? "text-sm md:text-sm"
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
          "pointer-events-none absolute top-1 bottom-1 z-0 rounded-lg bg-background shadow-sm dark:bg-primary/10",
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
        className={cn(
          "relative z-[1] inline-flex items-center gap-1.5 rounded-lg font-medium",
          embedInScopeHeader ? "px-3 py-1.5" : "gap-2 px-5 py-2.5",
          motionClass.microInteractive,
          tabNavClass,
          view === "map"
            ? "text-foreground dark:text-primary"
            : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => setView("map")}
      >
        <Map className={dashboardUi.iconSm} aria-hidden />
        그리드
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === "list"}
        className={cn(
          "relative z-[1] inline-flex items-center gap-1.5 rounded-lg font-medium",
          embedInScopeHeader ? "px-3 py-1.5" : "gap-2 px-5 py-2.5",
          motionClass.microInteractive,
          tabNavClass,
          view === "list"
            ? "text-foreground dark:text-primary"
            : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => setView("list")}
      >
        <List className={dashboardUi.iconSm} aria-hidden />
        목록
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === "chart"}
        className={cn(
          "relative z-[1] inline-flex items-center gap-1.5 rounded-lg font-medium",
          embedInScopeHeader ? "px-3 py-1.5" : "gap-2 px-5 py-2.5",
          motionClass.microInteractive,
          tabNavClass,
          view === "chart"
            ? "text-foreground dark:text-primary"
            : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => setView("chart")}
      >
        <LineChart className={dashboardUi.iconSm} aria-hidden />
        차트
      </button>
    </div>
  ) : null;

  return (
    <div className={cn(embedInScopeHeader ? "space-y-3" : "space-y-4")}>
      <FarmFeatureTour view={view === "list" ? "list" : "map"} setView={setTourView} enabled={!hideViewTabs} />
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
            {/* enrich 중에도 grid readings로 BarnTable 유지 — 전체 skeleton 교체 금지 */}
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
              alarmSettings={alarmSettings}
              isMobileStack={viewportCompact}
              layersToolbarActive={view === "chart"}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
