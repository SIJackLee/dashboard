"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { Settings } from "lucide-react";
import { HeaderToolsMenu } from "@/components/layout/header-tools-menu";
import type { AlarmRow } from "@/lib/data/alarms";
import type { FarmKey } from "@/lib/data/farm-key";
import type { FarmOverview } from "@/lib/data/iot";
import { FARM_TOUR_ACTION_EVENT } from "@/lib/onboarding/tour-steps";
import {
  afterFrames,
  dispatchTourGridActionDone,
  waitForTourTarget,
} from "@/lib/onboarding/tour-timing";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { motionDuration } from "@/lib/ui/motion-tokens";
import { useOpenPresence } from "@/lib/ui/use-clip-presence";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "hub-widget-fab-pos-v1";
const FAB_SIZE = 48;
const MARGIN = 12;
const DRAG_THRESHOLD_PX = 8;
const ORBIT_STAGGER_MS = 55;
/** 디자인 · 기능 · 알람 링 반지름 */
const ORBIT_RADII = [96, 168, 240];
const emptySubscribe = () => () => {};

type Pos = { left: number; top: number };
export type HubRailDir = "up" | "down" | "left" | "right";

type Props = {
  overview?: FarmOverview;
  alarms?: AlarmRow[];
  isAdmin?: boolean;
  farmKey?: FarmKey | null;
};

function defaultPos(): Pos {
  if (typeof window === "undefined") return { left: 0, top: 0 };
  return {
    left: Math.max(MARGIN, window.innerWidth - FAB_SIZE - MARGIN),
    top: Math.max(MARGIN, window.innerHeight - FAB_SIZE - 96),
  };
}

function clampPos(p: Pos): Pos {
  const maxL = Math.max(MARGIN, window.innerWidth - FAB_SIZE - MARGIN);
  const maxT = Math.max(MARGIN, window.innerHeight - FAB_SIZE - MARGIN);
  return {
    left: Math.min(maxL, Math.max(MARGIN, p.left)),
    top: Math.min(maxT, Math.max(MARGIN, p.top)),
  };
}

function readStoredPos(): Pos | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Pos;
    if (
      typeof parsed?.left !== "number" ||
      typeof parsed?.top !== "number" ||
      !Number.isFinite(parsed.left) ||
      !Number.isFinite(parsed.top)
    ) {
      return null;
    }
    return clampPos(parsed);
  } catch {
    return null;
  }
}

/** 여유 공간 → 방사 기준 방향 */
function preferRailDir(pos: Pos): HubRailDir {
  if (typeof window === "undefined") return "up";
  const cx = pos.left + FAB_SIZE / 2;
  const cy = pos.top + FAB_SIZE / 2;
  const spaceUp = cy;
  const spaceDown = window.innerHeight - cy;
  const spaceLeft = cx;
  const spaceRight = window.innerWidth - cx;

  const TOP_BAND = 168;
  const BOTTOM_BAND = 120;
  if (pos.top < TOP_BAND) return "down";
  if (pos.top + FAB_SIZE > window.innerHeight - BOTTOM_BAND) return "up";

  const maxV = Math.max(spaceUp, spaceDown);
  const maxH = Math.max(spaceLeft, spaceRight);
  if (maxV >= maxH * 0.85) {
    return spaceUp >= spaceDown ? "up" : "down";
  }
  return spaceLeft >= spaceRight ? "left" : "right";
}

/**
 * 3방향 부채꼴 각도(deg, 0=오른쪽 · 시계방향+).
 * [디자인, 기능, 알람] — 약 100° 간격으로 또렷이 분리
 */
function radialFanDegs(dir: HubRailDir): [number, number, number] {
  switch (dir) {
    case "down":
      return [20, 90, 160];
    case "left":
      return [110, 180, 250];
    case "right":
      return [290, 0, 70];
    case "up":
    default:
      return [200, 270, 340];
  }
}

function layersFlyoutSide(dir: HubRailDir): "up" | "down" {
  return dir === "down" ? "down" : "up";
}

function orbitExitMs(itemCount: number) {
  return (
    motionDuration.exit + Math.max(0, itemCount - 1) * ORBIT_STAGGER_MS * 0.28
  );
}

function orbitOffset(deg: number, radius: number) {
  const rad = (deg * Math.PI) / 180;
  return { ox: Math.cos(rad) * radius, oy: Math.sin(rad) * radius };
}

/**
 * 통합 위젯 FAB — 3방향 원형 방사 (디자인 / 기능·운영 / 알람).
 */
export function HubWidgetFab({
  overview,
  alarms = [],
  isAdmin = false,
  farmKey = null,
}: Props) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [pos, setPos] = useState<Pos>(defaultPos);
  const [open, setOpen] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origLeft: number;
    origTop: number;
    moved: boolean;
  } | null>(null);

  const offline = overview?.offlineCount ?? 0;
  const alarmCount = alarms.filter((a) => a.status === "active").length;
  const alert = offline > 0 || alarmCount > 0;
  const badgeCount = alarmCount > 0 ? alarmCount : offline > 0 ? offline : 0;

  const railDir = preferRailDir(pos);
  const fanDegs = radialFanDegs(railDir);
  const flyoutSide = layersFlyoutSide(railDir);
  /** 디자인2 + 기능(1~2) + 알람2 + 차트1 */
  const toolCount = 2 + (isAdmin ? 2 : 1) + 2 + 1;
  const { mounted: railMounted, phase: railPhase } = useOpenPresence(
    open,
    orbitExitMs(toolCount),
  );

  useEffect(() => {
    const stored = readStoredPos();
    queueMicrotask(() => setPos(stored ?? defaultPos()));
  }, []);

  useEffect(() => {
    const onTourAction = (e: Event) => {
      const action = (e as CustomEvent<{ action?: string }>).detail?.action;
      if (action === "open-header-tools") {
        setOpen(true);
        void (async () => {
          await afterFrames(2);
          await waitForTourTarget('[data-tour-id="header-tools-panel"]');
          dispatchTourGridActionDone("open-header-tools");
        })();
        return;
      }
      if (action === "close-header-tools") {
        setOpen(false);
        dispatchTourGridActionDone("close-header-tools");
      }
    };
    window.addEventListener(FARM_TOUR_ACTION_EVENT, onTourAction);
    return () =>
      window.removeEventListener(FARM_TOUR_ACTION_EVENT, onTourAction);
  }, []);

  useEffect(() => {
    const onResize = () => setPos((p) => clampPos(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const persist = useCallback((next: Pos) => {
    const clamped = clampPos(next);
    setPos(clamped);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped));
    } catch {
      /* ignore */
    }
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origLeft: pos.left,
      origTop: pos.top,
      moved: false,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
      return;
    }
    d.moved = true;
    if (open) setOpen(false);
    setPos(
      clampPos({
        left: d.origLeft + dx,
        top: d.origTop + dy,
      }),
    );
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
    if (d.moved) {
      persist({
        left: d.origLeft + (e.clientX - d.startX),
        top: d.origTop + (e.clientY - d.startY),
      });
      return;
    }
    setOpen((v) => !v);
  };

  if (!mounted) return null;

  /* 알람 레이: 알림·연결 다음 링에 차트 */
  const alarmRing = 2;
  const alarmDeg = fanDegs[2];
  const chartOrbit = orbitOffset(
    alarmDeg,
    ORBIT_RADII[Math.min(alarmRing, ORBIT_RADII.length - 1)] ?? 168,
  );
  const layerMotion =
    railPhase === "exit"
      ? motionClass.hubWidgetOrbitItemExit
      : motionClass.hubWidgetOrbitItemEnter;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[60]"
      data-hub-widget-fab-root=""
    >
      {open ? (
        <button
          type="button"
          className="pointer-events-auto fixed inset-0 z-0 cursor-default bg-transparent"
          aria-label="위젯 패널 닫기"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div
        className="pointer-events-none absolute"
        style={{ left: pos.left, top: pos.top, width: FAB_SIZE, height: FAB_SIZE }}
      >
        <div className="relative size-full">
          <button
            type="button"
            className={cn(
              "pointer-events-auto absolute inset-0 z-10 inline-flex touch-none select-none items-center justify-center rounded-full border shadow-sm",
              dashboardUi.topHeaderActionBtn,
              "!size-12 !rounded-full",
              alert && dashboardUi.topHeaderActionBtnAlert,
              open &&
                "border-primary/60 bg-primary/5 text-primary hover:bg-primary/10",
            )}
            data-tour-id="header-tools"
            data-hub-widget-fab=""
            aria-label="통합 위젯"
            title="통합 위젯 — 드래그로 이동, 탭으로 메뉴"
            aria-expanded={open}
            aria-haspopup="dialog"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <Settings className="size-5" aria-hidden />
            {badgeCount > 0 ? (
              <span
                className={cn(
                  dashboardUi.topHeaderCountBadge,
                  dashboardUi.topHeaderCountBadgeAlert,
                )}
              >
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            ) : null}
          </button>

          {/* FAB 중심 기준 3방향 방사 + 차트 슬롯 */}
          <div
            className={cn(
              "absolute left-1/2 top-1/2 z-[6] size-0",
              !railMounted && "pointer-events-none invisible",
            )}
            data-tour-id={railMounted ? "header-tools-panel" : undefined}
            data-hub-widget-panel={railMounted ? "" : undefined}
            data-hub-rail-dir={railDir}
            data-hub-layout="radial3"
            data-hub-layers-flyout={flyoutSide}
            data-phase={railMounted ? railPhase : undefined}
            role={railMounted ? "dialog" : undefined}
            aria-label={railMounted ? "통합 위젯 설정" : undefined}
            aria-hidden={!railMounted || railPhase === "exit"}
            onPointerDown={
              railMounted ? (e) => e.stopPropagation() : undefined
            }
          >
            {railMounted ? (
              <HeaderToolsMenu
                variant="hub-panel"
                hubLayout="radial3"
                hubPattern="all"
                hubRailDir={railDir}
                hubRailPhase={railPhase}
                hubFanDegs={fanDegs}
                hubOrbitRadii={ORBIT_RADII}
                overview={overview}
                alarms={alarms}
                isAdmin={isAdmin}
                farmKey={farmKey}
              />
            ) : null}

            <div
              className={cn(
                "absolute z-[7] flex items-center justify-center overflow-visible",
                "[&:has([data-farm-chart-layers-shell])]:size-11",
                "[&:not(:has([data-farm-chart-layers-shell]))]:pointer-events-none",
                railMounted && "pointer-events-auto",
                "[&_button]:rounded-full",
                "[&_[data-farm-chart-layers-shell]]:border-0 [&_[data-farm-chart-layers-shell]]:p-0 [&_[data-farm-chart-layers-shell]]:pl-0",
                "[&_[data-farm-chart-layers-shell].farm-chart-layers-enter]:!animate-none",
                "[&_[data-farm-chart-layers-shell].farm-chart-layers-exit]:!animate-none",
                railMounted && layerMotion,
              )}
              style={
                {
                  left: chartOrbit.ox,
                  top: chartOrbit.oy,
                  ["--hub-ox" as string]: `${chartOrbit.ox}px`,
                  ["--hub-oy" as string]: `${chartOrbit.oy}px`,
                  ["--hub-orbit-ray" as string]: 2,
                  ["--hub-orbit-ring" as string]: alarmRing,
                } as CSSProperties
              }
              data-hub-chart-layers-wrap=""
              data-hub-orbit-group="alarm"
            >
              <div
                data-farm-chart-layers-slot
                className="relative z-[1] flex size-full items-center justify-center overflow-visible empty:hidden"
              />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
