"use client";

import { useEffect } from "react";
import { signalNavContentReadyAfterPaint } from "@/lib/navigation/nav-content-ready";

/** ready=false 이면 필드 bootstrap 등 실콘텐츠가 올 때까지 스플래시를 유지. */
export function NavContentReadyMarker({ ready = true }: { ready?: boolean }) {
  useEffect(() => {
    if (!ready) return;
    return signalNavContentReadyAfterPaint();
  }, [ready]);

  return null;
}
