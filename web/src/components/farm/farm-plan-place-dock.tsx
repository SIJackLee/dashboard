"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  dashboardChroma,
  dashboardElevation,
  dashboardTypography,
} from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

export type FarmPlanDockBuilding = {
  id: string;
  label: string;
};

export type FarmPlanDockLive = {
  key: string;
  label: string;
};

const ASSIGN_BTN =
  "inline-flex h-8 w-full items-center justify-center rounded-md px-2.5 text-xs font-medium leading-none";
const ASSIGN_ROW =
  "w-full truncate rounded-md px-2 py-1.5 text-left text-xs font-medium leading-snug";

export function FarmPlanPlaceDock({
  buildings,
  selectedBuildingId,
  onSelectBuilding,
  onNewBuilding,
  mode = "place",
  assignTool = "idle",
  onAssignTool,
  canClearBarn = false,
  canClearCtrl = false,
  onClearBarn,
  onClearCtrl,
  variant = "overlay",
}: {
  buildings: FarmPlanDockBuilding[];
  selectedBuildingId: string | "draft" | null;
  onSelectBuilding: (id: string) => void;
  onNewBuilding: () => void;
  mode?: "place" | "assign";
  assignTool?: "idle" | "barn" | "ctrl";
  onAssignTool?: (tool: "idle" | "barn" | "ctrl") => void;
  canClearBarn?: boolean;
  canClearCtrl?: boolean;
  onClearBarn?: () => void;
  onClearCtrl?: () => void;
  /** overlay = 필드 위 카드. sheet = 모바일 바텀시트 안. */
  variant?: "overlay" | "sheet";
}) {
  const draftOn = selectedBuildingId === "draft";
  const assign = mode === "assign";
  const sheet = variant === "sheet";
  if (assign) {
    const assignBtnW = sheet ? "w-full" : "w-auto min-w-[6.5rem]";
    return (
      <div
        className={cn(
          "grid grid-cols-2 gap-1",
          sheet ? "w-full" : "w-max rounded-lg border bg-card/95 p-2",
        )}
        data-testid="farm-plan-place-dock"
        data-dock-mode="assign"
      >
        <button
          type="button"
          aria-pressed={assignTool === "barn"}
          className={cn(
            ASSIGN_BTN,
            motionClass.microInteractive,
            assignBtnW,
            assignTool === "barn"
              ? "bg-primary text-primary-foreground"
              : "border bg-card text-foreground",
          )}
          onClick={() => onAssignTool?.(assignTool === "barn" ? "idle" : "barn")}
          data-testid="farm-plan-assign-barn"
        >
          축사 연결
        </button>
        <button
          type="button"
          disabled={!canClearBarn}
          className={cn(
            ASSIGN_BTN,
            motionClass.microInteractive,
            assignBtnW,
            "border bg-card text-foreground",
            !canClearBarn && "opacity-40",
          )}
          onClick={() => onClearBarn?.()}
          data-testid="farm-plan-clear-barn"
        >
          축사 해제
        </button>
        <button
          type="button"
          aria-pressed={assignTool === "ctrl"}
          className={cn(
            ASSIGN_BTN,
            motionClass.microInteractive,
            assignBtnW,
            assignTool === "ctrl"
              ? "bg-primary text-primary-foreground"
              : "border bg-card text-foreground",
          )}
          onClick={() => onAssignTool?.(assignTool === "ctrl" ? "idle" : "ctrl")}
          data-testid="farm-plan-assign-ctrl"
        >
          컨트롤러 연결
        </button>
        <button
          type="button"
          disabled={!canClearCtrl}
          className={cn(
            ASSIGN_BTN,
            motionClass.microInteractive,
            assignBtnW,
            "border bg-card text-foreground",
            !canClearCtrl && "opacity-40",
          )}
          onClick={() => onClearCtrl?.()}
          data-testid="farm-plan-clear-ctrl"
        >
          컨트롤러 해제
        </button>
      </div>
    );
  }
  return (
    <div
      className="flex max-h-[min(22rem,70%)] w-[11rem] flex-col gap-1 overflow-y-auto rounded-lg border bg-card/95 p-2"
      data-testid="farm-plan-place-dock"
      data-dock-mode={mode}
    >
      <button
        type="button"
        aria-pressed={draftOn}
        className={cn(
          motionClass.microInteractive,
          "rounded-md border px-2 py-1.5 text-left",
          dashboardTypography.body,
          draftOn
            ? dashboardChroma.chromeSelected
            : "border-transparent bg-transparent text-foreground/80",
        )}
        onClick={onNewBuilding}
      >
        새 건물
      </button>
      {buildings.map((row) => {
        const on = row.id === selectedBuildingId;
        return (
          <button
            key={row.id}
            type="button"
            aria-pressed={on}
            className={cn(
              motionClass.microInteractive,
              "rounded-md border px-2 py-1.5 text-left",
              dashboardTypography.body,
              on
                ? dashboardChroma.chromeSelected
                : "border-transparent bg-transparent text-foreground/80",
            )}
            onClick={() => onSelectBuilding(row.id)}
          >
            {row.label}
          </button>
        );
      })}
    </div>
  );
}

export function FarmPlanAssignCard({
  liveZones,
  connectedKeys,
  connecting,
  at,
  listTitle = "이 농장 축사",
  emptyText = "붙일 축사가 없습니다.",
  onConnect,
  onClear,
  onPick,
  pickedCount = 0,
}: {
  liveZones: FarmPlanDockLive[];
  connectedKeys: ReadonlySet<string>;
  connecting: boolean;
  at: { x: number; y: number };
  listTitle?: string;
  emptyText?: string;
  onConnect: () => void;
  onClear: () => void;
  onPick: (key: string) => void;
  pickedCount?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ left: at.x + 8, top: at.y + 8 });
  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.offsetParent;
    if (!(el instanceof HTMLElement) || !(parent instanceof HTMLElement)) {
      return;
    }
    const pad = 8;
    const gap = 8;
    const pw = parent.clientWidth;
    const ph = parent.clientHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = at.x + gap;
    if (left + w > pw - pad) left = at.x - gap - w;
    left = Math.min(Math.max(left, pad), Math.max(pad, pw - pad - w));
    let top = at.y + gap;
    if (top + h > ph - pad) top = at.y - gap - h;
    top = Math.min(Math.max(top, pad), Math.max(pad, ph - pad - h));
    setBox({ left, top });
  }, [at.x, at.y, connecting, liveZones.length, pickedCount]);
  return (
    <div
      ref={ref}
      className={cn(
        dashboardElevation.overlay,
        "absolute z-[500] flex w-[11rem] max-h-[calc(100%-1rem)] flex-col gap-1 overflow-y-auto p-2",
      )}
      style={{ left: box.left, top: box.top }}
      data-testid="farm-plan-assign-card"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <p
        className={cn(dashboardTypography.meta, "px-0.5 tabular-nums")}
        data-testid="farm-plan-picked-count"
      >
        {pickedCount}개 방
      </p>
      <div className="flex gap-1">
        <button
          type="button"
          aria-pressed={connecting}
          className={cn(
            ASSIGN_BTN,
            motionClass.microInteractive,
            "flex-1",
            connecting
              ? "bg-primary text-primary-foreground"
              : "border bg-card text-foreground",
          )}
          onClick={onConnect}
          data-testid="farm-plan-connect-rooms"
        >
          연결
        </button>
        <button
          type="button"
          className={cn(
            ASSIGN_BTN,
            motionClass.microInteractive,
            "flex-1 border bg-card text-foreground",
          )}
          onClick={onClear}
          data-testid="farm-plan-clear-rooms"
        >
          해제
        </button>
      </div>
      {connecting ? (
        <div
          className="flex max-h-[min(16rem,45vh)] flex-col gap-1 overflow-y-auto"
          data-testid="farm-plan-assign-live"
        >
          <p className={cn(ASSIGN_ROW, "px-0.5 py-0.5 text-muted-foreground")}>
            {listTitle}
          </p>
          {liveZones.length === 0 ? (
            <p className={cn(ASSIGN_ROW, "px-0.5 py-0.5 text-muted-foreground")}>
              {emptyText}
            </p>
          ) : (
            liveZones.map((row) => {
              const on = connectedKeys.has(row.key);
              return (
                <button
                  key={row.key}
                  type="button"
                  title={row.label}
                  className={cn(
                    ASSIGN_ROW,
                    motionClass.microInteractive,
                    "flex items-center gap-1 border border-transparent bg-transparent",
                    on ? "text-foreground" : "text-foreground/80",
                  )}
                  onClick={() => onPick(row.key)}
                >
                  <span className="min-w-0 flex-1 truncate">{row.label}</span>
                  {on ? (
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      붙음
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
