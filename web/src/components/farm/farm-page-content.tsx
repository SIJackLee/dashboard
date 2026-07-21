"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { useSearchParams } from "next/navigation";
import { Map, List } from "lucide-react";
import type { BarnMapSnapshot } from "@/lib/data/iot";
import type { BarnReading } from "@/lib/data/iot";
import type { TrendPeriodData, TrendPeriodId } from "@/lib/data/farm-trend-types";
import { FarmMapView } from "@/components/farm/farm-map-view";
import { BarnTable } from "@/components/farm/barn-table";
import { FarmFeatureTour } from "@/components/onboarding/feature-tour";
import {
  applyHubScopedViewParams,
  currentFarmSearchParams,
  replaceFarmUrlShallow,
  resolveListLayoutParam,
  resolveListViewMode,
  resolveTrendPeriodParam,
  setTrendPeriodParam,
} from "@/lib/farm/farm-view-url";
import { isScopedControllerEnriched } from "@/lib/farm/farm-scoped-panel-utils";
import type { ControllerGridData } from "@/lib/farm/controller-grid-data";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import { useFarmControllerTrend } from "@/lib/farm/use-farm-controller-trend";
import { fetchFarmScopedPanelDataAction } from "@/app/(dashboard)/farm/actions";
import {
  readFarmPanelCache,
  useFarmLiveRefreshOptional,
} from "@/lib/navigation/farm-live-refresh";
import { FarmListSkeleton } from "@/components/common/loading-skeletons";
import { useHydrationSafeDashboardCompact } from "@/components/layout/dashboard-viewport-context";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import { motionClass } from "@/lib/ui/motion-classes";
import { useFarmTourActive } from "@/lib/onboarding/use-farm-tour-active";

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
  /** SSR과 일치하는 초기 그리드/목록 탭 (hubMode) */
  initialHubView?: "map" | "list";
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
  liveRefreshRef.current = liveRefresh;
  const enrichFarmRef = useRef<string | null>(null);
  const [listEnriching, setListEnriching] = useState(false);
  /** SSR·첫 페인트와 동일한 URL 기준 초기 탭 (window 읽지 않음) */
  const bootstrapView: "map" | "list" =
    initialHubView ??
    (searchParams.get("view") === "list" ? "list" : "map");
  const [view, setViewState] = useState<"map" | "list">(bootstrapView);
  const [listEverOpened, setListEverOpened] = useState(bootstrapView === "list");
  const [urlTick, setUrlTick] = useState(0);
  const tourActiveRef = useRef(tourActive);
  tourActiveRef.current = tourActive;

  useEffect(() => {
    if (!hubMode) return;
    const next = currentFarmSearchParams().get("view") === "list" ? "list" : "map";
    setViewState(next);
    if (next === "list") setListEverOpened(true);
  }, [hubMode, hubUrlEpoch]);

  // 비허브 — 라우터 네비게이션(view=list, 예: 히트맵 '컨트롤러 이동')에 뷰 상태 동기화.
  // 탭 토글은 shallow replaceState라 useSearchParams가 갱신되지 않아 여기서 재정의되지 않음.
  const lastViewParamRef = useRef<string | null>(searchParams.get("view"));
  useEffect(() => {
    if (hubMode) return;
    const v = searchParams.get("view");
    if (v === lastViewParamRef.current) return;
    lastViewParamRef.current = v;
    const next = v === "list" ? "list" : "map";
    setViewState(next);
    if (next === "list") setListEverOpened(true);
  }, [hubMode, searchParams]);

  useEffect(() => {
    if (view === "list") setListEverOpened(true);
  }, [view]);

  // 그리드 진입 시 컨트롤러 단위 추이 프리페치 — 히트맵 확대 시 컨트롤러별 미니 히트맵에 사용.
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
  // 투어 중에도 유지 — 5/9(detail-panel-chart-first)가 controllerTrend에 의존.
  // 목록 enrich·soft panel fetch만 tourActive로 일시정지.
  const { data: gridControllerTrend, loading: gridTrendLoading, isStale: gridTrendStale } = useFarmControllerTrend({
    farmKey: gridFarmKey,
    enabled: Boolean(gridFarmKey) && view === "map",
  });

  const shallowParams = useMemo(() => {
    void urlTick;
    void hubUrlEpoch;
    // SSR은 window가 없어 빈 파라미터가 되므로 useSearchParams 기준으로 렌더
    // (예: ?trendPeriod=7d 새로고침 시 서버 24h vs 클라 7d hydration 불일치 방지).
    // hydration 이후에는 shallow replaceState 반영을 위해 window.location 기준.
    if (typeof window === "undefined") {
      return new URLSearchParams(searchParams.toString());
    }
    return currentFarmSearchParams();
  }, [hubMode, hubUrlEpoch, urlTick, searchParams]);

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

    setListEnriching(true);
    try {
      const data = await fetchFarmScopedPanelDataAction(lazyListFarmKey);
      liveRefreshRef.current?.hydrateScopedPanel(data);
    } catch {
      // 목록은 grid readings로 제한 표시
    } finally {
      setListEnriching(false);
    }
  }, [lazyListEnrichment, lazyListFarmKey]);

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
    (next: "map" | "list") => {
      if (next === "list") {
        setListEverOpened(true);
        void enrichListIfNeeded();
      }
      setViewState(next);
      if (hubMode) {
        const params = new URLSearchParams(currentFarmSearchParams().toString());
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
      } else {
        params.delete("view");
        params.delete("listMode");
      }
      replaceFarmUrlShallow(params);
      setUrlTick((n) => n + 1);
    },
    [hubMode, onHubUrlChange, enrichListIfNeeded]
  );

  const setView = useCallback(
    (next: "map" | "list") => {
      queueMicrotask(() => {
        flushSync(() => {
          applyViewChange(next);
        });
      });
    },
    [applyViewChange]
  );

  const tabNavClass =
    gridCompactShell || viewportCompact
      ? "text-sm font-medium md:text-sm"
      : dashboardUi.tabNav;

  const mapHidden = view !== "map";
  const listHidden = view !== "list";
  /** 비활성 패널 — hidden으로 클릭·inert 유령 UI 방지 (crossfade는 활성 패널만) */
  const panelVisible = cn("opacity-100", motionClass.viewCrossfade);

  return (
    <div className="space-y-4">
      <FarmFeatureTour view={view} setView={setView} enabled={!hideViewTabs} />
      {!hideViewTabs ? (
        <div
          className={cn(
            "inline-flex rounded-xl border bg-muted/20 p-1",
            gridCompactShell || viewportCompact
              ? "text-sm md:text-sm"
              : dashboardUi.body
          )}
          role="tablist"
          aria-label="농장 보기"
          data-tour-id="view-toggle"
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === "map"}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-5 py-2.5 font-medium transition-colors",
              tabNavClass,
              view === "map"
                ? "bg-background text-foreground shadow-sm dark:bg-primary/10 dark:text-primary"
                : "text-muted-foreground hover:text-foreground"
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
              "inline-flex items-center gap-2 rounded-lg px-5 py-2.5 font-medium transition-colors",
              tabNavClass,
              view === "list"
                ? "bg-background text-foreground shadow-sm dark:bg-primary/10 dark:text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setView("list")}
          >
            <List className={dashboardUi.iconSm} aria-hidden />
            목록
          </button>
        </div>
      ) : null}

      <div className="relative min-h-0" data-farm-view-slot>
        <div
          className={cn(
            "min-h-0 lg:min-h-[16rem]",
            mapHidden ? "hidden" : panelVisible,
          )}
          aria-hidden={mapHidden}
          data-farm-view-panel="map"
          data-farm-view-active={!mapHidden}
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
            className={cn(listHidden ? "hidden" : panelVisible)}
            aria-hidden={listHidden}
            data-farm-view-panel="list"
            data-farm-view-active={!listHidden}
          >
            {listEnriching ? (
              <FarmListSkeleton />
            ) : (
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
                staggerMount
                onRequestPanelEnrichment={enrichListIfNeeded}
                trendPeriod={trendPeriod}
                onTrendPeriodChange={onTrendPeriodChange}
              />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
