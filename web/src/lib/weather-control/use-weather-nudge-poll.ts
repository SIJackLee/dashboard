"use client";

import { useCallback, useEffect, useState } from "react";
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
  const farmId = farmKey ? farmKeyId(farmKey) : "";
  const resetToken = `${farmId}:${initial?.id ?? ""}:${enabled}`;
  const [appliedReset, setAppliedReset] = useState(resetToken);
  const [dismissed, setDismissed] = useState(false);
  const [nudge, setNudge] = useState<WeatherNudgeView | null>(
    enabled ? initial : null,
  );

  if (appliedReset !== resetToken) {
    setAppliedReset(resetToken);
    setDismissed(false);
    setNudge(enabled ? initial : null);
  }

  const dismissLocal = useCallback(() => {
    setDismissed(true);
    setNudge(null);
  }, []);

  useEffect(() => {
    if (!enabled || !farmKey || dismissed) return;

    let cancelled = false;

    async function poll() {
      if (cancelled || dismissed) return;
      try {
        const res = await fetch(
          `/api/weather-control/pending?farm=${encodeURIComponent(farmKeyId(farmKey!))}`,
          { credentials: "include" },
        );
        if (!res.ok || cancelled || dismissed) return;
        const json = (await res.json()) as {
          ok: boolean;
          pending: WeatherNudgeView | null;
        };
        if (!json.ok || cancelled || dismissed) return;
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
  }, [enabled, farmId, farmKey, dismissed]);

  return { nudge, dismissLocal };
}
