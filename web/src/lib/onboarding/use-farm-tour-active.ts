"use client";

import { useEffect, useState } from "react";
import { FARM_TOUR_ACTIVE_EVENT } from "@/lib/onboarding/tour-steps";

/** 기능 안내 투어 활성 — stagger·list enrich·soft panel fetch 억제용. */
export function useFarmTourActive(): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const onActive = (e: Event) => {
      setActive(
        Boolean((e as CustomEvent<{ active?: boolean }>).detail?.active),
      );
    };
    window.addEventListener(FARM_TOUR_ACTIVE_EVENT, onActive);
    return () => window.removeEventListener(FARM_TOUR_ACTIVE_EVENT, onActive);
  }, []);
  return active;
}
