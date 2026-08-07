"use client";

import { useEffect, useState } from "react";
import { FARM_TOUR_ACTIVE_EVENT } from "@/lib/onboarding/tour-steps";

/** 이벤트 누락·리마운트 대비 — 동기 플래그 */
let farmTourActiveSync = false;

export function getFarmTourActiveSync(): boolean {
  return farmTourActiveSync;
}

export function setFarmTourActiveSync(active: boolean): void {
  farmTourActiveSync = active;
}

/** 기능 안내 투어 활성 — stagger·list enrich·soft panel fetch 억제용. */
export function useFarmTourActive(): boolean {
  const [active, setActive] = useState(() => farmTourActiveSync);
  useEffect(() => {
    const onActive = (e: Event) => {
      const next = Boolean(
        (e as CustomEvent<{ active?: boolean }>).detail?.active,
      );
      farmTourActiveSync = next;
      setActive(next);
    };
    window.addEventListener(FARM_TOUR_ACTIVE_EVENT, onActive);
    return () => window.removeEventListener(FARM_TOUR_ACTIVE_EVENT, onActive);
  }, []);
  return active;
}
