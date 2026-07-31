"use client";

import { useSyncExternalStore } from "react";
import type { AlarmRow } from "@/lib/data/alarms";

/**
 * FarmLiveRefreshProvider(페이지 children) → TopBar/FAB(PageShell 밖) 알람 브리지.
 * Context로 못 올리므로 모듈 구독으로 전달한다.
 */
let published: AlarmRow[] | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function publishShellAlarms(next: AlarmRow[]): void {
  published = next;
  emit();
}

/** Provider unmount · farm 이탈 시 SSR props로 되돌림 */
export function clearShellAlarms(): void {
  if (published == null) return;
  published = null;
  emit();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function getSnapshot(fallback: AlarmRow[]): AlarmRow[] {
  return published ?? fallback;
}

/**
 * LIVE/설정 패치가 있으면 그걸, 없으면 PageShell SSR `alarms` 사용.
 */
export function useShellAlarms(fallback: AlarmRow[]): AlarmRow[] {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot(fallback),
    () => fallback,
  );
}
