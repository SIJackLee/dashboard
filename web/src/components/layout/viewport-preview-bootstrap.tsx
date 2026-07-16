"use client";

import { useEffect } from "react";
import { initViewportPreviewAutoSync } from "@/lib/ui/viewport-preview-store";

/** 접속 기기·화면 너비에 따라 mobile/desktop UI 모드를 자동 동기화 (로그인 포함 전역). */
export function ViewportPreviewBootstrap() {
  useEffect(() => initViewportPreviewAutoSync(), []);
  return null;
}
