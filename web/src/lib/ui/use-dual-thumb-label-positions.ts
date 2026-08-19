"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

export type DualThumbLabelPositions = {
  /** rail 기준 라벨 왼쪽 모서리 px */
  lowPx: number;
  highPx: number;
} | null;

type Args<
  R extends HTMLElement = HTMLElement,
  L extends HTMLElement = HTMLElement,
> = {
  railRef: RefObject<R | null>;
  lowRef: RefObject<L | null>;
  highRef: RefObject<L | null>;
  lowPct: number;
  highPct: number;
  /** 재측정 트리거 (값·텍스트 변경) */
  deps: unknown[];
  /** 라벨 사이 최소 간격 px */
  gap?: number;
  /** false면 측정 생략(기본 정렬 유지) */
  enabled?: boolean;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * dual-thumb 라벨 겹침 방지 — rail·라벨 폭을 측정해 겹치면 서로 밀어낸다.
 * 측정 전(또는 disabled)에는 null을 반환해 기본 중앙 정렬을 사용한다.
 */
export function useDualThumbLabelPositions<
  R extends HTMLElement = HTMLElement,
  L extends HTMLElement = HTMLElement,
>({
  railRef,
  lowRef,
  highRef,
  lowPct,
  highPct,
  deps,
  gap = 6,
  enabled = true,
}: Args<R, L>): DualThumbLabelPositions {
  const [pos, setPos] = useState<DualThumbLabelPositions>(null);

  useLayoutEffect(() => {
    const rail = railRef.current;
    const lowEl = lowRef.current;
    const highEl = highRef.current;
    if (!enabled || !rail || !lowEl || !highEl) {
      setPos(null);
      return;
    }

    const measure = () => {
      const railW = rail.clientWidth;
      const lowW = lowEl.offsetWidth;
      const highW = highEl.offsetWidth;
      if (railW <= 0 || lowW <= 0 || highW <= 0) {
        setPos(null);
        return;
      }

      const lowCenter = (clamp(lowPct, 0, 100) / 100) * railW;
      const highCenter = (clamp(highPct, 0, 100) / 100) * railW;

      let lowLeft = lowCenter - lowW / 2;
      let highLeft = highCenter - highW / 2;

      // 겹치면 두 thumb 중점을 기준으로 좌우로 분리
      if (lowLeft + lowW + gap > highLeft) {
        const mid = (lowCenter + highCenter) / 2;
        lowLeft = mid - gap / 2 - lowW;
        highLeft = mid + gap / 2;
      }

      lowLeft = clamp(lowLeft, 0, Math.max(0, railW - lowW));
      highLeft = clamp(highLeft, 0, Math.max(0, railW - highW));

      // clamp 후에도 겹치면 가장자리에 붙여 재배치 (폭이 충분한 경우)
      if (highLeft < lowLeft + lowW + gap && railW >= lowW + gap + highW) {
        if (railW - highCenter <= lowCenter) {
          highLeft = railW - highW;
          lowLeft = clamp(highLeft - gap - lowW, 0, railW - lowW);
        } else {
          lowLeft = 0;
          highLeft = clamp(lowLeft + lowW + gap, 0, railW - highW);
        }
      }

      setPos({ lowPx: lowLeft, highPx: highLeft });
    };

    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(rail);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps로 재측정 제어
  }, [enabled, lowPct, highPct, gap, ...deps]);

  return pos;
}
