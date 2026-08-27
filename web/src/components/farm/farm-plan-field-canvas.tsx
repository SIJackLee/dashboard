"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Droplets, Thermometer } from "lucide-react";
import type { BarnModelFill } from "@/lib/farm/barn-model-dim";
import type { BarnPlanField } from "@/lib/farm/barn-plan-field";
import {
  barnPlanSatTileHref,
  type BarnPlanSatTile,
} from "@/lib/farm/barn-plan-sat-overlay";
import {
  barnPlanBanksFromWidth,
  barnPlanCameraFit,
  barnPlanCameraTagFitK,
  barnPlanCameraViewBox,
  barnPlanCameraZoomAt,
  barnPlanClampCamera,
  barnPlanFieldToLocal,
  barnPlanFillCells,
  barnPlanLocalToField,
  barnPlanRoomCountFromLength,
  barnPlanRoomsInWindow,
  barnPlanRotateDeg,
  barnPlanZoneTagNeedPx,
  BARN_PLAN_ZONE_TAG_CLEARANCE_M,
  BARN_PLAN_ZONE_TAG_GAP_M,
  type BarnPlanCamera,
  type BarnPlanFillCell,
  type BarnPlanFillPatch,
  type BarnPlanFootprint,
  type BarnPlanPlacePos,
} from "@/lib/farm/barn-plan-place";
import {
  ControllerNoMark,
  StallUnitNoMark,
} from "@/components/farm/controller-summary-parts";
import { barnSiteRoomKey } from "@/lib/farm/barn-site-types";
import type { BarnPlanRoomTone } from "@/lib/farm/barn-site-prefs";
import type {
  BarnPlanRoomEnvChannels,
  BarnPlanRoomEnvTint,
} from "@/lib/farm/barn-site-live";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

export type FarmPlanFieldPlaced = BarnPlanPlacePos &
  BarnPlanFootprint & {
    id: string;
    rotDeg: number;
    label: string;
    selected?: boolean;
    preview?: boolean;
    fill?: BarnModelFill;
    roomTones?: Record<string, BarnPlanRoomTone>;
    coverSlots?: Record<string, number>;
    /** 생성: 칸 안쪽 온도·습도 판정. */
    envMarks?: Record<string, BarnPlanRoomEnvChannels>;
    coverBoxes?: {
      x: number;
      y: number;
      w: number;
      h: number;
      slot: number;
    }[];
    /** 모델 생성: 복도를 걷고 방 격자는 유지. */
    modelCells?: BarnPlanFillCell[];
    /** 모델 생성: 동 외곽·복도·식별색 없이 방만. */
    modelView?: boolean;
    /** 연결 편집 → 모델 생성 모션(0–1). */
    modelT?: number;
  };

export type FarmPlanPickedRoom = {
  id: string;
  bank: number;
  index: number;
};

type OverlayPt = { x: number; y: number };

const ROTATE_HANDLE_OUTSET_M = 4.5;
const PLAN_ROOM_ATTR = "data-plan-room";

type ResizeKind = "banks" | "rooms";

export type FarmPlanZoneLabel = {
  id: string;
  /** 축사유형 표시명. 번호는 stallNo 아이콘. */
  label: string;
  stallNo?: string;
  eqpmnNo?: string;
  /** 컨트롤러가 없을 때(남은 방). */
  detail?: string;
  /** 생성: 이 구획 온도 경고·위험. */
  envTemp?: "warn" | "danger";
  /** 생성: 이 구획 습도 경고·위험. */
  envHumidity?: "warn" | "danger";
  x: number;
  z: number;
  /** 구획 필드 폭. 태그 최대 너비. */
  minX?: number;
  maxX?: number;
};

type Props = {
  field: BarnPlanField;
  buildings?: FarmPlanFieldPlaced[];
  selectEnabled?: boolean;
  onSelectBuilding?: (id: string) => void;
  onMoveBuilding?: (id: string, x: number, z: number) => void;
  onMoveEnd?: (id: string, x: number, z: number) => void;
  onRoomClick?: (id: string, bank: number, index: number) => void;
  onSelectRooms?: (
    rooms: FarmPlanPickedRoom[],
    at: OverlayPt | null,
  ) => void;
  onSelectBegin?: () => void;
  pickedRooms?: FarmPlanPickedRoom[];
  onRotate?: (id: string, rotDeg: number) => void;
  onRotateEnd?: (id: string, rotDeg: number) => void;
  onResizeFill?: (
    id: string,
    patch: Pick<BarnPlanFillPatch, "banks" | "roomCount">,
  ) => void;
  overlayTiles?: BarnPlanSatTile[];
  /** true면 이동·회전·리사이즈 없음. */
  layoutLocked?: boolean;
  zoneLabels?: FarmPlanZoneLabel[];
  /** 연결→생성. 0=태그 중앙, 1=구획 위(아래변 앵커). */
  labelPinT?: number;
  /** 연결→생성 모션. 0이면 1m·10m 격자 없음. */
  gridOpacity?: number;
  /** 생성: 휠·핀치 줌, 드래그 팬. */
  cameraEnabled?: boolean;
  /** 생성: 최소 줌 기준 태그 높이(m). 위아래 그룹2 간격. */
  onTagReserveM?: (heightM: number) => void;
  children?: ReactNode;
};

function pointerDist(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointsAttr(ring: { x: number; y: number }[]): string {
  return ring.map((p) => `${p.x},${p.y}`).join(" ");
}

function clipPointsAttr(
  ring: { x: number; y: number }[],
  heightM: number,
): string {
  return ring.map((p) => `${p.x},${heightM - p.y}`).join(" ");
}

function clientToField(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
  field: BarnPlanField,
): BarnPlanPlacePos | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const loc = pt.matrixTransform(ctm.inverse());
  return { x: loc.x, z: field.heightM - loc.y };
}

function fieldToOverlay(
  svg: SVGSVGElement,
  container: HTMLElement,
  field: BarnPlanField,
  x: number,
  z: number,
): OverlayPt | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = x;
  pt.y = field.heightM - z;
  const screen = pt.matrixTransform(ctm);
  const box = container.getBoundingClientRect();
  return { x: screen.x - box.left, y: screen.y - box.top };
}

function sameOverlayPts(
  a: readonly (FarmPlanZoneLabel & { x: number; y: number; maxW: number })[],
  b: readonly (FarmPlanZoneLabel & { x: number; y: number; maxW: number })[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const p = a[i]!;
    const q = b[i]!;
    if (p.id !== q.id) return false;
    if (p.envTemp !== q.envTemp) return false;
    if (p.envHumidity !== q.envHumidity) return false;
    if (Math.round(p.x) !== Math.round(q.x)) return false;
    if (Math.round(p.y) !== Math.round(q.y)) return false;
    if (Math.round(p.maxW) !== Math.round(q.maxW)) return false;
  }
  return true;
}

const COVER_CHANNEL = [
  "var(--plan-cover-0)",
  "var(--plan-cover-1)",
  "var(--plan-cover-2)",
  "var(--plan-cover-3)",
  "var(--plan-cover-4)",
  "var(--plan-cover-5)",
] as const;

function coverChannel(slot: number): string {
  return COVER_CHANNEL[((slot % COVER_CHANNEL.length) + COVER_CHANNEL.length) % COVER_CHANNEL.length]!;
}

const ROOM_ENV_INSET_M = 0.16;

function roomEnvFillClass(status: BarnPlanRoomEnvTint): string {
  if (status === "warn") return "fill-[var(--status-warn)]";
  if (status === "danger") return "fill-[var(--status-danger)]";
  return "fill-[var(--status-ok)]";
}

function roomEnvIconClass(status: "warn" | "danger"): string {
  return status === "danger"
    ? "text-[var(--status-danger)]"
    : "text-[var(--status-warn)]";
}

function envChannelAlert(
  tint: BarnPlanRoomEnvTint | null | undefined,
): "warn" | "danger" | null {
  return tint === "warn" || tint === "danger" ? tint : null;
}

function envAlertLabel(kind: "온도" | "습도", status: "warn" | "danger"): string {
  return `${kind} ${status === "danger" ? "위험" : "경고"}`;
}

function roomFill(
  tone: BarnPlanRoomTone | undefined,
  coverSlot: number | undefined,
  modelT = 0,
): string {
  if (coverSlot != null && modelT < 1) {
    const mix = Math.round(42 * (1 - modelT));
    return `color-mix(in oklch, ${coverChannel(coverSlot)} ${mix}%, transparent)`;
  }
  if (tone === "paint" || tone === "other") {
    return "color-mix(in oklch, var(--foreground) 48%, transparent)";
  }
  return "color-mix(in oklch, var(--foreground) 10%, transparent)";
}

function resizeCursor(kind: ResizeKind, rotDeg: number): string {
  const r = ((rotDeg % 180) + 180) % 180;
  const lengthAlongX = r < 45 || r >= 135;
  if (kind === "rooms") return lengthAlongX ? "ew-resize" : "ns-resize";
  return lengthAlongX ? "ns-resize" : "ew-resize";
}

function PlanEdgeHandle({
  pt,
  kind,
  rotDeg,
  label,
  onMove,
}: {
  pt: OverlayPt;
  kind: ResizeKind;
  rotDeg: number;
  label: string;
  onMove: (clientX: number, clientY: number) => void;
}) {
  const dragging = useRef(false);
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        motionClass.microInteractive,
        "absolute z-20 rounded-full border bg-card",
        kind === "banks" ? "h-2.5 w-7" : "h-7 w-2.5",
      )}
      style={{
        left: pt.x,
        top: pt.y,
        cursor: resizeCursor(kind, rotDeg),
        transform: `translate(-50%, -50%) rotate(${-rotDeg}deg)`,
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        dragging.current = true;
        (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        onMove(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        dragging.current = false;
        (e.currentTarget as HTMLButtonElement).releasePointerCapture(
          e.pointerId,
        );
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
    />
  );
}

export function FarmPlanFieldCanvas({
  field,
  buildings = [],
  selectEnabled = false,
  onSelectBuilding,
  onMoveBuilding,
  onMoveEnd,
  onRoomClick,
  onSelectRooms,
  onSelectBegin,
  pickedRooms = [],
  onRotate,
  onRotateEnd,
  onResizeFill,
  overlayTiles = [],
  layoutLocked = false,
  zoneLabels = [],
  labelPinT = 0,
  gridOpacity = 1,
  cameraEnabled = false,
  onTagReserveM,
  children,
}: Props) {
  const uid = useId().replace(/:/g, "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{
    id: string;
    dx: number;
    dz: number;
    moved: boolean;
    room: { bank: number; index: number } | null;
  } | null>(null);
  const marqueeLive = useRef<{
    x0: number;
    z0: number;
    x1: number;
    z1: number;
  } | null>(null);
  const [marquee, setMarquee] = useState<{
    x0: number;
    z0: number;
    x1: number;
    z1: number;
  } | null>(null);
  const rotateRef = useRef<{ id: string; rotDeg: number } | null>(null);
  const [userCam, setUserCam] = useState<BarnPlanCamera | null>(null);
  const [viewW, setViewW] = useState(0);
  const tagFitOn = cameraEnabled && labelPinT >= 0.98;
  const [tagFitSession, setTagFitSession] = useState(tagFitOn);
  if (tagFitSession !== tagFitOn) {
    setTagFitSession(tagFitOn);
    if (!tagFitOn && userCam != null) setUserCam(null);
  }
  const tagFitCam = useMemo(() => {
    if (!tagFitOn || viewW < 8) return null;
    const board = { widthM: field.widthM, heightM: field.heightM };
    const k = barnPlanCameraTagFitK(
      { widthM: field.widthM },
      viewW,
      zoneLabels.map((row) => ({
        widthM: Math.max(0, (row.maxX ?? row.x) - (row.minX ?? row.x)),
        needPx: barnPlanZoneTagNeedPx({
          label: row.label,
          stallNo: row.stallNo,
          eqpmnNo: row.eqpmnNo,
          envCount:
            Number(Boolean(row.envTemp)) + Number(Boolean(row.envHumidity)),
        }),
      })),
    );
    return barnPlanCameraZoomAt(
      board,
      barnPlanCameraFit(board),
      { x: field.widthM / 2, z: field.heightM / 2 },
      k,
    );
  }, [field.heightM, field.widthM, tagFitOn, viewW, zoneLabels]);
  const cam = useMemo(() => {
    const board = { widthM: field.widthM, heightM: field.heightM };
    const fit = barnPlanCameraFit(board);
    if (!cameraEnabled) return fit;
    return barnPlanClampCamera(board, userCam ?? tagFitCam ?? fit);
  }, [cameraEnabled, field.heightM, field.widthM, tagFitCam, userCam]);
  const camRef = useRef(cam);
  const fieldRef = useRef(field);
  const panRef = useRef<{
    lastX: number;
    lastY: number;
  } | null>(null);
  const pinchRef = useRef<{
    dist: number;
    k: number;
    mid: { x: number; z: number };
  } | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());

  useEffect(() => {
    camRef.current = cam;
    fieldRef.current = field;
  });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? el.clientWidth;
      setViewW((prev) => (Math.abs(prev - w) < 0.5 ? prev : w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!cameraEnabled) return;
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const svg = svgRef.current;
      const board = fieldRef.current;
      if (!svg) return;
      const at = clientToField(svg, e.clientX, e.clientY, board);
      if (!at) return;
      const factor = Math.exp(-e.deltaY * 0.0015);
      setUserCam((prev) => {
        const from = prev ?? camRef.current;
        return barnPlanCameraZoomAt(board, from, at, from.k * factor);
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [cameraEnabled]);

  const hoverRooms = useMemo(
    () => (marquee ? barnPlanRoomsInWindow(buildings, marquee) : pickedRooms),
    [buildings, marquee, pickedRooms],
  );
  const pickedKey = new Set(
    hoverRooms.map((r) => `${r.id}|${r.bank}|${r.index}`),
  );
  const pickedCount = hoverRooms.length;
  const overlayKey = overlayTiles
    .map((t) => `${t.z}/${t.x}/${t.y}`)
    .join(",");
  const [overlayReadyKey, setOverlayReadyKey] = useState<string | null>(null);
  const overlayReady = Boolean(overlayKey) && overlayReadyKey === overlayKey;
  const [anchor, setAnchor] = useState<{
    id: string;
    rotDeg: number;
    rotate: OverlayPt;
    banksTop: OverlayPt;
    banksBottom: OverlayPt;
    roomsLeft: OverlayPt;
    roomsRight: OverlayPt;
  } | null>(null);

  const selected = buildings.find((b) => b.selected) ?? null;

  const applyResize = useCallback(
    (kind: ResizeKind, clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg || !selected?.fill) return;
      const at = clientToField(svg, clientX, clientY, field);
      if (!at) return;
      const local = barnPlanFieldToLocal(selected, selected.rotDeg, at);
      if (kind === "banks") {
        const banks = barnPlanBanksFromWidth(
          selected.fill,
          Math.abs(local.y) * 2,
        );
        if (banks !== selected.fill.banks) {
          onResizeFill?.(selected.id, { banks });
        }
        return;
      }
      const roomCount = barnPlanRoomCountFromLength(
        selected.fill,
        Math.abs(local.x) * 2,
      );
      if (roomCount !== selected.fill.roomCount) {
        onResizeFill?.(selected.id, { roomCount });
      }
    },
    [field, onResizeFill, selected],
  );

  useLayoutEffect(() => {
    const svg = svgRef.current;
    const wrap = wrapRef.current;
    if (!svg || !wrap || !selected || layoutLocked) {
      setAnchor(null);
      return;
    }
    const toOverlay = (localX: number, localY: number): OverlayPt | null => {
      const fieldPt = barnPlanLocalToField(
        selected,
        selected.rotDeg,
        localX,
        localY,
      );
      return fieldToOverlay(svg, wrap, field, fieldPt.x, fieldPt.z);
    };
    const read = () => {
      const rotate = toOverlay(
        selected.lengthM / 2 + ROTATE_HANDLE_OUTSET_M,
        0,
      );
      const banksTop = toOverlay(0, selected.widthM / 2);
      const banksBottom = toOverlay(0, -selected.widthM / 2);
      const roomsLeft = toOverlay(-selected.lengthM / 2, 0);
      const roomsRight = toOverlay(selected.lengthM / 2, 0);
      if (!rotate || !banksTop || !banksBottom || !roomsLeft || !roomsRight) {
        return null;
      }
      return {
        id: selected.id,
        rotDeg: selected.rotDeg,
        rotate,
        banksTop,
        banksBottom,
        roomsLeft,
        roomsRight,
      };
    };
    const next = read();
    if (!next) {
      setAnchor(null);
      return;
    }
    setAnchor(next);
    const ro = new ResizeObserver(() => {
      const again = read();
      if (again) setAnchor(again);
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [field, layoutLocked, selected]);

  const [labelPts, setLabelPts] = useState<
    (FarmPlanZoneLabel & { x: number; y: number; maxW: number })[]
  >([]);
  useLayoutEffect(() => {
    const svg = svgRef.current;
    const wrap = wrapRef.current;
    if (!svg || !wrap || zoneLabels.length === 0) {
      setLabelPts((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const read = () =>
      zoneLabels.flatMap((row) => {
        const at = fieldToOverlay(svg, wrap, field, row.x, row.z);
        if (!at) return [];
        const minX = row.minX ?? row.x;
        const maxX = row.maxX ?? row.x;
        const left = fieldToOverlay(svg, wrap, field, minX, row.z);
        const right = fieldToOverlay(svg, wrap, field, maxX, row.z);
        const maxW =
          left && right ? Math.max(0, Math.abs(right.x - left.x)) : 0;
        return [
          {
            ...row,
            x: at.x,
            y: at.y,
            maxW,
          },
        ];
      });
    const apply = (
      next: (FarmPlanZoneLabel & { x: number; y: number; maxW: number })[],
    ) => {
      setLabelPts((prev) => (sameOverlayPts(prev, next) ? prev : next));
    };
    apply(read());
    const ro = new ResizeObserver(() => apply(read()));
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [cam.cx, cam.cz, cam.k, field, zoneLabels]);

  useLayoutEffect(() => {
    if (labelPinT < 0.98 || !onTagReserveM) return;
    const svg = svgRef.current;
    const wrap = wrapRef.current;
    if (!svg || !wrap) return;
    let px = 0;
    wrap.querySelectorAll("[data-plan-zone-tag]").forEach((node) => {
      px = Math.max(px, (node as HTMLElement).offsetHeight);
    });
    if (px < 4) return;
    const midZ = field.heightM / 2;
    const at = fieldToOverlay(svg, wrap, field, field.widthM / 2, midZ);
    const up = fieldToOverlay(svg, wrap, field, field.widthM / 2, midZ + 1);
    if (!at || !up) return;
    const ppm = Math.abs(up.y - at.y);
    if (ppm < 0.05) return;
    const tagM = (px * cam.k) / ppm;
    onTagReserveM(
      tagM * 1.2 + BARN_PLAN_ZONE_TAG_GAP_M + BARN_PLAN_ZONE_TAG_CLEARANCE_M,
    );
  }, [cam.k, field, labelPinT, labelPts, onTagReserveM]);

  const [countPt, setCountPt] = useState<OverlayPt | null>(null);
  useLayoutEffect(() => {
    const svg = svgRef.current;
    const wrap = wrapRef.current;
    if (!svg || !wrap || !marquee || pickedCount === 0) {
      setCountPt(null);
      return;
    }
    setCountPt(
      fieldToOverlay(
        svg,
        wrap,
        field,
        Math.max(marquee.x0, marquee.x1),
        Math.max(marquee.z0, marquee.z1),
      ),
    );
  }, [cam.cx, cam.cz, cam.k, field, marquee, pickedCount]);

  const vb = cameraEnabled
    ? barnPlanCameraViewBox(field, cam)
    : { x: 0, y: 0, w: field.widthM, h: field.heightM };

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 h-full w-full bg-[color:var(--surface-well)]"
      data-testid="farm-plan-field-canvas"
    >
      <svg
        ref={svgRef}
        className={cn(
          "h-full w-full touch-none",
          selectEnabled && "cursor-crosshair",
          cameraEnabled && !selectEnabled && "cursor-grab",
        )}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        xmlnsXlink="http://www.w3.org/1999/xlink"
        aria-label={`1m 격자 필드 ${field.widthM}×${field.heightM}m`}
        onPointerDownCapture={(e) => {
          if (selectEnabled) {
            const svg = svgRef.current;
            if (!svg) return;
            const at = clientToField(svg, e.clientX, e.clientY, field);
            if (!at) return;
            e.stopPropagation();
            onSelectBegin?.();
            const next = { x0: at.x, z0: at.z, x1: at.x, z1: at.z };
            marqueeLive.current = next;
            setMarquee(next);
            svg.setPointerCapture(e.pointerId);
            return;
          }
          if (!cameraEnabled) return;
          const svg = svgRef.current;
          if (!svg) return;
          pointersRef.current.set(e.pointerId, {
            x: e.clientX,
            y: e.clientY,
          });
          svg.setPointerCapture(e.pointerId);
          const pts = [...pointersRef.current.values()];
          if (pts.length >= 2) {
            panRef.current = null;
            const a = pts[0]!;
            const b = pts[1]!;
            const mid = clientToField(
              svg,
              (a.x + b.x) / 2,
              (a.y + b.y) / 2,
              field,
            );
            pinchRef.current = {
              dist: Math.max(1, pointerDist(a, b)),
              k: camRef.current.k,
              mid: mid ?? { x: camRef.current.cx, z: camRef.current.cz },
            };
            return;
          }
          pinchRef.current = null;
          panRef.current = { lastX: e.clientX, lastY: e.clientY };
        }}
        onPointerMove={(e) => {
          if (marqueeLive.current) {
            const svg = svgRef.current;
            if (!svg) return;
            const at = clientToField(svg, e.clientX, e.clientY, field);
            if (!at) return;
            const next = {
              ...marqueeLive.current,
              x1: at.x,
              z1: at.z,
            };
            marqueeLive.current = next;
            setMarquee(next);
            return;
          }
          if (cameraEnabled && pointersRef.current.has(e.pointerId)) {
            pointersRef.current.set(e.pointerId, {
              x: e.clientX,
              y: e.clientY,
            });
            const svg = svgRef.current;
            if (!svg) return;
            const pts = [...pointersRef.current.values()];
            const pinch = pinchRef.current;
            if (pinch && pts.length >= 2) {
              const dist = Math.max(1, pointerDist(pts[0]!, pts[1]!));
              setUserCam(
                barnPlanCameraZoomAt(
                  field,
                  { ...camRef.current, k: pinch.k },
                  pinch.mid,
                  pinch.k * (dist / pinch.dist),
                ),
              );
              return;
            }
            const pan = panRef.current;
            if (pan && camRef.current.k > 1.001) {
              const at0 = clientToField(svg, pan.lastX, pan.lastY, field);
              const at1 = clientToField(svg, e.clientX, e.clientY, field);
              pan.lastX = e.clientX;
              pan.lastY = e.clientY;
              if (at0 && at1) {
                setUserCam((prev) =>
                  barnPlanClampCamera(field, {
                    ...(prev ?? camRef.current),
                    cx: (prev ?? camRef.current).cx + (at0.x - at1.x),
                    cz: (prev ?? camRef.current).cz + (at0.z - at1.z),
                  }),
                );
              }
              return;
            }
          }
          const drag = dragRef.current;
          const svg = svgRef.current;
          if (!drag || !svg) return;
          const at = clientToField(svg, e.clientX, e.clientY, field);
          if (!at) return;
          drag.moved = true;
          onMoveBuilding?.(drag.id, at.x + drag.dx, at.z + drag.dz);
        }}
        onPointerUp={(e) => {
          pointersRef.current.delete(e.pointerId);
          if (pointersRef.current.size < 2) pinchRef.current = null;
          if (pointersRef.current.size === 0) panRef.current = null;
          const box = marqueeLive.current;
          if (box) {
            marqueeLive.current = null;
            setMarquee(null);
            (e.currentTarget as SVGSVGElement).releasePointerCapture(
              e.pointerId,
            );
            const thin =
              Math.abs(box.x1 - box.x0) < 0.2 && Math.abs(box.z1 - box.z0) < 0.2;
            const wrap = wrapRef.current;
            const boxPx = wrap?.getBoundingClientRect();
            const at = boxPx
              ? { x: e.clientX - boxPx.left, y: e.clientY - boxPx.top }
              : null;
            onSelectRooms?.(
              thin ? [] : barnPlanRoomsInWindow(buildings, box),
              thin ? null : at,
            );
            return;
          }
          if (cameraEnabled) {
            try {
              (e.currentTarget as SVGSVGElement).releasePointerCapture(
                e.pointerId,
              );
            } catch {
              /* already released */
            }
          }
          const drag = dragRef.current;
          const svg = svgRef.current;
          dragRef.current = null;
          if (!drag || !svg) return;
          (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
          if (!drag.moved && drag.room && onRoomClick) {
            onRoomClick(drag.id, drag.room.bank, drag.room.index);
            return;
          }
          if (!drag.moved) return;
          const at = clientToField(svg, e.clientX, e.clientY, field);
          if (!at) return;
          onMoveEnd?.(drag.id, at.x + drag.dx, at.z + drag.dz);
        }}
        onPointerCancel={() => {
          dragRef.current = null;
          marqueeLive.current = null;
          panRef.current = null;
          pinchRef.current = null;
          pointersRef.current.clear();
          setMarquee(null);
        }}
      >
        <defs>
          <pattern
            id={`${uid}-m1`}
            width={field.cellM}
            height={field.cellM}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${field.cellM} 0 L 0 0 0 ${field.cellM}`}
              fill="none"
              stroke="var(--border)"
              strokeWidth={0.04}
            />
          </pattern>
          <pattern
            id={`${uid}-m10`}
            width={10}
            height={10}
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 10 0 L 0 0 0 10"
              fill="none"
              stroke="var(--border)"
              strokeWidth={0.1}
            />
          </pattern>
          {overlayTiles.length > 0 ? (
            <clipPath id={`${uid}-lot`}>
              <polygon points={clipPointsAttr(field.ring, field.heightM)} />
            </clipPath>
          ) : null}
        </defs>
        <g
          transform={`translate(0 ${field.heightM}) scale(1 -1)`}
          opacity={Math.max(0, Math.min(1, gridOpacity))}
          pointerEvents="none"
        >
          <rect
            width={field.widthM}
            height={field.heightM}
            fill={`url(#${uid}-m1)`}
          />
          <rect
            width={field.widthM}
            height={field.heightM}
            fill={`url(#${uid}-m10)`}
          />
        </g>
        {overlayTiles.length > 0 ? (
          <g
            key={overlayKey}
            clipPath={`url(#${uid}-lot)`}
            pointerEvents="none"
            opacity={0.72}
          >
            {overlayTiles.map((tile) => {
              const href = barnPlanSatTileHref(tile.z, tile.x, tile.y);
              return (
                <image
                  key={`${tile.z}-${tile.x}-${tile.y}`}
                  href={href}
                  xlinkHref={href}
                  x={tile.svgX}
                  y={tile.svgY}
                  width={tile.widthM}
                  height={tile.heightM}
                  preserveAspectRatio="none"
                  onLoad={() => setOverlayReadyKey(overlayKey)}
                />
              );
            })}
          </g>
        ) : null}
        <g transform={`translate(0 ${field.heightM}) scale(1 -1)`}>
          {layoutLocked ? null : (
            <polygon
              points={pointsAttr(field.ring)}
              fill={
                overlayReady
                  ? "color-mix(in oklch, var(--primary) 14%, transparent)"
                  : "color-mix(in oklch, var(--primary) 38%, transparent)"
              }
              stroke="var(--primary)"
              strokeWidth={0.15}
              strokeLinejoin="round"
            />
          )}
          {buildings.map((b) => {
            const modelT = b.modelT ?? (b.modelView ? 1 : 0);
            const packed = modelT >= 0.999;
            const cells = b.modelCells ?? (b.fill ? barnPlanFillCells(b.fill) : []);
            return (
              <g
                key={b.id}
                transform={`translate(${b.x} ${b.z}) rotate(${b.rotDeg})`}
                opacity={b.preview ? 0.72 : 1}
                aria-label={b.label}
              >
                {packed ? null : (
                <rect
                  x={-b.lengthM / 2}
                  y={-b.widthM / 2}
                  width={b.lengthM}
                  height={b.widthM}
                  opacity={1 - modelT}
                  fill="color-mix(in oklch, var(--card) 70%, transparent)"
                  stroke={
                    b.selected ? "var(--primary)" : "var(--foreground)"
                  }
                  strokeWidth={b.selected ? 0.28 : 0.12}
                  strokeDasharray={b.preview ? "0.6 0.4" : undefined}
                  className={layoutLocked ? "cursor-default" : "cursor-grab"}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onSelectBuilding?.(b.id);
                    if (layoutLocked) return;
                    const svg = svgRef.current;
                    if (!svg) return;
                    const at = clientToField(svg, e.clientX, e.clientY, field);
                    if (!at) return;
                    dragRef.current = {
                      id: b.id,
                      dx: b.x - at.x,
                      dz: b.z - at.z,
                      moved: false,
                      room: null,
                    };
                    svg.setPointerCapture(e.pointerId);
                  }}
                />
                )}
                {cells.map((cell, i) => {
                  const tone =
                    !packed &&
                    cell.kind === "room" &&
                    cell.bank != null &&
                    cell.index != null
                      ? b.roomTones?.[
                          barnSiteRoomKey(cell.bank, cell.index)
                        ] ?? "empty"
                      : undefined;
                  const room =
                    cell.kind === "room" &&
                    cell.bank != null &&
                    cell.index != null
                      ? { bank: cell.bank, index: cell.index }
                      : null;
                  const coverSlot =
                    !packed && room != null
                      ? b.coverSlots?.[barnSiteRoomKey(room.bank, room.index)]
                      : undefined;
                  const picked =
                    !packed &&
                    room != null &&
                    pickedKey.has(`${b.id}|${room.bank}|${room.index}`);
                  const envMark =
                    room != null && modelT > 0.05
                      ? b.envMarks?.[barnSiteRoomKey(room.bank, room.index)]
                      : undefined;
                  const tempAlert = envChannelAlert(envMark?.temp);
                  const humidityAlert = envChannelAlert(envMark?.humidity);
                  const envOk =
                    Boolean(envMark) && !tempAlert && !humidityAlert;
                  const inset =
                    (envOk || tempAlert || humidityAlert) &&
                    cell.w > ROOM_ENV_INSET_M * 2.4 &&
                    cell.h > ROOM_ENV_INSET_M * 2.4
                      ? ROOM_ENV_INSET_M
                      : 0;
                  const ix = cell.x + inset;
                  const iy = cell.y + inset;
                  const iw = cell.w - inset * 2;
                  const ih = cell.h - inset * 2;
                  const split = Boolean(tempAlert && humidityAlert);
                  return (
                    <g key={`${cell.kind}-${i}`}>
                    <rect
                      x={cell.x}
                      y={cell.y}
                      width={cell.w}
                      height={cell.h}
                      {...(room
                        ? {
                            [PLAN_ROOM_ATTR]: `${b.id}|${room.bank}|${room.index}`,
                          }
                        : {})}
                      className="pointer-events-none"
                      fill={
                        cell.kind === "aisle"
                          ? "color-mix(in oklch, var(--foreground) 28%, transparent)"
                          : picked
                            ? "color-mix(in oklch, var(--primary) 48%, transparent)"
                            : roomFill(tone, coverSlot, modelT)
                      }
                      stroke={
                        picked
                          ? "var(--primary)"
                          : coverSlot != null
                            ? coverChannel(coverSlot)
                            : "var(--foreground)"
                      }
                      strokeWidth={picked ? 0.12 : coverSlot != null ? 0.08 : 0.06}
                      opacity={cell.kind === "aisle" ? Math.max(0, 1 - modelT) : 1}
                    />
                    {inset > 0 && envOk ? (
                      <rect
                        x={ix}
                        y={iy}
                        width={iw}
                        height={ih}
                        className={cn(
                          "pointer-events-none",
                          roomEnvFillClass("ok"),
                        )}
                        opacity={modelT * 0.85}
                      />
                    ) : null}
                    {inset > 0 && tempAlert ? (
                      <rect
                        x={ix}
                        y={iy}
                        width={split ? iw / 2 : iw}
                        height={ih}
                        className={cn(
                          "pointer-events-none",
                          roomEnvFillClass(tempAlert),
                        )}
                        opacity={modelT * 0.85}
                      />
                    ) : null}
                    {inset > 0 && humidityAlert ? (
                      <rect
                        x={split ? ix + iw / 2 : ix}
                        y={iy}
                        width={split ? iw / 2 : iw}
                        height={ih}
                        className={cn(
                          "pointer-events-none",
                          roomEnvFillClass(humidityAlert),
                        )}
                        opacity={modelT * 0.85}
                      />
                    ) : null}
                    </g>
                  );
                })}
                {packed
                  ? null
                  : (b.coverBoxes ?? []).map((box, i) => (
                  <rect
                    key={`cover-${i}`}
                    x={box.x}
                    y={box.y}
                    width={box.w}
                    height={box.h}
                    fill="none"
                    opacity={1 - modelT}
                    stroke={coverChannel(box.slot)}
                    strokeWidth={0.22}
                    className="pointer-events-none"
                  />
                ))}
              </g>
            );
          })}
          {marquee ? (
            <rect
              x={Math.min(marquee.x0, marquee.x1)}
              y={Math.min(marquee.z0, marquee.z1)}
              width={Math.abs(marquee.x1 - marquee.x0)}
              height={Math.abs(marquee.z1 - marquee.z0)}
              fill="color-mix(in oklch, var(--primary) 22%, transparent)"
              stroke="var(--primary)"
              strokeWidth={0.12}
              strokeDasharray="0.5 0.35"
              className="pointer-events-none"
            />
          ) : null}
        </g>
      </svg>
      {anchor && !layoutLocked ? (
        <>
          <PlanEdgeHandle
            pt={anchor.banksTop}
            kind="banks"
            rotDeg={anchor.rotDeg}
            label="열식"
            onMove={(clientX, clientY) => applyResize("banks", clientX, clientY)}
          />
          <PlanEdgeHandle
            pt={anchor.banksBottom}
            kind="banks"
            rotDeg={anchor.rotDeg}
            label="열식"
            onMove={(clientX, clientY) => applyResize("banks", clientX, clientY)}
          />
          <PlanEdgeHandle
            pt={anchor.roomsLeft}
            kind="rooms"
            rotDeg={anchor.rotDeg}
            label="칸 수"
            onMove={(clientX, clientY) => applyResize("rooms", clientX, clientY)}
          />
          <PlanEdgeHandle
            pt={anchor.roomsRight}
            kind="rooms"
            rotDeg={anchor.rotDeg}
            label="칸 수"
            onMove={(clientX, clientY) => applyResize("rooms", clientX, clientY)}
          />
        </>
      ) : null}
      {anchor && !layoutLocked ? (
        <button
          type="button"
          aria-label={`각도 ${anchor.rotDeg}도`}
          className={cn(
            motionClass.microInteractive,
            dashboardUi.gridCellValueCompact,
            "absolute z-20 flex h-8 min-w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-primary px-1.5 text-primary-foreground",
          )}
          style={{ left: anchor.rotate.x, top: anchor.rotate.y }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            const origin = selected;
            if (!origin) return;
            rotateRef.current = { id: origin.id, rotDeg: origin.rotDeg };
            (e.currentTarget as HTMLButtonElement).setPointerCapture(
              e.pointerId,
            );
          }}
          onPointerMove={(e) => {
            const rot = rotateRef.current;
            const svg = svgRef.current;
            if (!rot || !svg || !selected || selected.id !== rot.id) return;
            const at = clientToField(svg, e.clientX, e.clientY, field);
            if (!at) return;
            const next = barnPlanRotateDeg(selected, at);
            rot.rotDeg = next;
            onRotate?.(rot.id, next);
          }}
          onPointerUp={(e) => {
            const rot = rotateRef.current;
            rotateRef.current = null;
            (e.currentTarget as HTMLButtonElement).releasePointerCapture(
              e.pointerId,
            );
            if (!rot) return;
            onRotateEnd?.(rot.id, rot.rotDeg);
          }}
        >
          {anchor.rotDeg}°
        </button>
      ) : null}
      {labelPts.map((row) => {
        const tagTypeClass =
          "text-[length:var(--density-readout-label)] font-semibold leading-none md:text-[length:var(--density-readout-label-md)]";
        const hasNos = Boolean(row.stallNo || row.eqpmnNo);
        const pin = Math.max(0, Math.min(1, labelPinT));
        return (
          <div
            key={row.id}
            className="pointer-events-none absolute z-10"
            data-plan-zone-tag
            style={{
              left: row.x,
              top: row.y,
              transform: `translate(-50%, -${50 + 50 * pin}%)`,
              maxWidth: row.maxW > 0 ? row.maxW : undefined,
            }}
          >
            <span className="flex w-full min-w-0 flex-col items-center gap-px overflow-hidden rounded-sm bg-card px-1 py-0.5 text-center ring-1 ring-foreground/20">
              <span
                className={cn(
                  tagTypeClass,
                  "w-full min-w-0 truncate text-foreground",
                )}
              >
                {row.label}
              </span>
              {hasNos ? (
                <span className="flex max-w-full items-center justify-center gap-1 overflow-hidden text-sm text-muted-foreground">
                  {row.stallNo ? (
                    <StallUnitNoMark
                      stallNo={row.stallNo}
                      className="text-inherit"
                    />
                  ) : null}
                  {row.eqpmnNo ? (
                    <ControllerNoMark
                      eqpmnNo={row.eqpmnNo}
                      className="text-inherit"
                    />
                  ) : null}
                </span>
              ) : row.detail ? (
                <span
                  className={cn(
                    tagTypeClass,
                    "w-full truncate font-medium text-muted-foreground",
                  )}
                >
                  {row.detail}
                </span>
              ) : null}
              {row.envTemp || row.envHumidity ? (
                <span
                  className="flex items-center justify-center gap-0.5"
                  aria-label={[
                    row.envTemp ? envAlertLabel("온도", row.envTemp) : null,
                    row.envHumidity
                      ? envAlertLabel("습도", row.envHumidity)
                      : null,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                >
                  {row.envTemp ? (
                    <Thermometer
                      className={cn(
                        dashboardUi.gridCellIconDefault,
                        roomEnvIconClass(row.envTemp),
                      )}
                      aria-hidden
                    />
                  ) : null}
                  {row.envHumidity ? (
                    <Droplets
                      className={cn(
                        dashboardUi.gridCellIconDefault,
                        roomEnvIconClass(row.envHumidity),
                      )}
                      aria-hidden
                    />
                  ) : null}
                </span>
              ) : null}
            </span>
          </div>
        );
      })}
      {countPt && pickedCount > 0 ? (
        <div
          className="pointer-events-none absolute z-20 -translate-y-1/2"
          style={{ left: countPt.x + 8, top: countPt.y }}
          data-testid="farm-plan-marquee-count"
        >
          <span
            className={cn(
              dashboardUi.gridCellValueCompact,
              "rounded-sm bg-card px-1.5 py-0.5 text-foreground ring-1 ring-primary/40",
            )}
          >
            {pickedCount}개 방
          </span>
        </div>
      ) : null}
      {children}
    </div>
  );
}
