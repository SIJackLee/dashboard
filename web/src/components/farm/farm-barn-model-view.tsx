"use client";

import { useCallback, useEffect, useMemo, useReducer, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { BarnMapSnapshot, BarnReading } from "@/lib/data/iot";
import type {
  TrendControllerPeriodData,
  TrendPeriodId,
  TrendWindow15m,
} from "@/lib/data/farm-trend-types";
import { farmKeyId } from "@/lib/data/farm-key";
import {
  barnModelFarmSlots,
  buildBarnModelYard,
  cyclePlacedBarnId,
  cycleSameTypeBarnId,
  readingsForStallType,
} from "@/lib/farm/barn-model-layout";
import {
  BARN_MODEL_VIEW_INIT,
  barnModelEntranceSettled,
  barnModelFieldTrendTy,
  barnModelFillEditId,
  barnModelMobileChartReady,
  barnModelPlacing,
  barnModelRoofFocusId,
  barnModelShot,
  barnModelYardEditing,
  reduceBarnModelView,
} from "@/lib/farm/barn-model-mode";
import {
  clampChartScopeToType,
  type FarmChartScope,
} from "@/lib/farm/farm-chart-scope";
import { stallKeyFromReading } from "@/lib/data/reading-hierarchy";
import {
  addPlacedBarn,
  clonePlacedBarn,
  loadBarnModelPrefs,
  movePlacedBarn,
  placedFillSessionEqual,
  removePlacedBarn,
  restorePlacedBarn,
  rotatePlacedBarn,
  saveBarnModelPrefs,
  subscribeBarnModelPrefs,
  updatePlacedFill,
  updatePlacedShell,
  type BarnModelLayoutPrefs,
  type BarnModelPlacedBarn,
} from "@/lib/farm/barn-model-prefs";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import { useHydrationSafeDashboardCompact } from "@/components/layout/dashboard-viewport-context";
import { FarmChartView } from "@/components/farm/farm-chart-view";
import { FarmBarnModelPalette } from "@/components/farm/farm-barn-model-layout-panel";
import {
  FarmBarnModelMobileSheet,
  type BarnModelMobileSheetPage,
} from "@/components/farm/farm-barn-model-mobile-sheet";

const FarmBarnModelCanvas = dynamic(
  () =>
    import("./farm-barn-model-canvas").then((m) => ({
      default: m.FarmBarnModelCanvas,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full min-h-[12rem] animate-pulse rounded-md bg-muted/30" />
    ),
  },
);

type Props = {
  barns: BarnMapSnapshot[];
  readings: BarnReading[];
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  trendPeriod?: TrendPeriodId;
  onTrendPeriodChange?: (period: TrendPeriodId) => void;
  trendLoading?: boolean;
  trendStale?: boolean;
  window15m?: TrendWindow15m | null;
  trendExtending?: boolean;
  window15mLoading?: boolean;
  onNeedWindow15m?: (fromMs: number, toMs: number) => void;
  alarmSettings?: AlarmSettings;
  thermoSettings?: Record<string, ControllerThermoSettings>;
  canCommand?: boolean;
  /** 보고 있는 동의 축사유형 — 델린 뱃지 맥락. 없으면 농장 전체. */
  onAdviceStallTyChange?: (stallTyCode: string | null) => void;
};

const HUD =
  "pointer-events-auto absolute top-3 bottom-3 z-10 w-52 overflow-y-auto rounded-xl border bg-background/90 p-2 pr-8 shadow-sm backdrop-blur-sm md:w-56";

export function FarmBarnModelView({
  barns,
  readings,
  controllerTrendByPeriod = null,
  trendPeriod = "24h",
  onTrendPeriodChange,
  trendLoading = false,
  trendStale = false,
  window15m = null,
  trendExtending = false,
  window15mLoading = false,
  onNeedWindow15m,
  alarmSettings,
  thermoSettings = {},
  canCommand = false,
  onAdviceStallTyChange,
}: Props) {
  const [ui, dispatch] = useReducer(reduceBarnModelView, BARN_MODEL_VIEW_INIT);
  const compact = useHydrationSafeDashboardCompact();
  const { mode, selectedBarnId, paletteOpen } = ui;
  const shot = barnModelShot(mode);
  const yardEditing = barnModelYardEditing(mode);
  const placing = barnModelPlacing(mode);
  const roofFocusId = barnModelRoofFocusId(mode);
  const fillEditId = barnModelFillEditId(mode);
  const fieldTrendTy = barnModelFieldTrendTy(mode);
  const entranceSettled = barnModelEntranceSettled(mode);
  const [fillSnap, setFillSnap] = useState<BarnModelPlacedBarn | null>(null);
  const [peekKey, setPeekKey] = useState<string | null>(null);
  const [entranceChartScope, setEntranceChartScope] = useState<FarmChartScope>({
    level: "farm",
  });
  const farmId =
    barns[0]?.meta.farmKey
      ? farmKeyId(barns[0].meta.farmKey)
      : readings[0]?.farmKey
        ? farmKeyId(readings[0].farmKey)
        : "local";
  const stored = useSyncExternalStore(
    subscribeBarnModelPrefs,
    () => loadBarnModelPrefs(farmId),
    () => loadBarnModelPrefs(""),
  );
  const [draft, setDraft] = useState<BarnModelLayoutPrefs | null>(null);
  const prefs = draft ?? stored;

  const onPrefsChange = useCallback(
    (next: BarnModelLayoutPrefs) => {
      setDraft(null);
      saveBarnModelPrefs(farmId, next);
    },
    [farmId, setDraft],
  );

  const closeFillEdit = useCallback(() => {
    setFillSnap(null);
    dispatch({ type: "setFillEdit", barnId: null });
  }, [setFillSnap]);

  const fillCur = fillEditId
    ? prefs.placed.find((b) => b.id === fillEditId)
    : null;
  const fillEditDirty = Boolean(
    fillEditId &&
      fillSnap &&
      fillCur &&
      fillSnap.id === fillCur.id &&
      !placedFillSessionEqual(fillSnap, fillCur),
  );

  const yard = useMemo(
    () => buildBarnModelYard(readings, prefs),
    [readings, prefs],
  );
  const farmSlots = useMemo(
    () => barnModelFarmSlots(barns, readings),
    [barns, readings],
  );
  const chartReady = barnModelMobileChartReady(mode);
  const [sheetPeek, setSheetPeek] = useState(false);
  const [sheetPage, setSheetPage] =
    useState<BarnModelMobileSheetPage>("palette");
  const [sheetChartWasReady, setSheetChartWasReady] = useState(false);
  const [sheetWasPlacing, setSheetWasPlacing] = useState(false);
  const [sheetWasEmpty, setSheetWasEmpty] = useState(true);
  const placingNow = Boolean(placing);
  const emptyNow = yard.barns.length === 0;
  if (compact) {
    if (placingNow !== sheetWasPlacing) {
      setSheetWasPlacing(placingNow);
      if (placingNow) {
        setSheetPeek(true);
        setSheetPage("palette");
      }
    }
    if (chartReady !== sheetChartWasReady) {
      setSheetChartWasReady(chartReady);
      if (chartReady) {
        setSheetPage("chart");
        setSheetPeek(false);
      } else {
        setSheetPage("palette");
      }
    }
    if (emptyNow !== sheetWasEmpty) {
      setSheetWasEmpty(emptyNow);
      if (emptyNow && !placingNow) {
        setSheetPeek(false);
        setSheetPage("palette");
      } else if (!emptyNow && !chartReady && !placingNow) {
        setSheetPeek(true);
      }
    }
  }

  const activeBarnId =
    selectedBarnId && prefs.placed.some((b) => b.id === selectedBarnId)
      ? selectedBarnId
      : null;
  const selected = yard.barns.find((b) => b.id === activeBarnId) ?? null;

  useEffect(() => {
    onAdviceStallTyChange?.(selected?.stallTyCode ?? null);
    return () => onAdviceStallTyChange?.(null);
  }, [selected?.stallTyCode, onAdviceStallTyChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      dispatch({ type: "escape" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const typeReadings = useMemo(() => {
    if (!activeBarnId) return [];
    const placed = prefs.placed.find((b) => b.id === activeBarnId);
    if (!placed) return [];
    return readingsForStallType(placed.stallTyCode, readings);
  }, [activeBarnId, prefs.placed, readings]);

  const effectivePeek =
    peekKey && typeReadings.some((r) => r.controllerKey === peekKey)
      ? peekKey
      : (typeReadings[0]?.controllerKey ?? selected?.controllerKey ?? null);

  const applyEntranceScope = (next: FarmChartScope) => {
    const ty = selected?.stallTyCode;
    const clamped = ty ? clampChartScopeToType(next, ty) : next;
    setEntranceChartScope(clamped);
    if (clamped.level === "controller") setPeekKey(clamped.controllerKey);
  };

  const selectBarn = (barnId: string) => {
    if (placing) return;
    if (!barnId) {
      dispatch({ type: "selectBarn", barnId: null });
      setPeekKey(null);
      return;
    }
    dispatch({ type: "selectBarn", barnId });
  };

  const openEntrance = (barnId: string) => {
    dispatch({ type: "openEntrance", barnId });
    const barn = prefs.placed.find((b) => b.id === barnId);
    if (barn) {
      setEntranceChartScope({
        level: "sp",
        stallTyCode: barn.stallTyCode,
      });
    }
  };

  const goPlacedBarn = (dir: 1 | -1, sameType = false) => {
    if (!activeBarnId) return;
    const nextId = sameType
      ? cycleSameTypeBarnId(prefs.placed, activeBarnId, dir)
      : cyclePlacedBarnId(prefs.placed, activeBarnId, dir);
    if (nextId) openEntrance(nextId);
  };

  const toggleYardEdit = () => {
    dispatch({ type: "toggleEdit" });
  };

  const focusPlacedBarn = (fromId: string, dir: 1 | -1) => {
    const nextId = cyclePlacedBarnId(prefs.placed, fromId, dir);
    if (!nextId || nextId === fromId) return;
    dispatch({ type: "focusBarn", barnId: nextId });
  };

  const openFieldTrend = (barnId: string) => {
    const barn = prefs.placed.find((b) => b.id === barnId);
    if (!barn) return;
    dispatch({
      type: "toggleTrend",
      barnId,
      stallTyCode: barn.stallTyCode,
    });
    setEntranceChartScope({
      level: "sp",
      stallTyCode: barn.stallTyCode,
    });
  };

  const placeAt = (x: number, z: number) => {
    if (!placing) return;
    const next = addPlacedBarn(prefs, {
      stallTyCode: placing.stallTyCode,
      stallNo: placing.stallNo,
      plan: placing.plan,
      x,
      z,
    });
    const created = next.placed[next.placed.length - 1];
    onPrefsChange(next);
    if (created) dispatch({ type: "placed", barnId: created.id });
    else dispatch({ type: "cancelPlacing" });
  };

  const hint = placing
    ? `${placing.label} · 미리보기를 옮긴 뒤 클릭해 놓습니다 (Esc 취소)`
    : shot === "entrance"
      ? "입구 구도 · 오른쪽에서 이 축사 유형 차트를 봅니다. 집계에서 축사·컨트롤러를 고르고, 카드의 격자 아이콘으로 전체 보기로 나갑니다."
      : yardEditing
        ? "전체 보기에서 축사를 옮기고 돌립니다. 방 편집을 열면 그 동으로 줌인하고, 되돌리기로 방 값을 복구합니다. 편집 끝 또는 Esc로 나갑니다."
        : "지붕 카드에서 통합추이를 보고, 입구 표시로 입구를 봅니다. ‹ ›로 다른 동으로 이동합니다. 편집으로 모든 축사 크기·위치를 조절합니다.";

  const showPcChart =
    !compact &&
    ((shot === "entrance" && selected && entranceSettled) ||
      (shot === "roof" && !yardEditing && fieldTrendTy));

  const chartEmbed = (
    <FarmChartView
      readings={readings}
      controllerTrendByPeriod={controllerTrendByPeriod}
      period={trendPeriod}
      onPeriodChange={onTrendPeriodChange}
      trendLoading={trendLoading}
      trendExtending={trendExtending}
      window15mLoading={window15mLoading}
      window15m={window15m}
      onNeedWindow15m={onNeedWindow15m}
      scope={entranceChartScope}
      onScopeChange={applyEntranceScope}
      alarmSettings={alarmSettings}
      thermoSettings={thermoSettings}
      canCommand={canCommand}
      embedStallTyCode={
        shot === "entrance" ? selected?.stallTyCode : fieldTrendTy ?? undefined
      }
      layersToolbarActive={false}
      isMobileStack={compact}
    />
  );

  const palette = (
    <FarmBarnModelPalette
      slots={farmSlots}
      placed={prefs.placed}
      placing={placing}
      readings={readings}
      onPick={(next) => {
        dispatch({ type: "startPlacing", draft: next });
      }}
      onCancel={() => dispatch({ type: "cancelPlacing" })}
      onOpenPlaced={openEntrance}
    />
  );

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border bg-slate-200",
        compact
          ? "h-[calc(var(--mobile-preview-frame-h,100dvh)-10.5rem)] min-h-[16rem]"
          : "h-[min(92vh,72rem)] min-h-[48rem]",
        placing && "cursor-crosshair",
      )}
      onContextMenu={(e) => e.preventDefault()}
    >
      <FarmBarnModelCanvas
        yard={yard}
        shot={shot}
        selectedBarnId={activeBarnId}
        roofFocusId={roofFocusId}
        onRoofFocusClear={() => dispatch({ type: "clearRoofFocus" })}
        onCycleTypeBarn={focusPlacedBarn}
        onOpenTrend={openFieldTrend}
        fillEditDirty={fillEditDirty}
        onFillEditOpenChange={(barnId, open) => {
          if (compact) return;
          if (!open) {
            if (fillEditId === barnId) closeFillEdit();
            return;
          }
          const barn = prefs.placed.find((b) => b.id === barnId);
          if (!barn) return;
          setFillSnap(clonePlacedBarn(barn));
          dispatch({ type: "setFillEdit", barnId });
        }}
        onFillEditRevert={() => {
          const snap = fillSnap;
          if (!snap || snap.id !== fillEditId) return;
          onPrefsChange(restorePlacedBarn(prefs, snap));
        }}
        placing={Boolean(placing)}
        placingDraft={placing}
        compactHud={compact}
        yardEditing={yardEditing && !compact}
        fillEditId={compact ? null : fillEditId}
        onSelectBarn={selectBarn}
        onDeleteBarn={(barnId) => {
          onPrefsChange(removePlacedBarn(prefs, barnId));
          if (selectedBarnId === barnId) setPeekKey(null);
          dispatch({ type: "deleteBarn", barnId });
        }}
        onEntranceBarn={openEntrance}
        onBackToField={() => dispatch({ type: "backToField" })}
        onPrevBarn={() => goPlacedBarn(-1)}
        onNextBarn={() => goPlacedBarn(1)}
        onCycleType={() => goPlacedBarn(1, true)}
        onPeekControllers={() => {
          if (!selected) return;
          applyEntranceScope({
            level: "stall",
            stallTyCode: selected.stallTyCode,
            stallNo: selected.stallNo,
          });
        }}
        highlightControllerKey={
          entranceChartScope.level === "controller"
            ? entranceChartScope.controllerKey
            : null
        }
        onEntranceArrived={() => dispatch({ type: "entranceArrived" })}
        onOpenController={({ barnId, controllerKey }) => {
          dispatch({ type: "selectBarn", barnId });
          const reading =
            typeReadings.find((r) => r.controllerKey === controllerKey) ??
            readings.find((r) => r.controllerKey === controllerKey);
          if (!reading) return;
          const stallTyCode =
            reading.stallTyCode ?? selected?.stallTyCode ?? "";
          if (!stallTyCode) return;
          applyEntranceScope({
            level: "controller",
            stallTyCode,
            stallNo: stallKeyFromReading(reading),
            controllerKey,
          });
        }}
        readings={readings}
        peekKey={effectivePeek}
        onPeekKeyChange={setPeekKey}
        liveTrend={{
          controllerTrendByPeriod,
          trendPeriod,
          onTrendPeriodChange,
          trendLoading,
          trendStale,
          alarmSettings,
          thermoSettings,
        }}
        onPlaceAt={placeAt}
        onMoveBarn={(id, x, z) => {
          setDraft((prev) => movePlacedBarn(prev ?? stored, id, x, z));
        }}
        onRotateBarn={(id, deg) => {
          setDraft((prev) => rotatePlacedBarn(prev ?? stored, id, deg));
        }}
        onSetBarnShell={(id, axis, meters) => {
          onPrefsChange(updatePlacedShell(prefs, id, axis, meters));
        }}
        onSetBarnFill={(id, patch) => {
          onPrefsChange(updatePlacedFill(prefs, id, patch));
        }}
        onMoveBarnEnd={() => {
          setDraft((prev) => {
            if (prev) {
              const snapshot = prev;
              queueMicrotask(() => saveBarnModelPrefs(farmId, snapshot));
            }
            return null;
          });
        }}
      />

      {compact ? (
        <>
          {placing ? (
            <div className="pointer-events-auto absolute inset-x-12 top-3 z-10 flex justify-center">
              <button
                type="button"
                className="rounded-md bg-background/90 px-2.5 py-1 text-center text-xs text-foreground ring-1 ring-border"
                onClick={() => dispatch({ type: "cancelPlacing" })}
              >
                {placing.label} · 마당을 탭해 놓습니다 (취소)
              </button>
            </div>
          ) : null}
          {yard.barns.length === 0 && !placing ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="rounded-md bg-background/90 px-3 py-2 text-sm text-muted-foreground ring-1 ring-border">
                아래에서 이 농장 축사를 골라 마당에 놓으세요
              </p>
            </div>
          ) : null}
          <FarmBarnModelMobileSheet
            peek={sheetPeek}
            onPeek={() => setSheetPeek(true)}
            onExpand={() => setSheetPeek(false)}
            page={sheetPage}
            onPageChange={setSheetPage}
            chartReady={chartReady}
            palette={palette}
            chart={
              chartReady ? (
                chartEmbed
              ) : (
                <p className="px-0.5 py-2 text-sm text-muted-foreground">
                  지붕 카드의 추이 또는 입구에서 유형 차트를 엽니다
                </p>
              )
            }
          />
        </>
      ) : (
        <>
          {paletteOpen ? (
            <aside className={cn(HUD, "left-3")} aria-label="축사 템플릿">
              <button
                type="button"
                className="absolute top-1.5 right-1.5 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="이 농장 축사 접기"
                onClick={() => dispatch({ type: "setPaletteOpen", open: false })}
              >
                <ChevronLeft className="size-4" strokeWidth={dashboardUi.iconStroke} />
              </button>
              {palette}
            </aside>
          ) : (
            <button
              type="button"
              className="pointer-events-auto absolute top-3 left-3 z-10 inline-flex h-9 items-center gap-1 rounded-xl border bg-background/90 px-2.5 text-xs font-medium shadow-sm backdrop-blur-sm hover:bg-background"
              aria-label="이 농장 축사 펼치기"
              onClick={() => dispatch({ type: "setPaletteOpen", open: true })}
            >
              <ChevronRight className="size-4" strokeWidth={dashboardUi.iconStroke} />
              축사
            </button>
          )}

          {shot === "roof" ? (
            <button
              type="button"
              className={cn(
                "pointer-events-auto absolute top-3 z-10 inline-flex h-9 items-center gap-1 rounded-xl border px-2.5 text-xs font-medium shadow-sm backdrop-blur-sm",
                paletteOpen ? "left-[15.5rem]" : "left-[5.75rem]",
                yardEditing
                  ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-background/90 hover:bg-background",
              )}
              aria-pressed={yardEditing}
              aria-label={yardEditing ? "편집 끝내기" : "축사 편집"}
              onClick={toggleYardEdit}
            >
              <Pencil className="size-3.5" strokeWidth={dashboardUi.iconStroke} />
              {yardEditing ? "편집 끝" : "편집"}
            </button>
          ) : null}

          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center",
              paletteOpen ? "pl-56" : "pl-36",
              showPcChart ? "pr-[min(52vw,43rem)]" : "pr-4",
            )}
          >
            <p className="rounded-md bg-background/90 px-2.5 py-1 text-center text-xs text-muted-foreground shadow-sm ring-1 ring-border">
              {hint}
            </p>
          </div>

          {showPcChart ? (
            <aside
              className="pointer-events-auto absolute top-1/2 right-3 z-10 w-[min(52vw,42rem)] min-w-[22rem] max-h-[calc(100%-1.5rem)] -translate-y-1/2 overflow-y-auto rounded-xl border bg-background/95 p-2 shadow-sm backdrop-blur-sm"
              aria-label="축사 유형 차트"
            >
              {chartEmbed}
            </aside>
          ) : null}

          {yard.barns.length === 0 && !placing ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="rounded-md bg-background/90 px-3 py-2 text-sm text-muted-foreground shadow-sm ring-1 ring-border">
                왼쪽에서 이 농장 축사를 골라 마당에 놓으세요
              </p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
