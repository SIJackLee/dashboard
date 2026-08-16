"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { HealthNodeId, HealthSnapshot } from "@/lib/admin/health/types";

type OpsInspectorContextValue = {
  nodeId: HealthNodeId | null;
  snapshot: HealthSnapshot | null;
  openNode: (nodeId: HealthNodeId, snapshot: HealthSnapshot) => void;
  setSnapshot: (snapshot: HealthSnapshot) => void;
  close: () => void;
};

const OpsInspectorContext = createContext<OpsInspectorContextValue | null>(null);

export function OpsInspectorProvider({ children }: { children: React.ReactNode }) {
  const [nodeId, setNodeId] = useState<HealthNodeId | null>(null);
  const [snapshot, setSnapshotState] = useState<HealthSnapshot | null>(null);

  const openNode = useCallback((nextId: HealthNodeId, nextSnapshot: HealthSnapshot) => {
    setNodeId(nextId);
    setSnapshotState(nextSnapshot);
  }, []);

  const setSnapshot = useCallback((nextSnapshot: HealthSnapshot) => {
    setSnapshotState(nextSnapshot);
  }, []);

  const close = useCallback(() => {
    setNodeId(null);
  }, []);

  const value = useMemo(
    () => ({ nodeId, snapshot, openNode, setSnapshot, close }),
    [nodeId, snapshot, openNode, setSnapshot, close],
  );

  return (
    <OpsInspectorContext.Provider value={value}>
      {children}
    </OpsInspectorContext.Provider>
  );
}

export function useOpsInspector(): OpsInspectorContextValue {
  const ctx = useContext(OpsInspectorContext);
  if (!ctx) {
    throw new Error("useOpsInspector must be used within OpsInspectorProvider");
  }
  return ctx;
}

export function useOpsInspectorOptional(): OpsInspectorContextValue | null {
  return useContext(OpsInspectorContext);
}
