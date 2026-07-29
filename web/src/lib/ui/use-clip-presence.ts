"use client";

import { useEffect, useState } from "react";
import { motionDuration } from "@/lib/ui/motion-tokens";

export type ClipPhase = "enter" | "shown" | "exit";

export type ClipPresenceEntry<T> = {
  key: string;
  phase: ClipPhase;
  item: T;
};

type Options = {
  enabled?: boolean;
  enterMs?: number;
  exitMs?: number;
};

/**
 * 시리즈/히스토그램 키 단위 enter·exit 유지.
 * 첫 마운트는 wipe 없이 shown, 이후 추가/삭제만 클립 와이프.
 */
export function useClipPresence<T>(
  items: T[],
  getKey: (item: T) => string,
  options: Options = {},
): ClipPresenceEntry<T>[] {
  const {
    enabled = true,
    enterMs = motionDuration.moderate,
    exitMs = motionDuration.moderate,
  } = options;

  const liveKeys = items.map(getKey);
  const liveKeyStr = liveKeys.join("\0");
  const itemByKey = new Map(items.map((item) => [getKey(item), item]));

  const [trackedLive, setTrackedLive] = useState(liveKeyStr);
  const [entries, setEntries] = useState<ClipPresenceEntry<T>[]>(() =>
    liveKeys.map((key) => ({
      key,
      phase: "shown" as const,
      item: itemByKey.get(key)!,
    })),
  );

  if (enabled && liveKeyStr !== trackedLive) {
    setTrackedLive(liveKeyStr);
    const liveSet = new Set(liveKeys);
    setEntries((prev) => {
      const prevByKey = new Map(prev.map((e) => [e.key, e]));
      const next: ClipPresenceEntry<T>[] = [];
      for (const key of liveKeys) {
        const item = itemByKey.get(key)!;
        const old = prevByKey.get(key);
        if (!old || old.phase === "exit") {
          next.push({ key, phase: "enter", item });
        } else {
          next.push({
            key,
            phase: old.phase === "enter" ? "enter" : "shown",
            item,
          });
        }
      }
      for (const e of prev) {
        if (!liveSet.has(e.key)) {
          next.push({
            key: e.key,
            phase: "exit",
            item: e.item,
          });
        }
      }
      return next;
    });
  }

  const phaseKey = entries.map((e) => `${e.key}:${e.phase}`).join("|");

  useEffect(() => {
    if (!enabled) return;
    const timers: number[] = [];
    for (const e of entries) {
      if (e.phase === "enter") {
        timers.push(
          window.setTimeout(() => {
            setEntries((prev) =>
              prev.map((x) =>
                x.key === e.key && x.phase === "enter"
                  ? { ...x, phase: "shown" }
                  : x,
              ),
            );
          }, enterMs),
        );
      } else if (e.phase === "exit") {
        timers.push(
          window.setTimeout(() => {
            setEntries((prev) => prev.filter((x) => x.key !== e.key));
          }, exitMs),
        );
      }
    }
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- phaseKey tracks enter/exit
  }, [enabled, enterMs, exitMs, phaseKey]);

  if (!enabled) {
    return liveKeys.map((key) => ({
      key,
      phase: "shown" as const,
      item: itemByKey.get(key)!,
    }));
  }

  return entries.map((e) => ({
    key: e.key,
    phase: e.phase,
    item:
      e.phase === "exit" ? e.item : (itemByKey.get(e.key) ?? e.item),
  }));
}
