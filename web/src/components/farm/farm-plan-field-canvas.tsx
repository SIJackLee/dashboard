"use client";

import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { BarnModelFill } from "@/lib/farm/barn-model-dim";
import type { BarnPlanField } from "@/lib/farm/barn-plan-field";
import {
  barnPlanSatTileHref,
  type BarnPlanSatTile,
} from "@/lib/farm/barn-plan-sat-overlay";
import {
  barnPlanBanksFromWidth,
  barnPlanFieldToLocal,
  barnPlanFillCells,
  barnPlanLocalToField,
  barnPlanRoomCountFromLength,
  barnPlanRoomsInWindow,
  barnPlanRotateDeg,
  type BarnPlanFillPatch,
  type BarnPlanFootprint,
  type BarnPlanPlacePos,
} from "@/lib/farm/barn-plan-place";
import { barnSiteRoomKey } from "@/lib/farm/barn-site-types";
import type { BarnPlanRoomTone } from "@/lib/farm/barn-site-prefs";
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
  label: string;
  x: number;
  z: number;
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
  children?: ReactNode;
};

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

function roomFill(tone: BarnPlanRoomTone | undefined): string {
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
  const pickedKey = new Set(
    pickedRooms.map((r) => `${r.id}|${r.bank}|${r.index}`),
  );
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
    { id: string; label: string; x: number; y: number }[]
  >([]);
  useLayoutEffect(() => {
    const svg = svgRef.current;
    const wrap = wrapRef.current;
    if (!svg || !wrap || zoneLabels.length === 0) {
      setLabelPts([]);
      return;
    }
    const read = () =>
      zoneLabels.flatMap((row) => {
        const at = fieldToOverlay(svg, wrap, field, row.x, row.z);
        if (!at) return [];
        return [{ id: row.id, label: row.label, x: at.x, y: at.y }];
      });
    setLabelPts(read());
    const ro = new ResizeObserver(() => setLabelPts(read()));
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [field, zoneLabels]);

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
        )}
        viewBox={`0 0 ${field.widthM} ${field.heightM}`}
        xmlnsXlink="http://www.w3.org/1999/xlink"
        aria-label={`1m 격자 필드 ${field.widthM}×${field.heightM}m`}
        onPointerDownCapture={(e) => {
          if (!selectEnabled) return;
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
          const drag = dragRef.current;
          const svg = svgRef.current;
          if (!drag || !svg) return;
          const at = clientToField(svg, e.clientX, e.clientY, field);
          if (!at) return;
          drag.moved = true;
          onMoveBuilding?.(drag.id, at.x + drag.dx, at.z + drag.dz);
        }}
        onPointerUp={(e) => {
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
        <g transform={`translate(0 ${field.heightM}) scale(1 -1)`}>
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
            const cells = b.fill ? barnPlanFillCells(b.fill) : [];
            return (
              <g
                key={b.id}
                transform={`translate(${b.x} ${b.z}) rotate(${b.rotDeg})`}
                opacity={b.preview ? 0.72 : 1}
                aria-label={b.label}
              >
                <rect
                  x={-b.lengthM / 2}
                  y={-b.widthM / 2}
                  width={b.lengthM}
                  height={b.widthM}
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
                {cells.map((cell, i) => {
                  const tone =
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
                  const picked =
                    room != null &&
                    pickedKey.has(`${b.id}|${room.bank}|${room.index}`);
                  return (
                    <rect
                      key={`${cell.kind}-${i}`}
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
                            : roomFill(tone)
                      }
                      stroke={
                        picked ? "var(--primary)" : "var(--foreground)"
                      }
                      strokeWidth={picked ? 0.12 : 0.06}
                    />
                  );
                })}
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
      {labelPts.map((row) => (
        <div
          key={row.id}
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
          style={{ left: row.x, top: row.y }}
        >
          <span className="block max-w-[7rem] truncate rounded-sm bg-card px-1 py-0.5 text-center text-[10px] font-medium leading-tight text-foreground ring-1 ring-foreground/20">
            {row.label}
          </span>
        </div>
      ))}
      {children}
    </div>
  );
}
