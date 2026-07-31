"use client";

import { useEffect, useState } from "react";

export const FARM_CHART_LAYERS_SLOT_SEL = "[data-farm-chart-layers-slot]";

/**
 * TopBar 차트 레이어 툴바 portal 슬롯 (`data-farm-chart-layers-slot`).
 * 마운트 1회 조회만 하지 않고, 등장/제거를 observe. 없으면 null → 인라인 폴백.
 */
export function useFarmChartLayersSlot(): Element | null {
  const [slot, setSlot] = useState<Element | null>(null);

  useEffect(() => {
    let cancelled = false;
    let mo: MutationObserver | null = null;

    const disconnect = () => {
      mo?.disconnect();
      mo = null;
    };

    const watch = (el: Element | null) => {
      if (cancelled) return;
      setSlot((prev) => (prev === el ? prev : el));
      disconnect();

      if (typeof MutationObserver === "undefined") return;

      if (!el) {
        mo = new MutationObserver(() => {
          const found = document.querySelector(FARM_CHART_LAYERS_SLOT_SEL);
          if (found) watch(found);
        });
        mo.observe(document.body, { childList: true, subtree: true });
        return;
      }

      const parent = el.parentElement ?? document.body;
      mo = new MutationObserver(() => {
        if (!el.isConnected) {
          watch(document.querySelector(FARM_CHART_LAYERS_SLOT_SEL));
        }
      });
      mo.observe(parent, { childList: true, subtree: true });
    };

    const boot = window.setTimeout(() => {
      if (!cancelled) {
        watch(document.querySelector(FARM_CHART_LAYERS_SLOT_SEL));
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(boot);
      disconnect();
    };
  }, []);

  return slot;
}
