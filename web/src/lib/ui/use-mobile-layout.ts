"use client";

import { useEffect, useState } from "react";

/** Tailwind `md` 미만 — 모바일 전용 레이아웃 (768px+ 는 desktop hub) */
const MD_MAX_QUERY = "(max-width: 767px)";

export function useMobileLayout(): boolean {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MD_MAX_QUERY);
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return mobile;
}
