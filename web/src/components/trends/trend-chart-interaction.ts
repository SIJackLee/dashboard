/**
 * 추이 차트 상호작용 보조 — 컴포넌트 상태에 의존하지 않는 최상위 헬퍼/타입/상수.
 *
 * (스코프 드래그/줌처럼 렌더 시점 기하 클로저에 강결합된 로직은 컴포넌트에 유지)
 */

import type { PointerEvent as ReactPointerEvent } from "react";
import { motionClass } from "@/lib/ui/motion-classes";
import type { ClipPhase } from "@/lib/ui/use-clip-presence";

export const MAX_PINNED_TIPS = 5;
export const PIN_CLICK_SLOP_PX = 10;
/** 모바일 — 설정값 라벨 더블탭 → 숫자 입력 */
export const SCALE_EDGE_DOUBLE_TAP_MS = 320;
export const SCALE_EDGE_DOUBLE_TAP_SLOP_PX = 28;
export const SCALE_EDGE_TAP_SLOP_PX = 12;

export type ScaleEdgeTapRecord = {
  id: string;
  t: number;
  x: number;
  y: number;
};

export type PinnedTip = {
  id: string;
  idx: number;
  seriesKey: string;
  /** plot 상대 좌표 0~1 (ellipse 앵커) */
  nx: number;
  ny: number;
  /** 기본 배치 대비 사용자 드래그 오프셋(px) */
  ox: number;
  oy: number;
};

export function handleScaleEdgeDoubleTap(
  e: ReactPointerEvent<HTMLDivElement>,
  labelArm: { id: string; x: number; y: number; pointerType: string },
  scaleEdgeTapRef: { current: ScaleEdgeTapRecord | null },
  beginScaleEdgeEdit: (id: string) => void,
): void {
  const dist = Math.hypot(e.clientX - labelArm.x, e.clientY - labelArm.y);
  const isTouchLike =
    labelArm.pointerType === "touch" || labelArm.pointerType === "pen";
  if (dist > SCALE_EDGE_TAP_SLOP_PX || !isTouchLike) return;

  const now = e.timeStamp;
  const prev = scaleEdgeTapRef.current;
  if (
    prev &&
    prev.id === labelArm.id &&
    now - prev.t <= SCALE_EDGE_DOUBLE_TAP_MS &&
    Math.hypot(e.clientX - prev.x, e.clientY - prev.y) <=
      SCALE_EDGE_DOUBLE_TAP_SLOP_PX
  ) {
    scaleEdgeTapRef.current = null;
    beginScaleEdgeEdit(labelArm.id);
    return;
  }

  scaleEdgeTapRef.current = {
    id: labelArm.id,
    t: now,
    x: e.clientX,
    y: e.clientY,
  };
}

export function clipWipeClass(phase: ClipPhase): string | undefined {
  if (phase === "enter") return motionClass.farmChartClipWipeIn;
  if (phase === "exit") return motionClass.farmChartClipWipeOut;
  return undefined;
}
