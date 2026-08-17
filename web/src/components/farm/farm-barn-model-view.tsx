"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { BarnMapSnapshot, BarnReading } from "@/lib/data/iot";
import type {
  TrendControllerPeriodData,
  TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import { farmKeyId } from "@/lib/data/farm-key";
import {
  barnModelFarmSlots,
  buildBarnModelYard,
  cyclePlacedBarnId,
  cycleSameTypeBarnId,
  readingsForStallType,
  type BarnModelCameraShot,
} from "@/lib/farm/barn-model-layout";
import {
  clampChartScopeToType,
  type FarmChartScope,
} from "@/lib/farm/farm-chart-scope";
import { stallKeyFromReading } from "@/lib/data/reading-hierarchy";
import {
  addPlacedBarn,
  loadBarnModelPrefs,
  movePlacedBarn,
  removePlacedBarn,
  rotatePlacedBarn,
  saveBarnModelPrefs,
  subscribeBarnModelPrefs,
  updatePlacedPlan,
  type BarnModelLayoutPrefs,
} from "@/lib/farm/barn-model-prefs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import { FarmChartView } from "@/components/farm/farm-chart-view";
import {
  FarmBarnModelPalette,
  type BarnPlaceDraft,
} from "@/components/farm/farm-barn-model-layout-panel";

const FarmBarnModelCanvas = dynamic(
  () =>
    import("./farm-barn-model-canvas").then((m) => ({
      default: m.FarmBarnModelCanvas,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[48rem] animate-pulse rounded-md bg-muted/30" />
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
  alarmSettings?: AlarmSettings;
  thermoSettings?: Record<string, ControllerThermoSettings>;
  canCommand?: boolean;
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
  alarmSettings,
  thermoSettings = {},
  canCommand = false,
}: Props) {
  const [shot, setShot] = useState<BarnModelCameraShot>("roof");
  const [selectedBarnId, setSelectedBarnId] = useState<string | null>(null);
  const [editingBarnId, setEditingBarnId] = useState<string | null>(null);
  const [peekKey, setPeekKey] = useState<string | null>(null);
  const [entranceChartScope, setEntranceChartScope] = useState<FarmChartScope>({
    level: "farm",
  });
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [placing, setPlacing] = useState<BarnPlaceDraft | null>(null);
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
    [farmId],
  );

  const yard = useMemo(
    () => buildBarnModelYard(readings, prefs),
    [readings, prefs],
  );
  const farmSlots = useMemo(
    () => barnModelFarmSlots(barns, readings),
    [barns, readings],
  );

  const activeBarnId =
    selectedBarnId && prefs.placed.some((b) => b.id === selectedBarnId)
      ? selectedBarnId
      : null;
  const selected = yard.barns.find((b) => b.id === activeBarnId) ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (placing) {
        setPlacing(null);
        return;
      }
      if (editingBarnId) setEditingBarnId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placing, editingBarnId]);

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
      setSelectedBarnId(null);
      setPeekKey(null);
      setEditingBarnId(null);
      if (shot === "entrance") setShot("roof");
      return;
    }
    setSelectedBarnId(barnId);
    if (editingBarnId && editingBarnId !== barnId) setEditingBarnId(null);
  };

  const openEntrance = (barnId: string) => {
    setPlacing(null);
    setPaletteOpen(false);
    setSelectedBarnId(barnId);
    setEditingBarnId(null);
    setShot("entrance");
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

  const editBarn = (barnId: string) => {
    if (placing) return;
    if (editingBarnId === barnId) {
      setEditingBarnId(null);
      return;
    }
    setSelectedBarnId(barnId);
    setEditingBarnId(barnId);
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
    setPlacing(null);
    if (created) setSelectedBarnId(created.id);
  };

  const hint = placing
    ? `${placing.label} · 미리보기를 옮긴 뒤 클릭해 놓습니다 (Esc 취소)`
    : shot === "entrance"
      ? "입구 구도 · 오른쪽에서 이 축사 유형 차트를 봅니다. 집계에서 축사·컨트롤러를 고르고, 하단 아이콘으로 필드로 나갑니다."
      : "지붕 카드에서 현황·이력을 보고, 입구 표시로 입구를 봅니다. 우클릭하면 모델링을 편집합니다. 다시 우클릭하거나 Esc로 끝냅니다.";

  return (
    <div
      className={cn(
        "relative h-[min(92vh,72rem)] min-h-[48rem] overflow-hidden rounded-md border bg-slate-200",
        placing && shot === "roof" && "cursor-crosshair",
      )}
      onContextMenu={(e) => e.preventDefault()}
    >
      <FarmBarnModelCanvas
        yard={yard}
        shot={shot}
        selectedBarnId={activeBarnId}
        placing={Boolean(placing) && shot === "roof"}
        placingDraft={placing && shot === "roof" ? placing : null}
        onSelectBarn={selectBarn}
        onEditBarn={editBarn}
        editingBarnId={editingBarnId}
        onDeleteBarn={(barnId) => {
          onPrefsChange(removePlacedBarn(prefs, barnId));
          if (selectedBarnId === barnId) {
            setSelectedBarnId(null);
            setPeekKey(null);
          }
          if (editingBarnId === barnId) setEditingBarnId(null);
          if (shot === "entrance") setShot("roof");
        }}
        onEntranceBarn={openEntrance}
        onBackToField={() => {
          setShot("roof");
        }}
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
        onOpenController={({ barnId, controllerKey }) => {
          setSelectedBarnId(barnId);
          const reading =
            typeReadings.find((r) => r.controllerKey === controllerKey) ??
            readings.find((r) => r.controllerKey === controllerKey);
          if (!reading) return;
          applyEntranceScope({
            level: "controller",
            stallTyCode: reading.stallTyCode,
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
        onResizeBarn={(id, plan, opts) => {
          setDraft((prev) => updatePlacedPlan(prev ?? stored, id, plan, opts));
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

      {paletteOpen ? (
        <aside className={cn(HUD, "left-3")} aria-label="축사 템플릿">
          <button
            type="button"
            className="absolute top-1.5 right-1.5 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="이 농장 축사 접기"
            onClick={() => setPaletteOpen(false)}
          >
            <ChevronLeft className="size-4" strokeWidth={dashboardUi.iconStroke} />
          </button>
          <FarmBarnModelPalette
            slots={farmSlots}
            placed={prefs.placed}
            placing={placing}
            readings={readings}
            onPick={(next) => {
              setPlacing(next);
              setSelectedBarnId(null);
              setEditingBarnId(null);
              setShot("roof");
            }}
            onCancel={() => setPlacing(null)}
            onOpenPlaced={openEntrance}
          />
        </aside>
      ) : (
        <button
          type="button"
          className="pointer-events-auto absolute top-3 left-3 z-10 inline-flex h-9 items-center gap-1 rounded-xl border bg-background/90 px-2.5 text-xs font-medium shadow-sm backdrop-blur-sm hover:bg-background"
          aria-label="이 농장 축사 펼치기"
          onClick={() => setPaletteOpen(true)}
        >
          <ChevronRight className="size-4" strokeWidth={dashboardUi.iconStroke} />
          축사
        </button>
      )}

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center",
          paletteOpen ? "pl-56" : "pl-4",
          shot === "entrance" && selected && !editingBarnId
            ? "pr-[min(52vw,43rem)]"
            : "pr-4",
        )}
      >
        <p className="rounded-md bg-background/90 px-2.5 py-1 text-center text-xs text-muted-foreground shadow-sm ring-1 ring-border">
          {hint}
        </p>
      </div>

      {shot === "entrance" && selected && !editingBarnId ? (
        <aside
          className="pointer-events-auto absolute top-1/2 right-3 z-10 w-[min(52vw,42rem)] min-w-[22rem] max-h-[calc(100%-1.5rem)] -translate-y-1/2 overflow-y-auto rounded-xl border bg-background/95 p-2 shadow-sm backdrop-blur-sm"
          aria-label="축사 유형 차트"
        >
          <FarmChartView
            readings={readings}
            controllerTrendByPeriod={controllerTrendByPeriod}
            period={trendPeriod}
            onPeriodChange={onTrendPeriodChange}
            scope={entranceChartScope}
            onScopeChange={applyEntranceScope}
            alarmSettings={alarmSettings}
            thermoSettings={thermoSettings}
            canCommand={canCommand}
            embedStallTyCode={selected.stallTyCode}
            layersToolbarActive={false}
          />
        </aside>
      ) : null}

      {yard.barns.length === 0 && !placing ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-md bg-background/90 px-3 py-2 text-sm text-muted-foreground shadow-sm ring-1 ring-border">
            왼쪽에서 이 농장 축사를 골라 필드에 놓으세요
          </p>
        </div>
      ) : null}
    </div>
  );
}
