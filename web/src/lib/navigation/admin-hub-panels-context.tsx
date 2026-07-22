"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import type { AdminFarmGridPanel } from "@/lib/farm/admin-all-farms-grid-shared";

type AdminHubPanelsContextValue = {
  panels: AdminFarmGridPanel[];
  ready: boolean;
  setPanels: (panels: AdminFarmGridPanel[]) => void;
  /** progressive hub hydrate — 기존 패널에 병합(동일 farmKey는 교체) */
  appendPanels: (panels: AdminFarmGridPanel[]) => void;
  /** SSR 이후 남은 farm keys — TailLoader가 hub 뷰에서 이어서 로드 */
  tailFarmKeys: FarmKey[];
  setTailFarmKeys: (keys: FarmKey[]) => void;
  getPanelByFarmKey: (farmKey: FarmKey) => AdminFarmGridPanel | undefined;
  hubUrlEpoch: number;
  notifyHubUrlChange: () => void;
};

const AdminHubPanelsContext = createContext<AdminHubPanelsContextValue | null>(
  null,
);

export function AdminHubPanelsProvider({ children }: { children: ReactNode }) {
  const [panels, setPanelsState] = useState<AdminFarmGridPanel[]>([]);
  const [ready, setReady] = useState(false);
  const [hubUrlEpoch, setHubUrlEpoch] = useState(0);
  const [tailFarmKeys, setTailFarmKeys] = useState<FarmKey[]>([]);

  const setPanels = useCallback((next: AdminFarmGridPanel[]) => {
    setPanelsState(next);
    setReady(next.length > 0);
  }, []);

  const appendPanels = useCallback((incoming: AdminFarmGridPanel[]) => {
    if (incoming.length === 0) return;
    setPanelsState((prev) => {
      const map = new Map(
        prev.map((p) => [farmKeyId(p.farmKey), p] as const),
      );
      for (const p of incoming) map.set(farmKeyId(p.farmKey), p);
      return [...map.values()];
    });
    setReady(true);
  }, []);

  const getPanelByFarmKey = useCallback(
    (farmKey: FarmKey) =>
      panels.find((p) => farmKeyId(p.farmKey) === farmKeyId(farmKey)),
    [panels],
  );

  const notifyHubUrlChange = useCallback(() => {
    setHubUrlEpoch((n) => n + 1);
  }, []);

  const value = useMemo(
    (): AdminHubPanelsContextValue => ({
      panels,
      ready,
      setPanels,
      appendPanels,
      tailFarmKeys,
      setTailFarmKeys,
      getPanelByFarmKey,
      hubUrlEpoch,
      notifyHubUrlChange,
    }),
    [
      panels,
      ready,
      setPanels,
      appendPanels,
      tailFarmKeys,
      getPanelByFarmKey,
      hubUrlEpoch,
      notifyHubUrlChange,
    ],
  );

  return (
    <AdminHubPanelsContext.Provider value={value}>
      {children}
    </AdminHubPanelsContext.Provider>
  );
}

export function useAdminHubPanels(): AdminHubPanelsContextValue {
  const ctx = useContext(AdminHubPanelsContext);
  if (!ctx) {
    throw new Error(
      "useAdminHubPanels must be used within AdminHubPanelsProvider",
    );
  }
  return ctx;
}

export function useAdminHubPanelsOptional(): AdminHubPanelsContextValue | null {
  return useContext(AdminHubPanelsContext);
}
