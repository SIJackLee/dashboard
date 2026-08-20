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
import {
  barnPlanSatOverlayEnabled,
  loadBarnPlanPhase,
  saveBarnPlanPhase,
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
  barnPlanAssignStaggerT,
  barnPlanEmphasisT,
  barnPlanLerp,
  barnPlanLerpAngleDeg,
  barnPlanLocalToField,
  barnPlanRoomClusters,
  barnPlanDragPos,
  barnPlanFillEqual,
  barnPlanFillFromBuilding,
  barnPlanFootprint,
  barnPlanPlaceOrigin,
  barnSiteFillFromModel,
  defaultBarnPlanShellFill,
} from "@/lib/farm/barn-plan-place";
import {
  barnPlanRoomTones,
  loadBarnSitePrefs,
  moveBuilding,
  paintRoomsOnBuilding,
  removeBuilding,
  rotateBuilding,
  saveBarnSitePrefs,
  upsertShellBuilding,
  zoneRoomsForFill,
} from "@/lib/farm/barn-site-prefs";
import {
  barnSiteZoneKey,
  emptyBarnSitePrefs,
  type BarnSiteBuilding,
  type BarnSitePrefs,
} from "@/lib/farm/barn-site-types";
import {
  listLiveZones,
  liveZoneKeySet,
} from "@/lib/farm/barn-site-live";
import { useHydrationSafeDashboardCompact } from "@/components/layout/dashboard-viewport-context";
import {
  dashboardChroma,
  dashboardControl,
  dashboardElevation,
  dashboardTypography,
  dashboardUi,
} from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { motionDuration } from "@/lib/ui/motion-tokens";
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
}: {
  farmId: string;
  locations?: FarmLocationRow[];
  barns?: BarnMapSnapshot[];
  readings?: BarnReading[];
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
  const [fieldPhase, setFieldPhase] = useState<BarnPlanPhase>("place");
  const [assignMorph, setAssignMorph] = useState(0);
  const assignMorphRef = useRef(0);
  const assignAnimRef = useRef(0);
  const [assignTool, setAssignTool] = useState<"idle" | "select">("idle");
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
    const nextSite = loadBarnSitePrefs(farmId);
    const nextPhase = loadBarnPlanPhase(farmId);
    setSiteReady(true);
    setSite(nextSite);
    setFieldPhase(
      nextPhase === "assign" && nextSite.buildings.length > 0
        ? "assign"
        : "place",
    );
    const lined =
      nextPhase === "assign" && nextSite.buildings.length > 0 ? 1 : 0;
    assignMorphRef.current = lined;
    setAssignMorph(lined);
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

  const closeRing = useCallback(() => {
    if (points.length < BARN_PLAN_BOUNDARY_MIN) return;
    setClosed(true);
    persist(points, true);
  }, [persist, points]);

  const onPointsChange = useCallback(
    (next: BarnPlanLatLng[]) => {
      setPoints(next);
      if (closed) persist(next, true);
    },
    [closed, persist],
  );

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
    applyLotSelection([], lots);
    setParcelHint(lots.length > 0 ? "ready" : "idle");
  }, [applyLotSelection, lots]);

  const selectedLots = useMemo(
    () => lots.filter((lot) => selectedLotIds.includes(lot.id)),
    [lots, selectedLotIds],
  );

  const field = useMemo(
    () =>
      stage === "field" ? buildBarnPlanField(selectedLots, points) : null,
    [points, selectedLots, stage],
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
  const liveDock = useMemo(
    () =>
      liveZones.map((z) => ({
        key: barnSiteZoneKey(z.stallTyCode, z.stallNo) ?? "",
        label: `${getStallTypeName(z.stallTyCode)} ${z.stallNo}번`,
      })).filter((row) => row.key.length > 0),
    [liveZones],
  );
  const assigning = fieldPhase === "assign";
  const assignSettled = assigning && assignMorph >= 1;
  const liningUp = assignMorph > 0.001 && assignMorph < 0.999;
  const selecting = assignTool === "select";
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
  const assignLayout = useMemo(
    () => barnPlanAssignRowLayout(site.buildings),
    [site.buildings],
  );
  const canvasField = useMemo(() => {
    if (!field) return null;
    const { widthM, heightM } = assignLayout;
    const assignField = {
      ...field,
      widthM,
      heightM,
      ring: [
        { x: 0, y: 0 },
        { x: widthM, y: 0 },
        { x: widthM, y: heightM },
        { x: 0, y: heightM },
      ],
      areaM2: widthM * heightM,
    };
    if (assignMorph <= 0) return field;
    if (assignMorph >= 1) return assignField;
    const e = barnPlanEmphasisT(assignMorph);
    const w = barnPlanLerp(field.widthM, assignField.widthM, e);
    const h = barnPlanLerp(field.heightM, assignField.heightM, e);
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
  }, [assignLayout, assignMorph, field]);
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
    if (fieldPhase === "assign") return;
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
  }, [field, fieldPhase, occupiedFootprints]);

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
        selected && draftFill && !assigning
          ? draftFill
          : barnPlanFillFromBuilding(b.fill);
      const fp = barnPlanFootprint("", fill);
      const lined = assignLayout.items[b.id];
      const from = {
        x: selected && draftPos && !assigning ? draftPos.x : b.x,
        z: selected && draftPos && !assigning ? draftPos.z : b.z,
        rotDeg: selected && !assigning ? draftRot : b.rotDeg,
      };
      const ease = barnPlanEmphasisT(
        barnPlanAssignStaggerT(
          assignMorph,
          lineupOrder.get(b.id) ?? index,
          site.buildings.length,
        ),
      );
      const pos = lined
        ? {
            x: barnPlanLerp(from.x, lined.x, ease),
            z: barnPlanLerp(from.z, lined.z, ease),
            rotDeg: barnPlanLerpAngleDeg(from.rotDeg, lined.rotDeg, ease),
          }
        : from;
      return {
        id: b.id,
        x: pos.x,
        z: pos.z,
        rotDeg: pos.rotDeg,
        lengthM: fp.lengthM,
        widthM: fp.widthM,
        fill,
        label: b.name?.trim() || `${index + 1}동`,
        selected: assigning || assignMorph > 0 ? false : selected,
        preview: false,
        roomTones: barnPlanRoomTones(b.zones, b.fill, null),
      };
    });
    if (
      assignMorph <= 0 &&
      !assigning &&
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
      });
    }
    return rows;
  }, [
    assignLayout,
    assignMorph,
    assigning,
    draftFill,
    draftPos,
    draftRot,
    field,
    selectedBuildingId,
    site.buildings,
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

  const zoneLabels = useMemo(() => {
    const marks: { id: string; label: string; x: number; z: number }[] = [];
    for (const b of fieldBuildings) {
      if (!b.fill || b.id === "draft") continue;
      const siteB = site.buildings.find((row) => row.id === b.id);
      if (!siteB) continue;
      for (const z of siteB.zones) {
        const key = barnSiteZoneKey(z.stallTyCode, z.stallNo);
        if (!key) continue;
        const rooms = zoneRoomsForFill(z, siteB.fill);
        const clusters = barnPlanRoomClusters(b.fill, rooms);
        const label = `${getStallTypeName(z.stallTyCode)} ${z.stallNo}번`;
        for (const cluster of clusters) {
          const at = barnPlanLocalToField(b, b.rotDeg, cluster.x, cluster.y);
          marks.push({
            id: `${b.id}-${marks.length}`,
            label,
            x: at.x,
            z: at.z,
          });
        }
      }
    }
    return marks;
  }, [fieldBuildings, site.buildings]);

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
    } else if (fieldPhase === "assign") {
      setFieldPhase("place");
      saveBarnPlanPhase(farmId, "place");
    }
  }, [farmId, fieldPhase, selectedBuildingId, site]);

  const enterAssign = useCallback(() => {
    if (!canFinishPlace) return;
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
    setAssignTool("idle");
    setConnectOpen(false);
    setPickedRooms([]);
    setAssignCardAt(null);
    runAssignMorph(1);
  }, [canFinishPlace, farmId, runAssignMorph, selectedBuildingId, site.buildings]);

  const exitAssign = useCallback(() => {
    setFieldPhase("place");
    saveBarnPlanPhase(farmId, "place");
    setAssignTool("idle");
    setConnectOpen(false);
    setPickedRooms([]);
    setAssignCardAt(null);
    runAssignMorph(0);
  }, [farmId, runAssignMorph]);

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
      setAssignTool("select");
    },
    [farmId, liveKeys, liveZones, pickedRooms, site],
  );

  const areaLabel =
    (lots.length > 0 ? selectedLotIds.length > 0 : closed) &&
    points.length >= BARN_PLAN_BOUNDARY_MIN
      ? formatSiteAreaKo(points)
      : null;

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
      <div className="relative min-h-0 min-w-0 flex-1">
        {stage === "field" && field ? (
          <>
            <FarmPlanFieldCanvas
              field={canvasField ?? field}
            buildings={fieldBuildings}
            overlayTiles={overlayTiles}
            selectEnabled={assignSettled && selecting}
            layoutLocked={assigning || assignMorph > 0}
            pickedRooms={pickedRooms}
            onSelectBuilding={(id) => {
              if (id === "draft") return;
              selectBuilding(id);
            }}
            onSelectRooms={onSelectRooms}
            onSelectBegin={onSelectBegin}
            zoneLabels={zoneLabels}
            onMoveBuilding={
              assigning
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
              assigning
                ? undefined
                : (id) => {
                    if (!draftPos || id === "draft") return;
                    const next = moveBuilding(site, id, draftPos.x, draftPos.z);
                    setSite(next);
                    saveBarnSitePrefs(farmId, next);
                  }
            }
            onRotate={
              assigning
                ? undefined
                : (id, rotDeg) => {
                    if (id !== selectedBuildingId && id !== "draft") {
                      selectBuilding(id);
                    }
                    setDraftRot(rotDeg);
                  }
            }
            onRotateEnd={
              assigning
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
              assigning
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
                liveZones={liveDock}
                connectedKeys={connectedKeys}
                connecting={connectOpen}
                at={assignCardAt}
                onConnect={() => setConnectOpen((on) => !on)}
                onClear={() => applyPickedPaint(null)}
                onPick={(key) => applyPickedPaint(key)}
              />
            ) : null}
          </>
        ) : (
          <FarmPlanSiteMap
            key={farmId}
            layer={layer}
            center={center}
            centerZoom={centerZoom}
            points={points}
            lots={lots}
            selectedLotIds={selectedLotIds}
            closed={closed}
            kakaoAppKey={kakaoAppKey ?? null}
            onPointsChange={onPointsChange}
            onToggleLot={onToggleLot}
            onClose={closeRing}
          />
        )}

        {stage === "field" && !liningUp ? (
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
              selecting={selecting}
              onToggleSelect={() => {
                if (!assignSettled) return;
                setAssignTool((tool) => (tool === "select" ? "idle" : "select"));
              }}
            />
            {!assigning &&
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

        {stage === "field" && (assigning || assignMorph > 0) ? null : (
        <div className="absolute top-3 right-3 z-[400] flex w-[11rem] flex-col items-stretch gap-2">
          {stage === "map" ? (
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
          ) : (
            <button
              type="button"
              className={cn(
                dashboardControl.button,
                motionClass.microInteractive,
                "w-full rounded-lg border bg-card/95",
              )}
              onClick={() => setStage("map")}
            >
              지도
            </button>
          )}
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
        )}

        <div className="absolute right-3 bottom-8 z-[400] flex items-center justify-end gap-2">
          {!closed && lots.length === 0 && points.length >= BARN_PLAN_BOUNDARY_MIN ? (
            <button
              type="button"
              className={cn(
                dashboardControl.button,
                motionClass.microInteractive,
                "rounded-lg border bg-primary text-primary-foreground",
              )}
              onClick={closeRing}
            >
              닫기 ({points.length}점)
            </button>
          ) : null}
          {stage === "map" && selectedLotIds.length > 0 ? (
            <button
              type="button"
              className={cn(
                dashboardControl.button,
                motionClass.microInteractive,
                "rounded-lg border bg-primary text-primary-foreground",
              )}
              onClick={() => {
                if (buildBarnPlanField(selectedLots, points)) setStage("field");
              }}
            >
              필드로 만들기
            </button>
          ) : null}
          {stage === "map" &&
          (selectedLotIds.length > 0 ||
            (lots.length === 0 && points.length > 0)) ? (
            <button
              type="button"
              className={cn(
                dashboardControl.button,
                motionClass.microInteractive,
                "rounded-lg border bg-card/95",
              )}
              onClick={reset}
            >
              {lots.length > 0 ? "선택 해제" : "다시 그리기"}
            </button>
          ) : null}
          {stage === "field" && !assigning ? (
            <button
              type="button"
              disabled={!canFinishPlace}
              className={cn(
                dashboardControl.button,
                motionClass.microInteractive,
                "rounded-lg border bg-primary text-primary-foreground",
                "disabled:pointer-events-none disabled:opacity-40",
              )}
              onClick={enterAssign}
              data-testid="farm-plan-place-done"
            >
              배치 완료
            </button>
          ) : null}
          {stage === "field" && assigning ? (
            <button
              type="button"
              className={cn(
                dashboardControl.button,
                motionClass.microInteractive,
                "rounded-lg border bg-card/95",
              )}
              onClick={exitAssign}
              data-testid="farm-plan-place-resume"
            >
              건물 다시 배치
            </button>
          ) : null}
        </div>
      </div>

      {stage === "field" ? null : (
      <p className={cn(dashboardTypography.meta, "px-3 py-2")}>
        {parcelHint === "loading"
          ? "이 주소 구획을 불러오는 중입니다."
          : lots.length > 0
            ? selectedLotIds.length > 0
              ? `구획 ${selectedLotIds.length}개를 골랐습니다. 칸을 다시 누르면 빠집니다.`
              : "지도를 확대하고 부지 구획을 눌러 고르세요."
            : closed
              ? "경계 확정. 꼭짓점을 끌어 고칠 수 있습니다."
              : points.length < BARN_PLAN_BOUNDARY_MIN
                ? `지도를 눌러 경계를 그립니다. 닫으려면 ${BARN_PLAN_BOUNDARY_MIN}점 이상.`
                : "첫 점을 다시 누르거나 닫기를 누르면 구역이 확정됩니다."}
        {!center
          ? " 이 농장 위치가 없어 한반도 보기로 시작합니다. 설정에서 주소를 지정하면 해당 지점으로 열립니다."
          : cityOnly
            ? location && isStreetLevelAddress(locationAddressQuery(location))
              ? " 이 주소의 필지 좌표는 아직 없습니다. 지도를 옮겨 경계를 그리세요."
              : " 시·군 중심으로 열었습니다. 도로명·지번이 있으면 농장 위치로 맞춥니다."
            : parcelHint === "missing"
              ? " 구획 선을 가져오지 못했습니다. 지도를 눌러 그리세요."
              : null}
      </p>
      )}
    </div>
  );
}
