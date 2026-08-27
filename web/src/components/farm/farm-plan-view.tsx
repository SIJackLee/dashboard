"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FarmLocationRow } from "@/lib/data/farm-location-shared";
import { farmKeyEq, parseFarmKeyId } from "@/lib/data/farm-key";
import { geocodeFarmAddressAction } from "@/lib/actions/app-settings-actions";
import { lookupCadastralBoundaryAction, getKakaoJsKeyAction } from "@/lib/actions/farm-plan-actions";
import { isValidMapCoord } from "@/lib/geo/map-coords";
import {
  isStreetLevelAddress,
  locationAddressQuery,
} from "@/lib/geo/geocode-query";
import {
  BARN_PLAN_BOUNDARY_MIN,
  barnPlanRingCentroid,
  barnPlanRingFromCoords,
  formatSiteAreaKo,
  loadBarnPlanSitePrefs,
  pointInBarnPlanRing,
  saveBarnPlanSitePrefs,
  type BarnPlanLatLng,
  type BarnPlanLot,
} from "@/lib/farm/barn-plan-boundary";
import { unionBarnPlanRings } from "@/lib/farm/barn-plan-union";
import { buildBarnPlanField } from "@/lib/farm/barn-plan-field";
import { getStallTypeName } from "@/lib/data/stall-type";
import { barnPlanSatOverlayTiles } from "@/lib/farm/barn-plan-sat-overlay";
import type { AlarmSettings } from "@/lib/data/alarms";
import {
  barnPlanSatOverlayEnabled,
  loadBarnPlanEnvBandMode,
  loadBarnPlanPhase,
  saveBarnPlanEnvBandMode,
  saveBarnPlanPhase,
  type BarnPlanEnvBandMode,
  type BarnPlanPhase,
} from "@/lib/farm/barn-plan-phase";
import type { FarmPlanMapLayer } from "@/components/farm/farm-plan-site-map";
import { FarmPlanFieldCanvas } from "@/components/farm/farm-plan-field-canvas";
import {
  FarmPlanAssignCard,
  FarmPlanPlaceDock,
} from "@/components/farm/farm-plan-place-dock";
import { FarmPlanBuildingEditor } from "@/components/farm/farm-plan-building-editor";
import type { BarnMapSnapshot, BarnReading } from "@/lib/data/iot";
import type { BarnModelFill } from "@/lib/farm/barn-model-dim";
import type { BarnModelFillPatch } from "@/lib/farm/barn-model-prefs";
import {
  applyBarnPlanFillPatch,
  barnPlanAxisSpan,
  barnPlanAssignRowLayout,
  barnPlanModelRowLayout,
  barnPlanAssignStaggerT,
  barnPlanEmphasisT,
  barnPlanLerp,
  barnPlanLerpAngleDeg,
  barnPlanCellsBounds,
  barnPlanLerpModelCells,
  barnPlanLocalRectToFieldBox,
  barnPlanSpreadZoneLabels,
  barnPlanRoomBounds,
  barnPlanRoomClusters,
  barnPlanDragPos,
  barnPlanFillEqual,
  barnPlanFillFromBuilding,
  barnPlanFootprint,
  barnPlanPlaceOrigin,
  barnPlanPadField,
  barnSiteFillFromModel,
  barnPlanZoneTagReserveM,
  BARN_PLAN_ZONE_TAG_RESERVE_MAX_M,
  defaultBarnPlanShellFill,
} from "@/lib/farm/barn-plan-place";
import {
  barnPlanRoomTones,
  barnPlanCoverMarks,
  barnPlanCoverSlots,
  loadBarnSitePrefs,
  moveBuilding,
  paintControllerRoomsOnBuilding,
  paintRoomsOnBuilding,
  clearAllControllerCoversOnSite,
  clearAllZonesOnSite,
  removeBuilding,
  roomsFromCover,
  rotateBuilding,
  saveBarnSitePrefs,
  upsertShellBuilding,
  zoneOnRooms,
  zoneRoomsForFill,
} from "@/lib/farm/barn-site-prefs";
import {
  barnSiteCoverKey,
  barnSiteRoomKey,
  barnSiteZoneKey,
  emptyBarnSitePrefs,
  type BarnSiteBuilding,
  type BarnSitePrefs,
} from "@/lib/farm/barn-site-types";
import {
  listLiveControllers,
  listLiveZones,
  liveCoverKeySet,
  liveZoneKeySet,
  barnPlanRoomEnvMarks,
} from "@/lib/farm/barn-site-live";
import { formatControllerNoLabel } from "@/lib/farm/controller-summary-display";
import { useHydrationSafeDashboardCompact } from "@/components/layout/dashboard-viewport-context";
import {
  dashboardChroma,
  dashboardControl,
  dashboardElevation,
  dashboardTypography,
  dashboardUi,
} from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { motionChartAmplitude, motionDuration } from "@/lib/ui/motion-tokens";
import { cn } from "@/lib/utils";

const FarmPlanSiteMap = dynamic(
  () =>
    import("@/components/farm/farm-plan-site-map").then(
      (m) => m.FarmPlanSiteMap,
    ),
  { ssr: false },
);

const SITE_ZOOM = 18;
const CITY_ZOOM = 13;
const PLAN_OVERLAY_H =
  "h-[length:var(--density-control-h)] min-h-[length:var(--density-control-h)] md:h-[length:var(--density-control-h-md)] md:min-h-[length:var(--density-control-h-md)]";
const PLAN_OVERLAY_TEXT =
  "text-[length:var(--density-control-text)] font-medium leading-none md:text-[length:var(--density-control-text-md)]";

type PlanFlowStep = "map" | "place" | "assign" | "model";

const PLAN_FLOW: { id: PlanFlowStep; label: string }[] = [
  { id: "map", label: "지도" },
  { id: "place", label: "배치" },
  { id: "assign", label: "연결" },
  { id: "model", label: "생성" },
];

function FarmPlanFlowBar({
  step,
  busy,
  canPlace,
  canAssign,
  canModel,
  onStep,
}: {
  step: PlanFlowStep;
  busy: boolean;
  canPlace: boolean;
  canAssign: boolean;
  canModel: boolean;
  onStep: (id: PlanFlowStep) => void;
}) {
  const cur = PLAN_FLOW.findIndex((row) => row.id === step);
  const canGo: Record<PlanFlowStep, boolean> = {
    map: true,
    place: canPlace,
    assign: canAssign,
    model: canModel,
  };
  return (
    <nav
      className="flex shrink-0 items-center justify-center gap-1 border-b border-[color:var(--surface-well-border)] px-3 py-2"
      aria-label="모델 단계"
    >
      {PLAN_FLOW.map((row, i) => {
        const current = i === cur;
        const clickable = !busy && !current && canGo[row.id];
        const testId =
          row.id === "assign" && step === "place"
            ? "farm-plan-place-done"
            : row.id === "place" && (step === "assign" || step === "model")
              ? "farm-plan-place-resume"
              : row.id === "model" && step === "assign"
                ? "farm-plan-make-model"
                : row.id === "assign" && step === "model"
                  ? "farm-plan-edit-links"
                  : undefined;
        return (
          <span key={row.id} className="flex items-center gap-1">
            {i > 0 ? (
              <span className="px-0.5 text-muted-foreground" aria-hidden>
                →
              </span>
            ) : null}
            <button
              type="button"
              disabled={!current && !clickable}
              data-testid={testId}
              aria-current={current ? "step" : undefined}
              className={cn(
                dashboardControl.button,
                motionClass.microInteractive,
                "rounded-lg border",
                current
                  ? dashboardChroma.chromeSelected
                  : "border-border bg-card text-foreground",
                current ? "pointer-events-none" : null,
                !canGo[row.id] && !current ? "opacity-40" : null,
              )}
              onClick={() => onStep(row.id)}
            >
              {row.label}
            </button>
          </span>
        );
      })}
    </nav>
  );
}

function isPreciseGeocode(source: string): boolean {
  return source === "geocode_api";
}

function pickPlanLocation(
  farmId: string,
  locations: FarmLocationRow[],
): FarmLocationRow | null {
  const usable = locations.filter((loc) => isValidMapCoord(loc.lat, loc.lng));
  const key = parseFarmKeyId(farmId);
  if (key) {
    const row = usable.find((loc) => farmKeyEq(loc.farmKey, key));
    if (row) return row;
  }
  if (usable.length === 1) return usable[0]!;
  return null;
}

export function FarmPlanView({
  farmId,
  locations = [],
  readings = [],
  alarmSettings,
}: {
  farmId: string;
  locations?: FarmLocationRow[];
  barns?: BarnMapSnapshot[];
  readings?: BarnReading[];
  alarmSettings?: AlarmSettings;
}) {
  const compact = useHydrationSafeDashboardCompact();
  const [layer, setLayer] = useState<FarmPlanMapLayer>("sat");
  const [points, setPoints] = useState<BarnPlanLatLng[]>([]);
  const [lots, setLots] = useState<BarnPlanLot[]>([]);
  const [selectedLotIds, setSelectedLotIds] = useState<string[]>([]);
  const [closed, setClosed] = useState(false);
  const [center, setCenter] = useState<BarnPlanLatLng | null>(null);
  const [centerZoom, setCenterZoom] = useState(SITE_ZOOM);
  const [cityOnly, setCityOnly] = useState(false);
  const [siteReady, setSiteReady] = useState(false);
  const [parcelHint, setParcelHint] = useState<
    "idle" | "loading" | "ready" | "missing"
  >("idle");
  const [kakaoAppKey, setKakaoAppKey] = useState<string | null | undefined>(
    undefined,
  );
  const [stage, setStage] = useState<"map" | "field">("map");
  const [stageT, setStageT] = useState(0);
  const stageTRef = useRef(0);
  const stageAnimRef = useRef(0);
  const [fieldPhase, setFieldPhase] = useState<BarnPlanPhase>("place");
  const [envBandMode, setEnvBandMode] =
    useState<BarnPlanEnvBandMode>("alarm");
  const [assignMorph, setAssignMorph] = useState(0);
  const assignMorphRef = useRef(0);
  const assignAnimRef = useRef(0);
  const [modelMorph, setModelMorph] = useState(0);
  const modelMorphRef = useRef(0);
  const modelAnimRef = useRef(0);
  const [measuredTagReserveM, setMeasuredTagReserveM] = useState(
    barnPlanZoneTagReserveM,
  );
  const tagReserveM =
    modelMorph > 0.01 ? measuredTagReserveM : barnPlanZoneTagReserveM();
  const [assignTool, setAssignTool] = useState<"idle" | "barn" | "ctrl">(
    "idle",
  );
  const [connectOpen, setConnectOpen] = useState(false);
  const [pickedRooms, setPickedRooms] = useState<
    { id: string; bank: number; index: number }[]
  >([]);
  const [assignCardAt, setAssignCardAt] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const skipAutoParcelRef = useRef(false);
  const parcelTriedRef = useRef("");
  const [site, setSite] = useState<BarnSitePrefs>(emptyBarnSitePrefs);
  const [selectedBuildingId, setSelectedBuildingId] = useState<
    string | "draft" | null
  >(null);
  const [draftFill, setDraftFill] = useState<BarnModelFill | null>(null);
  const [fillBaseline, setFillBaseline] = useState<BarnModelFill | null>(null);
  const [draftPos, setDraftPos] = useState<{ x: number; z: number } | null>(
    null,
  );
  const [draftRot, setDraftRot] = useState(0);

  const location = useMemo(
    () => pickPlanLocation(farmId, locations),
    [farmId, locations],
  );

  useEffect(() => {
    let cancelled = false;
    void getKakaoJsKeyAction().then((key) => {
      if (!cancelled) setKakaoAppKey(key);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!location) {
      /* eslint-disable react-hooks/set-state-in-effect -- location reset */
      setCenter(null);
      setCityOnly(false);
      setCenterZoom(SITE_ZOOM);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    const stored = { lat: location.lat, lng: location.lng };
    const precise = isPreciseGeocode(location.geocodeSource);
    const street = isStreetLevelAddress(locationAddressQuery(location));
    setCenter(stored);
    setCityOnly(!precise);
    setCenterZoom(precise ? SITE_ZOOM : street ? 14 : CITY_ZOOM);
    if (precise) return;
    const query = locationAddressQuery(location);
    if (query.length < 4) return;
    let cancelled = false;
    void geocodeFarmAddressAction(query).then((result) => {
      if (cancelled || !result.ok) return;
      if (!isPreciseGeocode(result.geocodeSource)) return;
      setCenter({ lat: result.lat, lng: result.lng });
      setCityOnly(false);
      setCenterZoom(SITE_ZOOM);
    });
    return () => {
      cancelled = true;
    };
  }, [location]);

  useEffect(() => {
    window.cancelAnimationFrame(assignAnimRef.current);
    window.cancelAnimationFrame(modelAnimRef.current);
    window.cancelAnimationFrame(stageAnimRef.current);
    const site = loadBarnPlanSitePrefs(farmId);
    skipAutoParcelRef.current = false;
    parcelTriedRef.current = "";
    /* eslint-disable react-hooks/set-state-in-effect -- localStorage hydrate */
    setPoints(site.boundary ?? []);
    setLots([]);
    setSelectedLotIds([]);
    setClosed(Boolean(site.boundary && site.boundary.length >= BARN_PLAN_BOUNDARY_MIN));
    setLayer("sat");
    setParcelHint("idle");
    setStage("map");
    stageTRef.current = 0;
    setStageT(0);
    const nextSite = loadBarnSitePrefs(farmId);
    const nextPhase = loadBarnPlanPhase(farmId);
    setSiteReady(true);
    setSite(nextSite);
    setFieldPhase(
      (nextPhase === "assign" || nextPhase === "model") &&
        nextSite.buildings.length > 0
        ? nextPhase
        : "place",
    );
    const lined =
      (nextPhase === "assign" || nextPhase === "model") &&
      nextSite.buildings.length > 0
        ? 1
        : 0;
    assignMorphRef.current = lined;
    setAssignMorph(lined);
    const modeled = nextPhase === "model" && nextSite.buildings.length > 0 ? 1 : 0;
    modelMorphRef.current = modeled;
    setModelMorph(modeled);
    setEnvBandMode(loadBarnPlanEnvBandMode(farmId));
    setAssignTool("idle");
    setConnectOpen(false);
    setPickedRooms([]);
    setAssignCardAt(null);
    setSelectedBuildingId(null);
    setDraftFill(null);
    setFillBaseline(null);
    setDraftPos(null);
    setDraftRot(0);
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      setSiteReady(false);
      window.cancelAnimationFrame(assignAnimRef.current);
      window.cancelAnimationFrame(modelAnimRef.current);
      window.cancelAnimationFrame(stageAnimRef.current);
    };
  }, [farmId]);

  const persist = useCallback(
    (nextPoints: BarnPlanLatLng[], nextClosed: boolean) => {
      saveBarnPlanSitePrefs(farmId, {
        v: 2,
        boundary:
          nextClosed && nextPoints.length >= BARN_PLAN_BOUNDARY_MIN
            ? nextPoints
            : null,
      });
    },
    [farmId],
  );

  const onEnvBandMode = useCallback(
    (mode: BarnPlanEnvBandMode) => {
      setEnvBandMode(mode);
      saveBarnPlanEnvBandMode(farmId, mode);
    },
    [farmId],
  );

  const applyLotSelection = useCallback(
    (nextIds: string[], nextLots: BarnPlanLot[]) => {
      setSelectedLotIds(nextIds);
      const rings = nextLots
        .filter((lot) => nextIds.includes(lot.id))
        .map((lot) => lot.ring);
      if (rings.length === 0) {
        setPoints([]);
        setClosed(false);
        persist([], false);
        return;
      }
      const united =
        rings.length === 1
          ? barnPlanRingFromCoords(rings[0]!)
          : unionBarnPlanRings(rings);
      if (!united) return;
      setPoints(united);
      setClosed(true);
      persist(united, true);
    },
    [persist],
  );

  const loadParcel = useCallback(async () => {
    if (!center || cityOnly) return;
    setParcelHint("loading");
    const result = await lookupCadastralBoundaryAction(center);
    if (!result.ok) {
      setParcelHint("missing");
      return;
    }
    skipAutoParcelRef.current = false;
    setLots(result.lots);
    const saved = loadBarnPlanSitePrefs(farmId).boundary;
    if (saved && saved.length >= BARN_PLAN_BOUNDARY_MIN) {
      const matched = result.lots
        .filter((lot) => {
          const c = barnPlanRingCentroid(lot.ring);
          return c ? pointInBarnPlanRing(c, saved) : false;
        })
        .map((lot) => lot.id);
      if (matched.length > 0) applyLotSelection(matched, result.lots);
    }
    setParcelHint("ready");
  }, [applyLotSelection, center, cityOnly, farmId]);

  useEffect(() => {
    if (!siteReady || !center || cityOnly) return;
    if (skipAutoParcelRef.current) return;
    const token = `${farmId}:${center.lat.toFixed(6)}:${center.lng.toFixed(6)}`;
    if (parcelTriedRef.current === token) return;
    parcelTriedRef.current = token;
    void loadParcel();
  }, [siteReady, farmId, center, cityOnly, loadParcel]);

  const onToggleLot = useCallback(
    (id: string) => {
      const next = selectedLotIds.includes(id)
        ? selectedLotIds.filter((row) => row !== id)
        : [...selectedLotIds, id];
      applyLotSelection(next, lots);
    },
    [applyLotSelection, lots, selectedLotIds],
  );

  const reset = useCallback(() => {
    skipAutoParcelRef.current = true;
    setStage("map");
    stageTRef.current = 0;
    setStageT(0);
    applyLotSelection([], lots);
    setParcelHint(lots.length > 0 ? "ready" : "idle");
  }, [applyLotSelection, lots]);

  const selectedLots = useMemo(
    () => lots.filter((lot) => selectedLotIds.includes(lot.id)),
    [lots, selectedLotIds],
  );

  const field = useMemo(
    () => buildBarnPlanField(selectedLots, points),
    [points, selectedLots],
  );

  const overlayTiles = useMemo(
    () =>
      field && barnPlanSatOverlayEnabled(fieldPhase)
        ? barnPlanSatOverlayTiles(field)
        : [],
    [field, fieldPhase],
  );

  const liveZones = useMemo(() => listLiveZones(readings), [readings]);
  const liveKeys = useMemo(() => liveZoneKeySet(readings), [readings]);
  const liveCovers = useMemo(() => liveCoverKeySet(readings), [readings]);
  const liveDock = useMemo(
    () =>
      liveZones.map((z) => ({
        key: barnSiteZoneKey(z.stallTyCode, z.stallNo) ?? "",
        label: `${getStallTypeName(z.stallTyCode)} ${z.stallNo}번`,
      })).filter((row) => row.key.length > 0),
    [liveZones],
  );
  const assigning = fieldPhase === "assign";
  const modeling = fieldPhase === "model";
  const linedUp = assigning || modeling;
  const assignSettled = assigning && assignMorph >= 1;
  const liningUp =
    (assignMorph > 0.001 && assignMorph < 0.999) ||
    (modelMorph > 0.001 && modelMorph < 0.999) ||
    (stageT > 0.001 && stageT < 0.999);
  const selecting = assignTool === "barn" || assignTool === "ctrl";
  const snapAssignMorph = useCallback((to: number) => {
    window.cancelAnimationFrame(assignAnimRef.current);
    assignMorphRef.current = to;
    setAssignMorph(to);
  }, []);
  const snapModelMorph = useCallback((to: number) => {
    window.cancelAnimationFrame(modelAnimRef.current);
    modelMorphRef.current = to;
    setModelMorph(to);
  }, []);
  const runAssignMorph = useCallback((to: number) => {
    window.cancelAnimationFrame(assignAnimRef.current);
    const from = assignMorphRef.current;
    if (Math.abs(from - to) < 0.001) {
      assignMorphRef.current = to;
      setAssignMorph(to);
      return;
    }
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ms = reduced ? 0 : motionDuration.emphasis;
    if (ms <= 0) {
      assignMorphRef.current = to;
      setAssignMorph(to);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const u = Math.min(1, (now - start) / ms);
      const next = barnPlanLerp(from, to, u);
      assignMorphRef.current = next;
      setAssignMorph(next);
      if (u < 1) assignAnimRef.current = window.requestAnimationFrame(step);
    };
    assignAnimRef.current = window.requestAnimationFrame(step);
  }, []);
  const runModelMorph = useCallback((to: number) => {
    window.cancelAnimationFrame(modelAnimRef.current);
    const from = modelMorphRef.current;
    if (Math.abs(from - to) < 0.001) {
      modelMorphRef.current = to;
      setModelMorph(to);
      return;
    }
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ms = reduced ? 0 : motionDuration.emphasis;
    if (ms <= 0) {
      modelMorphRef.current = to;
      setModelMorph(to);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const u = Math.min(1, (now - start) / ms);
      const next = barnPlanLerp(from, to, u);
      modelMorphRef.current = next;
      setModelMorph(next);
      if (u < 1) modelAnimRef.current = window.requestAnimationFrame(step);
    };
    modelAnimRef.current = window.requestAnimationFrame(step);
  }, []);
  const runStageMorph = useCallback((to: number) => {
    window.cancelAnimationFrame(stageAnimRef.current);
    const from = stageTRef.current;
    if (Math.abs(from - to) < 0.001) {
      stageTRef.current = to;
      setStageT(to);
      return;
    }
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ms = reduced ? 0 : motionDuration.emphasis;
    if (ms <= 0) {
      stageTRef.current = to;
      setStageT(to);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const u = Math.min(1, (now - start) / ms);
      const next = barnPlanLerp(from, to, u);
      stageTRef.current = next;
      setStageT(next);
      if (u < 1) stageAnimRef.current = window.requestAnimationFrame(step);
    };
    stageAnimRef.current = window.requestAnimationFrame(step);
  }, []);
  const assignLayout = useMemo(
    () => barnPlanAssignRowLayout(site.buildings),
    [site.buildings],
  );
  const modelLayout = useMemo(
    () =>
      barnPlanModelRowLayout(
        site.buildings.map((b) => ({
          id: b.id,
          fill: b.fill,
          x: b.x,
          covers: barnPlanCoverMarks(b.controllerCovers ?? [], b.fill),
        })),
        undefined,
        tagReserveM,
      ),
    [site.buildings, tagReserveM],
  );
  const onTagReserveM = useCallback((heightM: number) => {
    const next = Math.min(
      BARN_PLAN_ZONE_TAG_RESERVE_MAX_M,
      Math.max(barnPlanZoneTagReserveM(), heightM),
    );
    setMeasuredTagReserveM((prev) => (next > prev + 0.1 ? next : prev));
  }, []);
  const modelWell = useMemo(() => {
    const e = barnPlanEmphasisT(modelMorph);
    if (e <= 0) return { padX: 0, padZ: 0 };
    const well = barnPlanPadField(modelLayout);
    return { padX: well.padX * e, padZ: well.padZ * e };
  }, [modelLayout, modelMorph]);
  const canvasField = useMemo(() => {
    if (!field) return null;
    const { widthM, heightM } = assignLayout;
    if (assignMorph <= 0 && modelWell.padX <= 0 && modelWell.padZ <= 0) {
      return field;
    }
    let w = field.widthM;
    let h = field.heightM;
    if (assignMorph >= 1) {
      const u = barnPlanEmphasisT(modelMorph);
      w = barnPlanLerp(assignLayout.widthM, modelLayout.widthM, u);
      h = barnPlanLerp(assignLayout.heightM, modelLayout.heightM, u);
    } else if (assignMorph > 0) {
      const e = barnPlanEmphasisT(assignMorph);
      w = barnPlanLerp(field.widthM, widthM, e);
      h = barnPlanLerp(field.heightM, heightM, e);
    }
    w += 2 * modelWell.padX;
    h += 2 * modelWell.padZ;
    return {
      ...field,
      widthM: w,
      heightM: h,
      ring: [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: h },
        { x: 0, y: h },
      ],
      areaM2: w * h,
    };
  }, [assignLayout, assignMorph, field, modelLayout, modelMorph, modelWell]);
  const canFinishPlace =
    site.buildings.length > 0 && selectedBuildingId !== "draft";

  const occupiedFootprints = useCallback(
    (exceptId?: string | null) =>
      site.buildings
        .filter((b) => b.id !== exceptId)
        .map((b) => {
          const fill = barnPlanFillFromBuilding(b.fill);
          const fp = barnPlanFootprint("", fill);
          return {
            x: b.x,
            z: b.z,
            ...barnPlanAxisSpan(fp, b.rotDeg),
          };
        }),
    [site.buildings],
  );

  const startNewBuilding = useCallback(() => {
    if (linedUp) return;
    const fill = defaultBarnPlanShellFill();
    setSelectedBuildingId("draft");
    setDraftFill(fill);
    setFillBaseline(fill);
    setDraftRot(0);
    if (!field) {
      setDraftPos(null);
      return;
    }
    setDraftPos(
      barnPlanPlaceOrigin(field, barnPlanFootprint("", fill), occupiedFootprints()),
    );
  }, [field, linedUp, occupiedFootprints]);

  const selectBuilding = useCallback(
    (id: string) => {
      const building = site.buildings.find((b) => b.id === id);
      if (!building) return;
      const fill = barnPlanFillFromBuilding(building.fill);
      setSelectedBuildingId(id);
      setDraftFill(fill);
      setFillBaseline(fill);
      setDraftPos({ x: building.x, z: building.z });
      setDraftRot(building.rotDeg);
    },
    [site.buildings],
  );

  const selectedBuilding: BarnSiteBuilding | null = useMemo(() => {
    if (!selectedBuildingId || selectedBuildingId === "draft") return null;
    return site.buildings.find((b) => b.id === selectedBuildingId) ?? null;
  }, [selectedBuildingId, site.buildings]);

  const placedSelected = Boolean(selectedBuilding);

  useEffect(() => {
    if (stage !== "field" || !field || draftPos || !draftFill) return;
    /* eslint-disable react-hooks/set-state-in-effect -- 필드가 늦게 준비되면 임시 위치 */
    if (selectedBuilding) {
      setDraftPos({ x: selectedBuilding.x, z: selectedBuilding.z });
      return;
    }
    if (selectedBuildingId !== "draft") return;
    setDraftPos(
      barnPlanPlaceOrigin(
        field,
        barnPlanFootprint("", draftFill),
        occupiedFootprints(),
      ),
    );
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [
    draftFill,
    draftPos,
    field,
    occupiedFootprints,
    selectedBuilding,
    selectedBuildingId,
    stage,
  ]);

  const fieldBuildings = useMemo(() => {
    if (!field) return [];
    const lineupOrder = new Map(
      [...site.buildings]
        .sort((a, b) => a.x - b.x)
        .map((row, i) => [row.id, i]),
    );
    const rows = site.buildings.map((b, index) => {
      const selected = b.id === selectedBuildingId;
      const fill =
        selected && draftFill && !linedUp
          ? draftFill
          : barnPlanFillFromBuilding(b.fill);
      const fp = barnPlanFootprint("", fill);
      const lined = assignLayout.items[b.id];
      const packedPos = modelLayout.items[b.id];
      const from = {
        x: selected && draftPos && !linedUp ? draftPos.x : b.x,
        z: selected && draftPos && !linedUp ? draftPos.z : b.z,
        rotDeg: selected && !linedUp ? draftRot : b.rotDeg,
      };
      const ease = barnPlanEmphasisT(
        barnPlanAssignStaggerT(
          assignMorph,
          lineupOrder.get(b.id) ?? index,
          site.buildings.length,
        ),
      );
      const linedPos = lined
        ? {
            x: barnPlanLerp(from.x, lined.x, ease),
            z: barnPlanLerp(from.z, lined.z, ease),
            rotDeg: barnPlanLerpAngleDeg(from.rotDeg, lined.rotDeg, ease),
          }
        : from;
      const modelEase = barnPlanEmphasisT(modelMorph);
      const pos =
        packedPos && modelEase > 0
          ? {
              x: barnPlanLerp(linedPos.x, packedPos.x, modelEase),
              z: barnPlanLerp(linedPos.z, packedPos.z, modelEase),
              rotDeg: barnPlanLerpAngleDeg(
                linedPos.rotDeg,
                packedPos.rotDeg,
                modelEase,
              ),
            }
          : linedPos;
      const coverMarks = barnPlanCoverMarks(b.controllerCovers ?? [], b.fill);
      const packing = modeling || modelMorph > 0.001;
      const packed = modelMorph >= 0.999;
      const modelCells = packing
        ? barnPlanLerpModelCells(fill, coverMarks, modelMorph, tagReserveM)
        : undefined;
      return {
        id: b.id,
        x: pos.x + modelWell.padX,
        z: pos.z + modelWell.padZ,
        rotDeg: pos.rotDeg,
        lengthM: fp.lengthM,
        widthM: fp.widthM,
        fill,
        label: b.name?.trim() || `${index + 1}동`,
        selected: linedUp || assignMorph > 0 ? false : selected,
        preview: false,
        roomTones: packed ? {} : barnPlanRoomTones(b.zones, b.fill, null),
        coverSlots: packed ? undefined : barnPlanCoverSlots(coverMarks),
        envMarks: packing
          ? barnPlanRoomEnvMarks(coverMarks, readings, {
              mode: envBandMode,
              alarmSettings,
            })
          : undefined,
        coverBoxes: packed
          ? []
          : coverMarks.flatMap((mark) => {
              const bounds = barnPlanRoomBounds(fill, mark.rooms);
              return bounds ? [{ ...bounds, slot: mark.slot }] : [];
            }),
        ...(modelCells ? { modelCells } : {}),
        ...(packing ? { modelView: true, modelT: modelMorph } : {}),
      };
    });
    if (
      assignMorph <= 0 &&
      !linedUp &&
      selectedBuildingId === "draft" &&
      draftFill &&
      draftPos
    ) {
      const fp = barnPlanFootprint("", draftFill);
      rows.push({
        id: "draft",
        x: draftPos.x,
        z: draftPos.z,
        rotDeg: draftRot,
        lengthM: fp.lengthM,
        widthM: fp.widthM,
        fill: draftFill,
        label: "새 건물",
        selected: true,
        preview: true,
        roomTones: {},
        coverSlots: undefined,
        envMarks: undefined,
        coverBoxes: [],
      });
    }
    return rows;
  }, [
    assignLayout,
    assignMorph,
    linedUp,
    modeling,
    modelLayout,
    modelMorph,
    modelWell,
    draftFill,
    draftPos,
    draftRot,
    field,
    selectedBuildingId,
    site.buildings,
    tagReserveM,
    readings,
    envBandMode,
    alarmSettings,
  ]);

  const connectedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const b of site.buildings) {
      for (const z of b.zones) {
        const key = barnSiteZoneKey(z.stallTyCode, z.stallNo);
        if (key) keys.add(key);
      }
    }
    return keys;
  }, [site.buildings]);

  const pickedBuilding = useMemo(() => {
    const first = pickedRooms[0];
    if (!first || first.id === "draft") return null;
    return site.buildings.find((b) => b.id === first.id) ?? null;
  }, [pickedRooms, site.buildings]);

  const pickedZone = useMemo(
    () =>
      pickedBuilding
        ? zoneOnRooms(
            pickedBuilding,
            pickedRooms.map((row) => ({ bank: row.bank, index: row.index })),
          )
        : null,
    [pickedBuilding, pickedRooms],
  );

  const ctrlDock = useMemo(() => {
    if (!pickedZone) return [];
    return listLiveControllers(
      readings,
      pickedZone.stallTyCode,
      pickedZone.stallNo,
    ).map((row) => ({
      key: barnSiteCoverKey(row.stallTyCode, row.stallNo, row.eqpmnNo) ?? "",
      label: formatControllerNoLabel(row.eqpmnNo),
    })).filter((row) => row.key.length > 0);
  }, [pickedZone, readings]);

  const connectedCtrlKeys = useMemo(() => {
    const keys = new Set<string>();
    if (!pickedBuilding) return keys;
    const pickedSet = new Set(
      pickedRooms.map((row) => barnSiteRoomKey(row.bank, row.index)),
    );
    for (const cover of pickedBuilding.controllerCovers ?? []) {
      const hit = roomsFromCover(cover, pickedBuilding.fill).some((room) =>
        pickedSet.has(barnSiteRoomKey(room.bank, room.index)),
      );
      if (!hit) continue;
      const key = barnSiteCoverKey(
        cover.stallTyCode,
        cover.stallNo,
        cover.eqpmnNo,
      );
      if (key) keys.add(key);
    }
    return keys;
  }, [pickedBuilding, pickedRooms]);

  const zoneLabels = useMemo(() => {
    const seeds: {
      id: string;
      label: string;
      stallNo?: string;
      eqpmnNo?: string;
      detail?: string;
      envTemp?: "warn" | "danger";
      envHumidity?: "warn" | "danger";
      box: {
        minX: number;
        maxX: number;
        minZ: number;
        maxZ: number;
      };
      group: string;
      order?: string;
    }[] = [];
    for (const b of fieldBuildings) {
      if (!b.fill || b.id === "draft") continue;
      const siteB = site.buildings.find((row) => row.id === b.id);
      if (!siteB) continue;
      const usedRooms = new Set<string>();
      const toBox = (bounds: { x: number; y: number; w: number; h: number }) =>
        barnPlanLocalRectToFieldBox(b, b.rotDeg, bounds);
      for (const cover of barnPlanCoverMarks(
        siteB.controllerCovers ?? [],
        siteB.fill,
      )) {
        const bounds = b.modelCells
          ? barnPlanCellsBounds(b.modelCells, cover.rooms)
          : barnPlanRoomBounds(b.fill, cover.rooms);
        if (!bounds) continue;
        for (const room of cover.rooms) {
          usedRooms.add(barnSiteRoomKey(room.bank, room.index));
        }
        const first = cover.rooms[0];
        const mark =
          first != null
            ? b.envMarks?.[barnSiteRoomKey(first.bank, first.index)]
            : undefined;
        seeds.push({
          id: `${b.id}-c-${cover.eqpmnNo}`,
          label: getStallTypeName(cover.stallTyCode),
          stallNo: cover.stallNo,
          eqpmnNo: cover.eqpmnNo,
          envTemp:
            mark?.temp === "warn" || mark?.temp === "danger"
              ? mark.temp
              : undefined,
          envHumidity:
            mark?.humidity === "warn" || mark?.humidity === "danger"
              ? mark.humidity
              : undefined,
          box: toBox(bounds),
          group: b.id,
          order: cover.eqpmnNo,
        });
      }
      for (const z of siteB.zones) {
        const key = barnSiteZoneKey(z.stallTyCode, z.stallNo);
        if (!key) continue;
        const leftover = zoneRoomsForFill(z, siteB.fill).filter(
          (room) => !usedRooms.has(barnSiteRoomKey(room.bank, room.index)),
        );
        if (leftover.length === 0) continue;
        const clusters = barnPlanRoomClusters(b.fill, leftover);
        const typeName = getStallTypeName(z.stallTyCode);
        for (const cluster of clusters) {
          const bounds = b.modelCells
            ? barnPlanCellsBounds(b.modelCells, cluster.rooms)
            : barnPlanRoomBounds(b.fill, cluster.rooms);
          if (!bounds) continue;
          seeds.push({
            id: `${b.id}-${seeds.length}`,
            label: typeName,
            stallNo: z.stallNo,
            detail: `${cluster.rooms.length}개 방`,
            box: toBox(bounds),
            group: b.id,
            order: z.stallNo,
          });
        }
      }
    }
    const board = canvasField ?? field;
    if (!board) return [];
    const inside = barnPlanSpreadZoneLabels(
      seeds.map((seed) => ({ ...seed, outside: false })),
      board,
    );
    const outside = barnPlanSpreadZoneLabels(
      seeds.map((seed) => ({
        id: seed.id,
        label: seed.label,
        detail: seed.detail,
        box: seed.box,
        outside: true,
      })),
      board,
    );
    const t = barnPlanEmphasisT(modelMorph);
    return seeds.map((seed, i) => {
      const from = inside[i]!;
      const to = outside[i]!;
      return {
        id: seed.id,
        label: seed.label,
        stallNo: seed.stallNo,
        eqpmnNo: seed.eqpmnNo,
        detail: seed.detail,
        envTemp: seed.envTemp,
        envHumidity: seed.envHumidity,
        x: barnPlanLerp(from.x, to.x, t),
        z: barnPlanLerp(from.z, to.z, t),
        minX: seed.box.minX,
        maxX: seed.box.maxX,
      };
    });
  }, [canvasField, field, fieldBuildings, modelMorph, site.buildings]);

  const onFillChange = useCallback(
    (patch: BarnModelFillPatch) => {
      if (!draftFill) return;
      setDraftFill(applyBarnPlanFillPatch(draftFill, "", patch));
    },
    [draftFill],
  );

  const onPlace = useCallback(() => {
    if (!field || !draftFill) return;
    const fp = barnPlanFootprint("", draftFill);
    const existing =
      selectedBuildingId && selectedBuildingId !== "draft"
        ? site.buildings.find((b) => b.id === selectedBuildingId)
        : undefined;
    const exceptId = existing ? existing.id : undefined;
    const raw =
      draftPos ??
      (existing
        ? { x: existing.x, z: existing.z }
        : barnPlanPlaceOrigin(field, fp, occupiedFootprints(exceptId)));
    const pos = barnPlanDragPos(field, raw, fp, draftRot) ?? raw;
    const next = upsertShellBuilding(site, {
      id: existing?.id,
      name: existing?.name,
      fill: barnSiteFillFromModel(draftFill),
      x: pos.x,
      z: pos.z,
      rotDeg: draftRot,
    });
    setSite(next.site);
    saveBarnSitePrefs(farmId, next.site);
    setSelectedBuildingId(next.buildingId);
    setFillBaseline(draftFill);
    setDraftPos(pos);
  }, [
    draftFill,
    draftPos,
    farmId,
    field,
    occupiedFootprints,
    selectedBuildingId,
    site,
    draftRot,
  ]);

  const onDeleteBuilding = useCallback(() => {
    if (!selectedBuildingId || selectedBuildingId === "draft") return;
    const next = removeBuilding(site, selectedBuildingId);
    setSite(next);
    saveBarnSitePrefs(farmId, next);
    setSelectedBuildingId(null);
    setDraftFill(null);
    setFillBaseline(null);
    setDraftPos(null);
    setDraftRot(0);
    if (next.buildings.length > 0) {
      const first = next.buildings[0]!;
      const fill = barnPlanFillFromBuilding(first.fill);
      setSelectedBuildingId(first.id);
      setDraftFill(fill);
      setFillBaseline(fill);
      setDraftPos({ x: first.x, z: first.z });
      setDraftRot(first.rotDeg);
    } else if (linedUp) {
      setFieldPhase("place");
      saveBarnPlanPhase(farmId, "place");
    }
  }, [farmId, linedUp, selectedBuildingId, site]);

  const canGenerateModel = useMemo(
    () =>
      site.buildings.some((b) => (b.controllerCovers?.length ?? 0) > 0),
    [site.buildings],
  );

  const onSelectRooms = useCallback(
    (
      rooms: { id: string; bank: number; index: number }[],
      at: { x: number; y: number } | null,
    ) => {
      if (!assigning || !selecting || assignMorph < 1) return;
      setPickedRooms(rooms);
      setConnectOpen(false);
      setAssignCardAt(rooms.length > 0 && at ? at : null);
    },
    [assigning, assignMorph, selecting],
  );

  const onSelectBegin = useCallback(() => {
    setConnectOpen(false);
    setAssignCardAt(null);
  }, []);

  const applyPickedPaint = useCallback(
    (key: string | null) => {
      const first = pickedRooms[0];
      if (!first || first.id === "draft") return;
      const paint =
        key == null
          ? null
          : (liveZones.find(
              (z) => barnSiteZoneKey(z.stallTyCode, z.stallNo) === key,
            ) ?? null);
      if (key != null && !paint) return;
      const result = paintRoomsOnBuilding(
        site,
        first.id,
        pickedRooms.map((r) => ({ bank: r.bank, index: r.index })),
        paint ? { stallTyCode: paint.stallTyCode, stallNo: paint.stallNo } : null,
        liveKeys,
      );
      if (!result.ok) return;
      setSite(result.site);
      saveBarnSitePrefs(farmId, result.site);
      setPickedRooms([]);
      setAssignCardAt(null);
      setConnectOpen(false);
      setAssignTool("barn");
    },
    [farmId, liveKeys, liveZones, pickedRooms, site],
  );

  const applyPickedCtrl = useCallback(
    (key: string | null) => {
      const first = pickedRooms[0];
      if (!first || first.id === "draft") return;
      const eqpmnNo =
        key == null ? null : key.slice(key.lastIndexOf(":") + 1);
      if (key != null && !eqpmnNo) return;
      const result = paintControllerRoomsOnBuilding(
        site,
        first.id,
        pickedRooms.map((r) => ({ bank: r.bank, index: r.index })),
        eqpmnNo ? { eqpmnNo } : null,
        liveCovers,
      );
      if (!result.ok) return;
      setSite(result.site);
      saveBarnSitePrefs(farmId, result.site);
      setPickedRooms([]);
      setAssignCardAt(null);
      setConnectOpen(false);
      setAssignTool("ctrl");
    },
    [farmId, liveCovers, pickedRooms, site],
  );

  const canClearBarn = useMemo(
    () => site.buildings.some((b) => b.zones.length > 0),
    [site.buildings],
  );
  const canClearCtrl = useMemo(
    () => site.buildings.some((b) => (b.controllerCovers?.length ?? 0) > 0),
    [site.buildings],
  );

  const clearPickedUi = useCallback(() => {
    setPickedRooms([]);
    setAssignCardAt(null);
    setConnectOpen(false);
  }, []);

  const onClearAllBarn = useCallback(() => {
    if (!canClearBarn) return;
    const next = clearAllZonesOnSite(site);
    setSite(next);
    saveBarnSitePrefs(farmId, next);
    clearPickedUi();
  }, [canClearBarn, clearPickedUi, farmId, site]);

  const onClearAllCtrl = useCallback(() => {
    if (!canClearCtrl) return;
    const next = clearAllControllerCoversOnSite(site);
    setSite(next);
    saveBarnSitePrefs(farmId, next);
    clearPickedUi();
  }, [canClearCtrl, clearPickedUi, farmId, site]);

  const areaLabel =
    (lots.length > 0 ? selectedLotIds.length > 0 : closed) &&
    points.length >= BARN_PLAN_BOUNDARY_MIN
      ? formatSiteAreaKo(points)
      : null;

  const flowStep: PlanFlowStep =
    stage === "map"
      ? "map"
      : modeling
        ? "model"
        : linedUp
          ? "assign"
          : "place";

  const onFlowStep = useCallback(
    (id: PlanFlowStep) => {
      if (liningUp) return;
      const here: PlanFlowStep =
        stage === "map"
          ? "map"
          : modeling
            ? "model"
            : linedUp
              ? "assign"
              : "place";
      if (id === here) return;
      if (id === "place" && !field && !buildBarnPlanField(selectedLots, points)) {
        return;
      }
      if (id === "assign" && !canFinishPlace) return;
      if (id === "model" && !canGenerateModel) return;

      const clearAssignUi = () => {
        setAssignTool("idle");
        setConnectOpen(false);
        setPickedRooms([]);
        setAssignCardAt(null);
      };

      if (id === "map") {
        setStage("map");
        runStageMorph(0);
        return;
      }

      const fromMap = stage === "map";
      setStage("field");
      if (fromMap) runStageMorph(1);

      if (id === "place") {
        setFieldPhase("place");
        saveBarnPlanPhase(farmId, "place");
        clearAssignUi();
        if (fromMap) {
          snapModelMorph(0);
          snapAssignMorph(0);
        } else {
          runModelMorph(0);
          runAssignMorph(0);
        }
        return;
      }

      if (id === "assign") {
        if (selectedBuildingId && selectedBuildingId !== "draft") {
          const building = site.buildings.find((b) => b.id === selectedBuildingId);
          if (building) {
            const fill = barnPlanFillFromBuilding(building.fill);
            setDraftFill(fill);
            setFillBaseline(fill);
            setDraftPos({ x: building.x, z: building.z });
            setDraftRot(building.rotDeg);
          }
        }
        setFieldPhase("assign");
        saveBarnPlanPhase(farmId, "assign");
        clearAssignUi();
        if (fromMap) {
          snapModelMorph(0);
          snapAssignMorph(1);
        } else {
          runModelMorph(0);
          runAssignMorph(1);
        }
        return;
      }

      setFieldPhase("model");
      saveBarnPlanPhase(farmId, "model");
      clearAssignUi();
      if (fromMap) {
        snapAssignMorph(1);
        snapModelMorph(1);
      } else {
        runAssignMorph(1);
        runModelMorph(1);
      }
    },
    [
      canFinishPlace,
      canGenerateModel,
      farmId,
      field,
      linedUp,
      liningUp,
      modeling,
      points,
      runAssignMorph,
      runModelMorph,
      runStageMorph,
      selectedBuildingId,
      selectedLots,
      site.buildings,
      snapAssignMorph,
      snapModelMorph,
      stage,
    ],
  );

  const mapFieldE = barnPlanEmphasisT(stageT);
  const mapOpacity = 1 - mapFieldE;
  const fieldScale = barnPlanLerp(
    motionChartAmplitude.scaleFrom,
    1,
    mapFieldE,
  );

  return (
    <div
      className={cn(
        dashboardElevation.well,
        "relative flex w-full flex-none flex-col overflow-hidden",
        compact
          ? "h-[calc(var(--mobile-preview-frame-h,100dvh)-12rem)] min-h-[22rem]"
          : "h-[calc(100dvh-11rem)] min-h-[28rem]",
      )}
      data-testid="farm-plan-view"
      data-plan-field-phase={stage === "field" ? fieldPhase : undefined}
    >
      <FarmPlanFlowBar
        step={flowStep}
        busy={liningUp}
        canPlace={Boolean(field)}
        canAssign={canFinishPlace}
        canModel={canGenerateModel}
        onStep={onFlowStep}
      />
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <div
          className="absolute inset-0 z-0"
          style={{
            opacity: mapOpacity,
            pointerEvents: mapFieldE > 0.45 ? "none" : "auto",
          }}
        >
          <FarmPlanSiteMap
            key={farmId}
            active={stage === "map"}
            layer={layer}
            center={center}
            centerZoom={centerZoom}
            points={points}
            lots={lots}
            selectedLotIds={selectedLotIds}
            closed={closed}
            kakaoAppKey={kakaoAppKey ?? null}
            onToggleLot={onToggleLot}
          />
        </div>
        {field && (stage === "field" || stageT > 0.001) ? (
          <div
            className="absolute inset-0 z-[1] origin-center"
            style={{
              opacity: mapFieldE,
              transform: `scale(${fieldScale})`,
              pointerEvents: mapFieldE < 0.55 ? "none" : "auto",
            }}
          >
            <FarmPlanFieldCanvas
              field={canvasField ?? field}
            buildings={fieldBuildings}
            overlayTiles={overlayTiles}
            selectEnabled={assignSettled && selecting}
            layoutLocked={linedUp || assignMorph > 0 || liningUp}
            pickedRooms={pickedRooms}
            onSelectBuilding={(id) => {
              if (id === "draft") return;
              selectBuilding(id);
            }}
            onSelectRooms={onSelectRooms}
            onSelectBegin={onSelectBegin}
            zoneLabels={zoneLabels}
            labelPinT={barnPlanEmphasisT(modelMorph)}
            onTagReserveM={onTagReserveM}
            gridOpacity={1 - modelMorph}
            cameraEnabled={modeling || modelMorph > 0.45}
            onMoveBuilding={
              linedUp
                ? undefined
                : (id, x, z) => {
                    const model =
                      (id === selectedBuildingId || id === "draft") &&
                      draftFill
                        ? draftFill
                        : barnPlanFillFromBuilding(
                            site.buildings.find((row) => row.id === id)?.fill,
                          );
                    const rot =
                      id === "draft" || id === selectedBuildingId
                        ? draftRot
                        : site.buildings.find((row) => row.id === id)?.rotDeg ??
                          0;
                    const next = barnPlanDragPos(
                      field,
                      { x, z },
                      barnPlanFootprint("", model),
                      rot,
                    );
                    if (!next) return;
                    if (id !== selectedBuildingId && id !== "draft") {
                      selectBuilding(id);
                    }
                    setDraftPos(next);
                  }
            }
            onMoveEnd={
              linedUp
                ? undefined
                : (id) => {
                    if (!draftPos || id === "draft") return;
                    const next = moveBuilding(site, id, draftPos.x, draftPos.z);
                    setSite(next);
                    saveBarnSitePrefs(farmId, next);
                  }
            }
            onRotate={
              linedUp
                ? undefined
                : (id, rotDeg) => {
                    if (id !== selectedBuildingId && id !== "draft") {
                      selectBuilding(id);
                    }
                    setDraftRot(rotDeg);
                  }
            }
            onRotateEnd={
              linedUp
                ? undefined
                : (id, rotDeg) => {
                    setDraftRot(rotDeg);
                    if (id === "draft") return;
                    const next = rotateBuilding(site, id, rotDeg);
                    setSite(next);
                    saveBarnSitePrefs(farmId, next);
                  }
            }
            onResizeFill={
              linedUp
                ? undefined
                : (id, patch) => {
                    if (id !== selectedBuildingId && id !== "draft") {
                      selectBuilding(id);
                    }
                    onFillChange(patch);
                  }
            }
            />
            {assignSettled && pickedRooms.length > 0 && assignCardAt ? (
              <FarmPlanAssignCard
                liveZones={assignTool === "ctrl" ? ctrlDock : liveDock}
                connectedKeys={
                  assignTool === "ctrl" ? connectedCtrlKeys : connectedKeys
                }
                connecting={connectOpen}
                at={assignCardAt}
                pickedCount={pickedRooms.length}
                listTitle={
                  assignTool === "ctrl" ? "이 축사 컨트롤러" : "이 농장 축사"
                }
                emptyText={
                  assignTool === "ctrl"
                    ? pickedZone
                      ? "붙일 컨트롤러가 없습니다."
                      : "이 방에 연결된 축사가 없습니다."
                    : "붙일 축사가 없습니다."
                }
                onConnect={() => setConnectOpen((on) => !on)}
                onClear={() =>
                  assignTool === "ctrl"
                    ? applyPickedCtrl(null)
                    : applyPickedPaint(null)
                }
                onPick={(key) =>
                  assignTool === "ctrl"
                    ? applyPickedCtrl(key)
                    : applyPickedPaint(key)
                }
              />
            ) : null}
          </div>
        ) : null}

        {stage === "field" && !liningUp && !modeling ? (
          <div className="absolute top-3 left-3 z-[400] flex items-start gap-2">
            <FarmPlanPlaceDock
              buildings={site.buildings.map((b, index) => ({
                id: b.id,
                label: b.name?.trim() || `${index + 1}동`,
              }))}
              selectedBuildingId={selectedBuildingId}
              onSelectBuilding={selectBuilding}
              onNewBuilding={startNewBuilding}
              mode={assignSettled ? "assign" : "place"}
              assignTool={assignTool}
              canClearBarn={canClearBarn}
              canClearCtrl={canClearCtrl}
              onClearBarn={onClearAllBarn}
              onClearCtrl={onClearAllCtrl}
              onAssignTool={(tool) => {
                if (!assignSettled) return;
                setAssignTool(tool);
                setConnectOpen(false);
                setPickedRooms([]);
                setAssignCardAt(null);
              }}
            />
            {!linedUp &&
            assignMorph <= 0 &&
            draftFill &&
            draftPos &&
            selectedBuildingId ? (
              <FarmPlanBuildingEditor
                fill={draftFill}
                dirty={Boolean(
                  fillBaseline &&
                    !barnPlanFillEqual(draftFill, fillBaseline),
                )}
                placed={placedSelected}
                onFillChange={onFillChange}
                onRevert={() => {
                  if (fillBaseline) setDraftFill(fillBaseline);
                }}
                onPlace={onPlace}
                onDelete={onDeleteBuilding}
              />
            ) : null}
          </div>
        ) : null}

        {stageT < 0.45 ? (
        <div className="absolute top-3 right-3 z-[400] flex w-[11rem] flex-col items-stretch gap-2">
          <div
            className={cn(
              PLAN_OVERLAY_H,
              "flex gap-0.5 rounded-lg border bg-card/95 p-0.5",
            )}
          >
            {(
              [
                ["sat", "위성"],
                ["map", "지도"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={cn(
                  PLAN_OVERLAY_TEXT,
                  motionClass.microInteractive,
                  "inline-flex min-w-0 flex-1 items-center justify-center rounded-md px-2",
                  layer === id
                    ? dashboardChroma.chromeSelected
                    : "bg-transparent text-muted-foreground",
                )}
                aria-pressed={layer === id}
                onClick={() => setLayer(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {areaLabel ? (
            <p
              className={cn(
                PLAN_OVERLAY_H,
                dashboardElevation.overlay,
                dashboardUi.gridCellValueCompact,
                "flex items-center justify-center px-3",
              )}
            >
              {areaLabel}
            </p>
          ) : null}
        </div>
        ) : null}

        {modeling || modelMorph > 0.45 ? (
          <div className="absolute top-3 right-3 z-[400] flex w-[11rem] flex-col items-stretch gap-2">
            <div
              className={cn(
                PLAN_OVERLAY_H,
                "flex gap-0.5 rounded-lg border bg-card/95 p-0.5",
              )}
              role="group"
              aria-label="칸 색 기준"
            >
              {(
                [
                  ["alarm", "알람"],
                  ["recommend", "권장"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={cn(
                    PLAN_OVERLAY_TEXT,
                    motionClass.microInteractive,
                    "inline-flex min-w-0 flex-1 items-center justify-center rounded-md px-2",
                    envBandMode === id
                      ? dashboardChroma.chromeSelected
                      : "bg-transparent text-muted-foreground",
                  )}
                  aria-pressed={envBandMode === id}
                  onClick={() => onEnvBandMode(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {stageT < 0.45 && selectedLotIds.length > 0 ? (
        <div className="absolute right-3 bottom-3 z-[400] flex items-center justify-end gap-2">
          <button
            type="button"
            className={cn(
              dashboardControl.button,
              motionClass.microInteractive,
              "rounded-lg border bg-card/95",
            )}
            onClick={reset}
          >
            선택 해제
          </button>
        </div>
        ) : null}
      </div>

      {stageT > 0.35 ? null : (
      <p className={cn(dashboardTypography.meta, "px-3 py-2")}>
        {parcelHint === "loading"
          ? "이 주소 구획을 불러오는 중입니다."
          : lots.length > 0
            ? selectedLotIds.length > 0
              ? `구획 ${selectedLotIds.length}개를 골랐습니다. 칸을 다시 누르면 빠집니다.`
              : "지도를 확대하고 부지 구획을 눌러 고르세요."
            : closed
              ? "저장한 경계를 표시합니다. 구획이 보이면 눌러 다시 고를 수 있습니다."
              : "지도를 확대하고 부지 구획을 눌러 고르세요."}
        {!center
          ? " 이 농장 위치가 없어 한반도 보기로 시작합니다. 설정에서 주소를 지정하면 해당 지점으로 열립니다."
          : cityOnly
            ? location && isStreetLevelAddress(locationAddressQuery(location))
              ? " 이 주소의 필지 좌표는 아직 없습니다. 설정에서 도로명·지번을 확인하세요."
              : " 시·군 중심으로 열었습니다. 도로명·지번이 있으면 농장 위치로 맞춥니다."
            : parcelHint === "missing"
              ? " 구획 선을 가져오지 못했습니다. 주소를 확인한 뒤 다시 열어 주세요."
              : null}
      </p>
      )}
    </div>
  );
}
