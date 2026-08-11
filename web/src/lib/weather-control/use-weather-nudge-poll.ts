"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import type { WeatherNudgeView } from "@/lib/weather-control/weather-nudge-view";

const POLL_MS = 60_000;

export function useWeatherNudgePoll(
  farmKey: FarmKey | null,
  initial: WeatherNudgeView | null,
  enabled: boolean,
): {
  nudge: WeatherNudgeView | null;
  dismissLocal: () => void;
} {
  const [nudge, setNudge] = useState<WeatherNudgeView | null>(
    enabled ? initial : null,
  );
  const dismissedRef = useRef(false);
  const farmId = farmKey ? farmKeyId(farmKey) : "";

  useEffect(() => {
    dismissedRef.current = false;
    setNudge(enabled ? initial : null);
  }, [enabled, initial?.id, initial, farmId]);

  const dismissLocal = useCallback(() => {
    dismissedRef.current = true;
    setNudge(null);
  }, []);

  useEffect(() => {
    if (!enabled || !farmKey || dismissedRef.current) return;

    let cancelled = false;

    async function poll() {
      if (dismissedRef.current || cancelled) return;
      try {
        const res = await fetch(
          `/api/weather-control/pending?farm=${encodeURIComponent(farmKeyId(farmKey!))}`,
          { credentials: "include" },
        );
        if (!res.ok || cancelled || dismissedRef.current) return;
        const json = (await res.json()) as {
          ok: boolean;
          pending: WeatherNudgeView | null;
        };
        if (!json.ok || cancelled || dismissedRef.current) return;
        const pending = json.pending;
        if (!pending || pending.stale) {
          setNudge(null);
          return;
        }
        setNudge(pending);
      } catch {
        // network blip — keep last nudge
      }
    }

    void poll();
    const timer = window.setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, farmId, farmKey]);

  return { nudge, dismissLocal };
}
