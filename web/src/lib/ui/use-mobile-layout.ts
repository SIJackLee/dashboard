"use client";

import { useEffect, useState } from "react";

/** Tailwind `lg` 미만 — 모바일·태블릿 전용 레이아웃 분기 */
const LG_MAX_QUERY = "(max-width: 1023px)";

export function useMobileLayout(): boolean {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(LG_MAX_QUERY);
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return mobile;
}
