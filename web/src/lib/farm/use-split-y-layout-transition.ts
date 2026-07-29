"use client";

import { useEffect, useRef, useState } from "react";
import {
  easeOutCubic,
  lerpSplitYLayout,
  splitYLayoutsEqual,
  type SplitYLayout,
} from "@/lib/farm/unified-barn-trend-series";
import { motionDuration } from "@/lib/ui/motion-tokens";

function layoutKey(layout: SplitYLayout): string {
  return [
    layout.motorLo,
    layout.motorHi,
    layout.humLo,
    layout.humHi,
    layout.tempLo,
    layout.tempHi,
  ]
    .map((n) => n.toFixed(3))
    .join(":");
}

/**
 * split-Y 목표 레이아웃으로 보간.
 * 레이어 on/off 시 밴드가 빈 공간을 부드럽게 채우도록 함.
 */
export function useSplitYLayoutTransition(
  target: SplitYLayout,
  durationMs: number = motionDuration.moderate,
): SplitYLayout {
  const [current, setCurrent] = useState<SplitYLayout>(target);
  const currentRef = useRef(current);
  const rafRef = useRef(0);
  const targetKey = layoutKey(target);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  useEffect(() => {
    let cancelled = false;
    const nextTarget = target;

    const snap = () => {
      if (cancelled) return;
      currentRef.current = nextTarget;
      setCurrent(nextTarget);
    };

    const start = () => {
      if (cancelled) return;

      if (typeof window === "undefined") {
        snap();
        return;
      }

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches;
      if (reduced || durationMs <= 0) {
        snap();
        return;
      }

      if (splitYLayoutsEqual(currentRef.current, nextTarget)) {
        snap();
        return;
      }

      const from = currentRef.current;
      const started = performance.now();
      cancelAnimationFrame(rafRef.current);

      const tick = (now: number) => {
        if (cancelled) return;
        const raw = (now - started) / durationMs;
        const t = Math.min(1, Math.max(0, raw));
        const eased = lerpSplitYLayout(from, nextTarget, easeOutCubic(t));
        currentRef.current = eased;
        setCurrent(eased);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          currentRef.current = nextTarget;
          setCurrent(nextTarget);
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    };

    /* 린트: effect 본문 동기 setState 회피 — rAF로 시작 */
    const boot = requestAnimationFrame(start);

    return () => {
      cancelled = true;
      cancelAnimationFrame(boot);
      cancelAnimationFrame(rafRef.current);
    };
  }, [targetKey, durationMs, target]);

  return current;
}
