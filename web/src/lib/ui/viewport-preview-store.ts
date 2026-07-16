"use client";

const STORAGE_KEY = "dashboard-viewport-preview";

export type ViewportPreviewMode = "mobile" | "desktop";

const listeners = new Set<() => void>();

function readStored(): ViewportPreviewMode {
  if (typeof window === "undefined") return "desktop";
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === "mobile" || raw === "desktop") return raw;
  if (raw === "auto") return "desktop";
  return "desktop";
}

let previewMode: ViewportPreviewMode = readStored();

if (typeof document !== "undefined") {
  document.documentElement.dataset.viewportPreview = previewMode;
}

export function getViewportPreviewMode(): ViewportPreviewMode {
  return previewMode;
}

export function isViewportCompact(mode: ViewportPreviewMode = previewMode): boolean {
  return mode === "mobile";
}

export function setViewportPreviewMode(mode: ViewportPreviewMode): void {
  previewMode = mode;
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, mode);
    document.documentElement.dataset.viewportPreview = mode;
  }
  listeners.forEach((l) => l());
}

export function subscribeViewportPreview(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

/** 클라이언트 첫 로드 — html data 속성 동기화 */
export function syncViewportPreviewToDocument(mode: ViewportPreviewMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.viewportPreview = mode;
}
