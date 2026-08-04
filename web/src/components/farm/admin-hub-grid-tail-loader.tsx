"use client";

import { useEffect, useRef } from "react";
import { fetchAdminHubGridBatchAction } from "@/app/(dashboard)/farm/actions";
import { useAdminHubPanels } from "@/lib/navigation/admin-hub-panels-context";
import { ADMIN_HUB_GRID_BATCH_SIZE } from "@/lib/farm/admin-all-farms-grid-shared";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";

function emptyPanel(farmKey: FarmKey) {
  return {
    farmKey,
    readings: [],
    barnSnapshots: [],
    gridCols: 4,
    gridRows: 4,
  };
}

/**
 * Hub 그리드 progressive hydrate.
 * Phase C — viewport 우선 큐: visible ∩ remaining → 목록 순 나머지.
 */
export function AdminHubGridTailLoader() {
  const {
    appendPanels,
    tailFarmKeys,
    setTailFarmKeys,
    takePriorityFarmKeys,
  } = useAdminHubPanels();
  const startedKeyRef = useRef<string>("");

  useEffect(() => {
    if (tailFarmKeys.length === 0) return;
    const runKey = tailFarmKeys
      .map((k) => `${k.lsindRegistNo}/${k.itemCode}`)
      .join(",");
    if (startedKeyRef.current === runKey) return;
    startedKeyRef.current = runKey;

    const remaining = new Map(
      tailFarmKeys.map((k) => [farmKeyId(k), k] as const),
    );
    let cancelled = false;

    const nextBatch = (): FarmKey[] => {
      const priority = takePriorityFarmKeys().filter((k) =>
        remaining.has(farmKeyId(k)),
      );
      const ordered: FarmKey[] = [];
      const seen = new Set<string>();
      for (const k of priority) {
        const id = farmKeyId(k);
        if (seen.has(id) || !remaining.has(id)) continue;
        seen.add(id);
        ordered.push(k);
      }
      for (const k of remaining.values()) {
        const id = farmKeyId(k);
        if (seen.has(id)) continue;
        seen.add(id);
        ordered.push(k);
      }
      return ordered.slice(0, ADMIN_HUB_GRID_BATCH_SIZE);
    };

    void (async () => {
      while (remaining.size > 0) {
        if (cancelled) return;
        const batch = nextBatch();
        if (batch.length === 0) break;
        try {
          const panels = await fetchAdminHubGridBatchAction(batch);
          if (cancelled) return;
          appendPanels(panels);
        } catch {
          if (cancelled) return;
          appendPanels(batch.map(emptyPanel));
        }
        for (const k of batch) remaining.delete(farmKeyId(k));
      }
      if (!cancelled) setTailFarmKeys([]);
    })();

    return () => {
      cancelled = true;
      // hydrate wipe 후 같은 키로 재시작 가능하도록
      if (startedKeyRef.current === runKey) {
        startedKeyRef.current = "";
      }
    };
  }, [tailFarmKeys, appendPanels, setTailFarmKeys, takePriorityFarmKeys]);

  return null;
}
