"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, LayoutList, Loader2 } from "lucide-react";
import { StaleWhileRevalidateShell } from "@/components/common/stale-while-revalidate-shell";
import { InlineStatusToast, type InlineStatusTone } from "@/components/common/inline-status-toast";
import { RefreshScopeShell } from "@/components/common/refresh-scope-shell";
import { SectionCard } from "@/components/common/section-card";
import { PageActionButton } from "@/components/common/page-action-button";
import { BarnListSummary } from "@/components/farm/barn-list-summary";
import { BarnListModeToolbar } from "@/components/farm/barn-list-mode-toolbar";
import { BarnListTrendRefreshBar } from "@/components/farm/barn-list-trend-refresh-bar";
import type {
  ApplyResult,
  BulkApplyFeedback,
} from "@/components/farm/farm-map-bulk-apply";

const FarmMapBulkApply = dynamic(
  () =>
    import("@/components/farm/farm-map-bulk-apply").then((m) => ({
      default: m.FarmMapBulkApply,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-11 shrink-0 animate-pulse rounded-md bg-muted/30" />
    ),
  },
);
import type { ControllerGridData } from "@/lib/farm/controller-grid-data";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { BarnReading } from "@/lib/data/iot";
import {
  applyHubScopedViewParams,
  currentFarmSearchParams,
  replaceFarmUrlShallow,
  resolveListViewMode,
  resolveListLayoutParam,
  resolveTrendPeriodParam,
  setTrendPeriodParam,
  type BarnListViewMode,
  type ListLayout,
} from "@/lib/farm/farm-view-url";
import {
  EMPTY_BARN_LIST_PANEL_SETS,
  toggleBarnListGraph,
  toggleBarnListSettings,
  setBarnListSheetPage,
  isBarnListMobileToolbarSheetMode,
  barnListToolbarSheetInitialPage,
  toggleBarnListCardBody,
  expandBarnListCardBody,
  closeBarnListSettingsForKey,
  type BarnListPanelSets,
  type ControllerMobileSheetPage,
} from "@/lib/farm/barn-list-panel-state";
import { useHydrationSafeDashboardCompact } from "@/components/layout/dashboard-viewport-context";
import { useFarmControllerTrend } from "@/lib/farm/use-farm-controller-trend";
import {
  type TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import { useFarmLiveRefreshOptional } from "@/lib/navigation/farm-live-refresh";
import { useSoftRefresh } from "@/lib/ui/use-soft-refresh";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { isFilterAll } from "@/lib/ui/filter-all";
import { cn } from "@/lib/utils";

type Props = {
  rows?: BarnReading[];
  controller?: ControllerGridData | null;
  thermoSettings?: Record<string, ControllerThermoSettings>;
  alarmSettings?: AlarmSettings;
  canCommand?: boolean;
  initialSp?: string;
  initialListMode?: BarnListViewMode;
  initialListLayout?: ListLayout;
  compactHeader?: boolean;
  hubMode?: boolean;
  onHubUrlChange?: () => void;
  liveRefreshManaged?: boolean;
  staggerMount?: boolean;
  /** admin 캐시 패널 — alarmSettings 등 scoped 데이터 보강 */
  onRequestPanelEnrichment?: () => void | Promise<void>;
  /** 그리드 히트맵 '컨트롤러 이동' 도착 — 해당 controllerKey 카드로 스크롤/하이라이트 */
  focusControllerKey?: string | null;
  /** 그리드·목록 공유 추이 기간 (URL 동기화). */
  trendPeriod?: TrendPeriodId;
  onTrendPeriodChange?: (period: TrendPeriodId) => void;
};

function stallTyCodesFromReadings(readings: BarnReading[]): string[] {
  return [
    ...new Set(
      readings
        .map((r) => r.stallTyCode)
        .filter(Boolean)
        .map((code) => normalizeStallTyCode(code!)),
    ),
  ];
}

export function BarnTable({
  rows = [],
  controller = null,
  thermoSettings = {},
  alarmSettings,
  canCommand = false,
  initialSp,
  initialListMode,
  initialListLayout,
  compactHeader: _compactHeader = false,
  hubMode = false,
  onHubUrlChange,
  liveRefreshManaged = false,
  staggerMount = false,
  onRequestPanelEnrichment,
  focusControllerKey = null,
  trendPeriod: trendPeriodProp,
  onTrendPeriodChange,
}: Props) {
  const router = useRouter();
  const compact = useHydrationSafeDashboardCompact();
  const liveRefresh = useFarmLiveRefreshOptional();
  const searchParams = useSearchParams();
  const [hubParamsTick, setHubParamsTick] = useState(0);
  const [urlTick, setUrlTick] = useState(0);
  const liveParams = useMemo(() => {
    void hubParamsTick;
    void urlTick;
    return currentFarmSearchParams();
  }, [hubParamsTick, urlTick, searchParams]);

  useEffect(() => {
    const sync = () => {
      setUrlTick((n) => n + 1);
      if (hubMode) setHubParamsTick((n) => n + 1);
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [hubMode]);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedSps, setSelectedSps] = useState<Set<string>>(new Set());
  const [panelSets, setPanelSets] = useState<BarnListPanelSets>(
    EMPTY_BARN_LIST_PANEL_SETS
  );
  /** 그래프(graph) 모드 — 본문이 펼쳐진 컨트롤러 키 */
  const [cardBodyExpandedKeys, setCardBodyExpandedKeys] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [toolbarSheetKey, setToolbarSheetKey] = useState<string | null>(null);
  const [toolbarSheetOpen, setToolbarSheetOpen] = useState(false);
  const [toolbarSheetPage, setToolbarSheetPage] =
    useState<ControllerMobileSheetPage>(0);
  const [statusToast, setStatusToast] = useState<{
    message: string;
    tone: InlineStatusTone;
  } | null>(null);

  const onListRefresh = useCallback(() => {
    if (liveRefreshManaged && liveRefresh) {
      if (liveRefresh.revalidating) return;
      return liveRefresh.revalidateFarmLive();
    }
    router.refresh();
  }, [liveRefresh, liveRefreshManaged, router]);
  const {
    run: refreshList,
    busy: listSoftRefreshBusy,
    showProgress: listRefreshVisible,
  } = useSoftRefresh(onListRefresh);

  const bulkEnabled = Boolean(controller?.canCommand);

  const resolveListLayout = useCallback(
    (params: URLSearchParams): ListLayout => resolveListLayoutParam(params),
    [],
  );

  /** SSR·hydration 동일 — window URL 금지. mount 후 urlTick effect로 동기화 */
  const [listLayout, setListLayout] = useState<ListLayout>(
    () => initialListLayout ?? "flat",
  );
  const [layoutPending, startLayoutTransition] = useTransition();

  const [listMode, setListMode] = useState<BarnListViewMode>(
    () => initialListMode ?? "controller",
  );

  useEffect(() => {
    queueMicrotask(() => {
      const params = currentFarmSearchParams();
      const nextLayout = resolveListLayout(params);
      setListLayout((prev) => (prev === nextLayout ? prev : nextLayout));
      const fromUrl = resolveListViewMode(params);
      setListMode((prev) => {
        if (prev === fromUrl) return prev;
        setCardBodyExpandedKeys(new Set());
        return fromUrl;
      });
    });
  }, [urlTick, hubParamsTick, resolveListLayout]);

  const effectiveListMode: BarnListViewMode = bulkMode ? "controller" : listMode;

  const mobileToolbarSheetMode = isBarnListMobileToolbarSheetMode(
    effectiveListMode,
    compact,
    bulkMode,
  );

  const graphToolbarMode = effectiveListMode === "graph";
  const graphPanelsOpen = panelSets.graphKeys.size > 0;
  const hasTrendToolbarRow = graphToolbarMode || graphPanelsOpen;
  const settingsPanelsOpen = panelSets.settingsKeys.size > 0;
  const farmKey = rows[0]?.farmKey ?? null;
  const trendEnabled = Boolean(farmKey) && !bulkMode;

  const {
    data: lazyControllerTrend,
    loading: trendInitialLoading,
    refreshing: trendRefreshing,
    isStale: trendIsStale,
    error: trendError,
    refresh: refreshTrend,
  } = useFarmControllerTrend({
    farmKey,
    enabled: trendEnabled,
  });

  const onTrendRefresh = useCallback(() => {
    const trendDone = Promise.resolve(refreshTrend());
    if (!hubMode) refreshList();
    return trendDone;
  }, [hubMode, refreshList, refreshTrend]);

  const {
    run: runTrendRefresh,
    busy: trendRefreshBusy,
    showProgress: trendRefreshVisible,
  } = useSoftRefresh(onTrendRefresh);

  const controllerTrendByPeriod = trendEnabled ? lazyControllerTrend : null;
  const trendRefreshSpinner = trendRefreshVisible || trendRefreshing;

  // 그리드 히트맵 '컨트롤러 이동' 도착 — controllerKey 카드로 스크롤 + 하이라이트.
  useEffect(() => {
    if (!focusControllerKey) return;
    const target = decodeURIComponent(focusControllerKey);
    let cancelled = false;
    let clearTimer: number | undefined;
    const scrollTimer = window.setTimeout(() => {
      if (cancelled) return;
      const escaped =
        typeof CSS !== "undefined" && CSS.escape
          ? CSS.escape(target)
          : target.replace(/["\\]/g, "\\$&");
      const el = document.querySelector<HTMLElement>(
        `[data-controller-key="${escaped}"]`,
      );
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("farm-ctrl-focus");
      clearTimer = window.setTimeout(
        () => el.classList.remove("farm-ctrl-focus"),
        4200,
      );
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(scrollTimer);
      if (clearTimer) window.clearTimeout(clearTimer);
    };
  }, [focusControllerKey]);

  const bulkPeriod = useMemo(
    () => trendPeriodProp ?? resolveTrendPeriodParam(liveParams),
    [trendPeriodProp, liveParams],
  );
  const [panelPeriodOverrides, setPanelPeriodOverrides] = useState<
    Record<string, TrendPeriodId>
  >({});

  const onBulkPeriodChange = useCallback(
    (period: TrendPeriodId) => {
      setPanelPeriodOverrides({});
      if (onTrendPeriodChange) {
        onTrendPeriodChange(period);
        return;
      }
      const params = new URLSearchParams(currentFarmSearchParams().toString());
      setTrendPeriodParam(params, period);
      replaceFarmUrlShallow(params);
      setUrlTick((n) => n + 1);
    },
    [onTrendPeriodChange],
  );

  const onPanelPeriodChange = useCallback((key: string, period: TrendPeriodId) => {
    setPanelPeriodOverrides((prev) => ({ ...prev, [key]: period }));
  }, []);

  const panelEnrichRequestedRef = useRef(false);
  useEffect(() => {
    if (!settingsPanelsOpen) {
      panelEnrichRequestedRef.current = false;
      return;
    }
    if (alarmSettings || !onRequestPanelEnrichment) return;
    if (panelEnrichRequestedRef.current) return;
    panelEnrichRequestedRef.current = true;
    void onRequestPanelEnrichment();
  }, [settingsPanelsOpen, alarmSettings, onRequestPanelEnrichment]);

  const toggleGraphPanel = useCallback((key: string) => {
    setPanelSets((prev) => toggleBarnListGraph(prev, key));
  }, []);

  const handleToggleCardBody = useCallback((key: string) => {
    setCardBodyExpandedKeys((prev) => {
      const collapsing = prev.has(key);
      if (collapsing) {
        setPanelSets((ps) => closeBarnListSettingsForKey(ps, key));
      }
      return toggleBarnListCardBody(prev, key);
    });
  }, []);

  const handleSheetPageChange = useCallback(
    (key: string, page: ControllerMobileSheetPage) => {
      setPanelSets((prev) => {
        if (
          page === 0 &&
          prev.graphKeys.has(key) &&
          !prev.settingsKeys.has(key)
        ) {
          return prev;
        }
        if (
          page === 1 &&
          prev.settingsKeys.has(key) &&
          !prev.graphKeys.has(key)
        ) {
          return prev;
        }
        return setBarnListSheetPage(prev, key, page);
      });
    },
    [],
  );

  const filteredRows = useMemo(() => {
    if (isFilterAll(initialSp)) return rows;
    return rows.filter((r) => r.stallTyCode === initialSp);
  }, [rows, initialSp]);

  const toolbarSheetModeKey = `${mobileToolbarSheetMode}|${effectiveListMode}`;
  const [prevToolbarSheetModeKey, setPrevToolbarSheetModeKey] =
    useState(toolbarSheetModeKey);

  if (!mobileToolbarSheetMode) {
    if (toolbarSheetKey !== null) setToolbarSheetKey(null);
    if (toolbarSheetOpen) setToolbarSheetOpen(false);
  } else {
    const nextKey =
      toolbarSheetKey && filteredRows.some((r) => r.key === toolbarSheetKey)
        ? toolbarSheetKey
        : (filteredRows[0]?.key ?? null);
    if (nextKey !== toolbarSheetKey) setToolbarSheetKey(nextKey);
    if (nextKey && !toolbarSheetOpen) setToolbarSheetOpen(true);
  }

  if (toolbarSheetModeKey !== prevToolbarSheetModeKey) {
    setPrevToolbarSheetModeKey(toolbarSheetModeKey);
    if (mobileToolbarSheetMode) {
      setToolbarSheetPage(barnListToolbarSheetInitialPage(effectiveListMode));
    }
  }

  const visibleSpCodes = useMemo(
    () => stallTyCodesFromReadings(filteredRows),
    [filteredRows],
  );

  const replaceListParams = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(currentFarmSearchParams().toString());
      if (hubMode) {
        applyHubScopedViewParams(params, "list");
      } else {
        params.set("view", "list");
      }
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === "") params.delete(key);
        else params.set(key, value);
      }
      replaceFarmUrlShallow(params);
      setUrlTick((n) => n + 1);
    },
    [hubMode],
  );

  const openMobileToolbarSheet = useCallback(
    (key: string, page: ControllerMobileSheetPage) => {
      const mode: BarnListViewMode = page === 1 ? "settings" : "graph";
      setListMode(mode);
      setPanelSets(EMPTY_BARN_LIST_PANEL_SETS);
      setCardBodyExpandedKeys(new Set());
      setToolbarSheetKey(key);
      setToolbarSheetPage(page);
      setToolbarSheetOpen(true);
      replaceListParams({ listMode: mode });
    },
    [replaceListParams],
  );

  const handleToggleGraph = useCallback(
    (key: string) => {
      if (compact && !bulkMode) {
        openMobileToolbarSheet(key, 0);
        return;
      }
      toggleGraphPanel(key);
    },
    [bulkMode, compact, openMobileToolbarSheet, toggleGraphPanel],
  );

  const handleToggleSettings = useCallback(
    (key: string) => {
      if (compact && !bulkMode) {
        openMobileToolbarSheet(key, 1);
        return;
      }
      setPanelSets((prev) => {
        const opening = !prev.settingsKeys.has(key);
        if (opening && listMode === "graph") {
          setCardBodyExpandedKeys((keys) => expandBarnListCardBody(keys, key));
        }
        return toggleBarnListSettings(prev, key);
      });
    },
    [bulkMode, compact, listMode, openMobileToolbarSheet],
  );

  const toggleListLayout = () => {
    if (bulkMode || layoutPending) return;
    const next: ListLayout = listLayout === "group" ? "flat" : "group";
    startLayoutTransition(() => {
      setListLayout(next);
      replaceListParams({
        listLayout: next === "group" ? "group" : null,
      });
    });
  };

  const handleListModeChange = (mode: BarnListViewMode) => {
    if (bulkMode) return;
    setListMode(mode);
    setPanelSets(EMPTY_BARN_LIST_PANEL_SETS);
    setCardBodyExpandedKeys(new Set());
    setToolbarSheetPage(barnListToolbarSheetInitialPage(mode));
    replaceListParams({
      listMode: mode === "controller" ? null : mode,
    });
  };

  const handleToolbarSheetKeyChange = useCallback(
    (key: string, page?: ControllerMobileSheetPage) => {
      setToolbarSheetKey(key);
      if (page !== undefined) setToolbarSheetPage(page);
    },
    [],
  );

  const handleToolbarSheetPageChange = useCallback(
    (page: ControllerMobileSheetPage) => {
      setToolbarSheetPage((prev) => (prev === page ? prev : page));
    },
    [],
  );

  const handleToolbarSheetClose = useCallback(() => {
    if (bulkMode) return;
    setToolbarSheetOpen(false);
    setListMode("controller");
    setPanelSets(EMPTY_BARN_LIST_PANEL_SETS);
    setCardBodyExpandedKeys(new Set());
    setToolbarSheetKey(null);
    replaceListParams({ listMode: null });
  }, [bulkMode, replaceListParams]);

  const toggleSp = useCallback((sp: string) => {
    const code = normalizeStallTyCode(sp);
    setSelectedSps((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  const enterBulk = useCallback(() => {
    setBulkMode(true);
    setSelectedSps(new Set(visibleSpCodes));
  }, [visibleSpCodes]);

  const exitBulk = useCallback(() => {
    setBulkMode(false);
    setSelectedSps(new Set());
  }, []);

  const listRefreshRing =
    listSoftRefreshBusy ||
    listRefreshVisible ||
    Boolean(liveRefresh?.revalidating) ||
    Boolean(liveRefresh?.isStale);

  const handleAfterBulkApply = useCallback(
    (result: ApplyResult, feedback: BulkApplyFeedback) => {
      setStatusToast({ message: feedback.message, tone: feedback.tone });
      if (result.alarm?.ok && result.alarm.settings && liveRefresh) {
        liveRefresh.patchAlarmSettings(result.alarm.settings);
      }
      if (liveRefreshManaged && liveRefresh) {
        void liveRefresh.revalidateFarmLive();
        return;
      }
      if (!hubMode) refreshList();
    },
    [hubMode, liveRefresh, liveRefreshManaged, refreshList],
  );

  const layoutToggleLabel =
    listLayout === "group" ? "일반 보기" : "그룹별 보기";
  const layoutToggleIcon = layoutPending ? (
    <Loader2 className={cn(dashboardUi.iconSm, "animate-spin")} aria-hidden />
  ) : listLayout === "group" ? (
    <LayoutGrid className={dashboardUi.iconSm} aria-hidden />
  ) : (
    <LayoutList className={dashboardUi.iconSm} aria-hidden />
  );

  const listToolbarDesktop = (
    <div className="flex flex-wrap items-center gap-2">
      <PageActionButton
        icon={layoutToggleIcon}
        onClick={toggleListLayout}
        disabled={layoutPending}
        aria-busy={layoutPending || undefined}
        aria-label={layoutPending ? "보기 전환 중" : layoutToggleLabel}
      >
        {layoutPending ? `${layoutToggleLabel}…` : layoutToggleLabel}
      </PageActionButton>
      <BarnListModeToolbar
        value={effectiveListMode}
        onChange={handleListModeChange}
      />
    </div>
  );

  /** 모바일 — bottom sheet로 Graph/Set 전환, 모드 탭·SP 필터 생략 */
  const listToolbarMobile = (
    <PageActionButton
      icon={layoutToggleIcon}
      onClick={toggleListLayout}
      disabled={layoutPending}
      aria-busy={layoutPending || undefined}
      aria-label={layoutPending ? "보기 전환 중" : layoutToggleLabel}
    >
      {layoutPending ? `${layoutToggleLabel}…` : layoutToggleLabel}
    </PageActionButton>
  );

  const listToolbar = compact ? listToolbarMobile : listToolbarDesktop;

  /** canCommand 없으면 CardHeader, 있으면 bulk bar trailing / bulk on 시 숨김 */
  const toolbarInBulkBar = bulkEnabled && !bulkMode;
  const showHeaderToolbar = !bulkEnabled;

  return (
    <RefreshScopeShell
      busy={listRefreshRing}
      showProgress={listRefreshVisible}
    >
      <SectionCard
        className={cn(
          listRefreshRing &&
            "ring-2 ring-emerald-500/25 transition-shadow duration-300",
        )}
        action={showHeaderToolbar ? listToolbar : undefined}
        contentClassName={bulkEnabled ? "flex flex-col gap-0 p-0" : undefined}
      >
      {bulkEnabled && controller ? (
        <FarmMapBulkApply
          controller={controller}
          bulkMode={bulkMode}
          selectedSps={Array.from(selectedSps)}
          onEnter={enterBulk}
          onClearSelection={() => setSelectedSps(new Set())}
          onExit={exitBulk}
          onAfterApply={handleAfterBulkApply}
          onRefreshLive={onListRefresh}
          trailing={toolbarInBulkBar ? listToolbar : undefined}
          trailingCompact={compact && toolbarInBulkBar}
        />
      ) : null}
      {hasTrendToolbarRow ? (
        <div
          className={cn(
            bulkEnabled && "px-4 md:px-6",
            bulkEnabled && !bulkMode && "pt-4 md:pt-6",
          )}
        >
          <BarnListTrendRefreshBar
            onRefresh={runTrendRefresh}
            bulkPeriod={bulkPeriod}
            onBulkPeriodChange={onBulkPeriodChange}
            busy={trendRefreshBusy}
            showSpinner={trendRefreshSpinner}
            showProgress={trendRefreshVisible}
            error={trendError}
          />
        </div>
      ) : null}
      <div
        className={cn(
          bulkEnabled && "px-4 pb-4 md:px-6 md:pb-6",
          bulkEnabled && !hasTrendToolbarRow && "pt-3 md:pt-4",
          bulkMode && "data-[bulk=list]",
        )}
        data-bulk={bulkMode ? "list" : undefined}
      >
      <StaleWhileRevalidateShell stale={trendIsStale}>
        <BarnListSummary
          readings={filteredRows}
          thermoSettings={thermoSettings}
          commands={controller?.commands}
          alarmSettings={alarmSettings}
          canCommand={canCommand}
          layout={listLayout}
          listMode={effectiveListMode}
          controllerTrendByPeriod={controllerTrendByPeriod}
          trendLoading={trendInitialLoading}
          trendStale={trendIsStale}
          bulkPeriod={bulkPeriod}
          panelPeriodOverrides={panelPeriodOverrides}
          onPanelPeriodChange={onPanelPeriodChange}
          panelSets={panelSets}
          cardBodyExpandedKeys={cardBodyExpandedKeys}
          onToggleGraph={handleToggleGraph}
          onToggleSettings={handleToggleSettings}
          onToggleCardBody={handleToggleCardBody}
          onSheetPageChange={handleSheetPageChange}
          bulkMode={bulkMode}
          selectedSps={selectedSps}
          onToggleSp={toggleSp}
          staggerMount={staggerMount}
          mobileToolbarSheetMode={mobileToolbarSheetMode}
          toolbarSheetKey={toolbarSheetKey}
          toolbarSheetOpen={toolbarSheetOpen}
          toolbarSheetPage={toolbarSheetPage}
          onToolbarSheetKeyChange={handleToolbarSheetKeyChange}
          onToolbarSheetPageChange={handleToolbarSheetPageChange}
          onToolbarSheetClose={handleToolbarSheetClose}
        />
      </StaleWhileRevalidateShell>
      </div>
      </SectionCard>
      <InlineStatusToast
        message={statusToast?.message ?? null}
        tone={statusToast?.tone}
        onDismiss={() => setStatusToast(null)}
      />
    </RefreshScopeShell>
  );
}
