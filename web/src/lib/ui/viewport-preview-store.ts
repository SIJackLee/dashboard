"use client";

const STORAGE_KEY = "dashboard-viewport-preview";

/** Tailwind `md` 미만 — 모바일 UI 자동 감지 기준 */
export const VIEWPORT_MOBILE_MEDIA_QUERY = "(max-width: 767px)";

export type ViewportPreviewMode = "mobile" | "desktop";
export type ViewportPreference = ViewportPreviewMode | "auto";

const listeners = new Set<() => void>();

function detectPreviewMode(): ViewportPreviewMode {
  if (typeof window === "undefined") return "desktop";
  return window.matchMedia(VIEWPORT_MOBILE_MEDIA_QUERY).matches
    ? "mobile"
    : "desktop";
}

function readPreference(): ViewportPreference {
  if (typeof window === "undefined") return "auto";
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === "mobile" || raw === "desktop") return raw;
  return "auto";
}

function resolvePreviewMode(pref: ViewportPreference): ViewportPreviewMode {
  if (pref === "auto") return detectPreviewMode();
  return pref;
}

/**
 * SSR·hydration 첫 페인트는 항상 desktop/auto.
 * localStorage·matchMedia는 beforeInteractive script(html data) +
 * `initViewportPreviewAutoSync`(useEffect)에서만 반영한다.
 * 모듈 로드 시 window를 읽으면 useSyncExternalStore 서버 스냅샷과 불일치한다.
 */
let preference: ViewportPreference = "auto";
let previewMode: ViewportPreviewMode = "desktop";

export function getViewportPreference(): ViewportPreference {
  return preference;
}

export function getViewportPreviewMode(): ViewportPreviewMode {
  return previewMode;
}

export function isViewportCompact(mode: ViewportPreviewMode = previewMode): boolean {
  return mode === "mobile";
}

function notifyListeners(): void {
  listeners.forEach((l) => l());
}

function applyResolvedMode(): void {
  previewMode = resolvePreviewMode(preference);
  if (typeof document !== "undefined") {
    document.documentElement.dataset.viewportPreview = previewMode;
  }
  notifyListeners();
}

/** 헤더 토글 — 수동 mobile/desktop 고정 (자동 감지 해제) */
export function setViewportPreviewMode(mode: ViewportPreviewMode): void {
  preference = mode;
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, mode);
  }
  applyResolvedMode();
}

/** 자동 감지 복귀 */
export function setViewportPreferenceAuto(): void {
  preference = "auto";
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
  applyResolvedMode();
}

export function subscribeViewportPreview(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

/** 클라이언트 — html data 속성 동기화 */
export function syncViewportPreviewToDocument(mode: ViewportPreviewMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.viewportPreview = mode;
}

/**
 * 루트 레이아웃 bootstrap — auto 모드일 때 화면 크기 변경 시 UI 모드 재동기화.
 * 로그인·대시보드 공통 (첫 paint 전 init script와 함께 사용).
 */
export function initViewportPreviewAutoSync(): () => void {
  preference = readPreference();
  applyResolvedMode();

  const mq = window.matchMedia(VIEWPORT_MOBILE_MEDIA_QUERY);
  const onChange = () => {
    if (preference !== "auto") return;
    applyResolvedMode();
  };
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
