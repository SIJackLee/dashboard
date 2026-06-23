"use client";

import { useEffect, useRef } from "react";

/** 가로 스크롤 탭 nav — active 탭이 잘리지 않도록 scrollIntoView */
export function useScrollActiveTab(activeKey: string) {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const activeEl = nav.querySelector("[aria-current]");
    activeEl?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [activeKey]);

  return navRef;
}
