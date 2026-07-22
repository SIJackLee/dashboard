"use client";

import { useEffect, useRef } from "react";
import { fetchAdminHubGridBatchAction } from "@/app/(dashboard)/farm/actions";
import { useAdminHubPanels } from "@/lib/navigation/admin-hub-panels-context";
import { ADMIN_HUB_GRID_BATCH_SIZE } from "@/lib/farm/admin-all-farms-grid-shared";

/**
 * SSR 첫 배치 이후 나머지 농장 그리드를 클라이언트에서 배치 hydrate.
 * hubClientNav 전환 후에도 context.tailFarmKeys로 유지된다.
 */
export function AdminHubGridTailLoader() {
  const { appendPanels, tailFarmKeys, setTailFarmKeys } = useAdminHubPanels();
  const startedKeyRef = useRef<string>("");

  useEffect(() => {
    if (tailFarmKeys.length === 0) return;
    const runKey = tailFarmKeys
      .map((k) => `${k.lsindRegistNo}/${k.itemCode}`)
      .join(",");
    if (startedKeyRef.current === runKey) return;
    startedKeyRef.current = runKey;

    const keys = [...tailFarmKeys];
    let cancelled = false;

    void (async () => {
      for (let i = 0; i < keys.length; i += ADMIN_HUB_GRID_BATCH_SIZE) {
        if (cancelled) return;
        const batch = keys.slice(i, i + ADMIN_HUB_GRID_BATCH_SIZE);
        try {
          const panels = await fetchAdminHubGridBatchAction(batch);
          if (cancelled) return;
          appendPanels(panels);
        } catch {
          /* 배치 실패 시 다음 배치 계속 */
        }
      }
      if (!cancelled) setTailFarmKeys([]);
    })();

    return () => {
      cancelled = true;
    };
  }, [tailFarmKeys, appendPanels, setTailFarmKeys]);

  return null;
}
