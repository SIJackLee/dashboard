"use client";

import { useEffect, useState } from "react";
import { appendFarmKeyParams } from "@/lib/data/farm-key";
import type { ControllerReading } from "@/lib/data/iot";

type DetailState = {
  reading: ControllerReading | undefined;
  loading: boolean;
  error: string | null;
};

export function useControllerDetail(
  base: ControllerReading | undefined,
): DetailState {
  const [detail, setDetail] = useState<Partial<ControllerReading> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!base) {
      setDetail(null);
      setLoading(false);
      setError(null);
      return;
    }

    const params = new URLSearchParams();
    appendFarmKeyParams(params, base.farmKey);
    params.set("module_uid", String(base.moduleUid));
    params.set("controller_key", base.controllerKey);

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/live/controller?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? `http_${res.status}`);
        }
        return res.json() as Promise<ControllerReading>;
      })
      .then((full) => {
        if (!cancelled) setDetail(full);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setDetail(null);
          setError(err instanceof Error ? err.message : "fetch_failed");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    base?.key,
    base?.farmKey.lsindRegistNo,
    base?.farmKey.itemCode,
    base?.moduleUid,
    base?.controllerKey,
  ]);

  if (!base) {
    return { reading: undefined, loading: false, error: null };
  }

  return {
    reading: detail ? { ...base, ...detail } : base,
    loading,
    error,
  };
}
