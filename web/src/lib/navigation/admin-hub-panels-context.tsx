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

  const setPanels = useCallback((next: AdminFarmGridPanel[]) => {
    setPanelsState(next);
    setReady(next.length > 0);
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
      getPanelByFarmKey,
      hubUrlEpoch,
      notifyHubUrlChange,
    }),
    [
      panels,
      ready,
      setPanels,
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
