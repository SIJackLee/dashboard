"use client";

import { useEffect, useState, type RefObject } from "react";
import { DASHBOARD_COMPACT_MAX_PX } from "@/lib/ui/layout-breakpoints";

/**
 * 뷰포트(media query) 대신 실제 DOM 너비로 compact 여부 판단.
 * Cursor IDE 내장 브라우저처럼 패널만 줄어들고 innerWidth가 유지되는 환경 대응.
 */
export function useContainerCompact(
  ref: RefObject<HTMLElement | null>,
  maxWidth = DASHBOARD_COMPACT_MAX_PX
): boolean {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const sync = () => {
      const elW = el.getBoundingClientRect().width;
      const docW = document.documentElement.clientWidth;
      const vpW = window.visualViewport?.width ?? docW;
      const w = Math.min(elW, docW, vpW);
      setCompact(w <= maxWidth);
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    window.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [maxWidth]);

  return compact;
}
