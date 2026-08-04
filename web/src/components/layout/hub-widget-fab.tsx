"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { Settings } from "lucide-react";
import { HeaderToolsMenu } from "@/components/layout/header-tools-menu";
import {
  RAIL_GROUP_GAP_DEFAULT,
  RAIL_PITCH_BASE,
  type HubRailDir,
} from "@/components/layout/hub-rail-layout";
import type { AlarmRow } from "@/lib/data/alarms";
import type { FarmKey } from "@/lib/data/farm-key";
import type { FarmOverview } from "@/lib/data/iot";
import { FARM_TOUR_ACTION_EVENT } from "@/lib/onboarding/tour-steps";
import {
  afterFrames,
  dispatchTourGridActionDone,
  waitForTourTarget,
} from "@/lib/onboarding/tour-timing";
import { useShellAlarms } from "@/lib/navigation/shell-live-alarms-store";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { motionDuration } from "@/lib/ui/motion-tokens";
import { useOpenPresence } from "@/lib/ui/use-clip-presence";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "hub-widget-fab-pos-v1";
const FAB_SIZE = 48;
const MARGIN = 12;
const DRAG_THRESHOLD_PX = 8;
const RAIL_STAGGER_MS = 55;
const RAIL_PITCH_MIN = 40;
const RAIL_GROUP_GAP = RAIL_GROUP_GAP_DEFAULT;
/** 레일 끝 · 화면 가장자리 여유 */
const RAIL_EDGE_PAD = 28;
const emptySubscribe = () => () => {};

type Pos = { left: number; top: number };
export type { HubRailDir };

type LinearRailLayout = {
  dir: HubRailDir;
  pitch: number;
  detailOpenLeft: boolean;
};

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

/** 레일 길이(아이템·끝 여유) — 등간격 */
function railNeedLen(itemCount: number, pitch: number): number {
  return itemCount * pitch + RAIL_EDGE_PAD;
}

function spaceAlong(
  dir: HubRailDir,
  spaceUp: number,
  spaceDown: number,
  spaceLeft: number,
  spaceRight: number,
): number {
  if (dir === "up") return spaceUp;
  if (dir === "down") return spaceDown;
  if (dir === "left") return spaceLeft;
  return spaceRight;
}

/**
 * FAB 위치 → 선형 레일 방향·피치·상세 팝오버 측.
 * 여유 공간으로만 펼치고, 짧으면 피치만 축소한다.
 */
function fitLinearRailLayout(pos: Pos, itemCount: number): LinearRailLayout {
  if (typeof window === "undefined") {
    return { dir: "up", pitch: RAIL_PITCH_BASE, detailOpenLeft: true };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cx = pos.left + FAB_SIZE / 2;
  const cy = pos.top + FAB_SIZE / 2;
  const spaceUp = cy;
  const spaceDown = vh - cy;
  const spaceLeft = cx;
  const spaceRight = vw - cx;
  const need = railNeedLen(itemCount, RAIL_PITCH_BASE);

  const ranked: HubRailDir[] = (
    [
      ["up", spaceUp],
      ["down", spaceDown],
      ["left", spaceLeft],
      ["right", spaceRight],
    ] as const
  )
    .slice()
    .sort((a, b) => b[1] - a[1])
    .map(([d]) => d);

  let dir = ranked[0] ?? "up";
  /* 기본 피치가 들어가는 축을 우선, 없으면 최대 여유 축 */
  for (const d of ranked) {
    if (spaceAlong(d, spaceUp, spaceDown, spaceLeft, spaceRight) >= need * 0.92) {
      dir = d;
      break;
    }
  }

  const available = Math.max(
    0,
    spaceAlong(dir, spaceUp, spaceDown, spaceLeft, spaceRight) - RAIL_EDGE_PAD,
  );
  const pitch = Math.round(
    Math.min(
      RAIL_PITCH_BASE,
      Math.max(RAIL_PITCH_MIN, available / Math.max(itemCount, 1)),
    ),
  );
  const detailOpenLeft = spaceLeft >= spaceRight;

  return { dir, pitch, detailOpenLeft };
}

function railExitMs(itemCount: number) {
  return (
    motionDuration.exit + Math.max(0, itemCount - 1) * RAIL_STAGGER_MS * 0.28
  );
}

/**
 * 통합 위젯 FAB — 선형 스피드 다이얼 (여유 방향 일직선 레일).
 */
export function HubWidgetFab({
  overview,
  alarms = [],
  isAdmin = false,
  farmKey = null,
}: Props) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const liveAlarms = useShellAlarms(alarms);
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
  const alarmCount = liveAlarms.filter((a) => a.status === "active").length;
  const alert = alarmCount > 0 || offline > 0;
  const badgeCount = alarmCount;

  /** 디자인2 + 기능(1~2) + 이상상황1 */
  const toolIconCount = 2 + (isAdmin ? 2 : 1) + 1;
  const slotCount = toolIconCount;
  const layout = fitLinearRailLayout(pos, slotCount);
  const railDir = layout.dir;
  const pitch = layout.pitch;

  const { mounted: railMounted, phase: railPhase } = useOpenPresence(
    open,
    railExitMs(slotCount),
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

          {/* FAB 중심 기준 선형 레일 + 차트 슬롯 */}
          <div
            className={cn(
              "absolute left-1/2 top-1/2 z-[6] size-0",
              !railMounted && "pointer-events-none invisible",
            )}
            data-tour-id={railMounted ? "header-tools-panel" : undefined}
            data-hub-widget-panel={railMounted ? "" : undefined}
            data-hub-rail-dir={railDir}
            data-hub-layout="rail"
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
                hubLayout="rail"
                hubPattern="all"
                hubRailDir={railDir}
                hubRailPhase={railPhase}
                hubRailPitch={pitch}
                hubRailGroupGap={RAIL_GROUP_GAP}
                hubDetailOpenLeft={layout.detailOpenLeft}
                overview={overview}
                alarms={liveAlarms}
                isAdmin={isAdmin}
                farmKey={farmKey}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
