"use client";

import { useCallback, useMemo, useState } from "react";
import type { HealthSnapshot, HealthNodeId } from "@/lib/admin/health/types";
import {
  HEALTH_UI,
  countHealthStatuses,
  worstHealthStatus,
} from "@/lib/admin/health/health-ui-labels";
import type { HealthDagNodeSelectPayload, PeekAnchor } from "@/lib/admin/health/health-node-peek-content";
import { HealthDagGraph } from "@/components/admin/health/health-dag-graph";
import { HealthFarmModulePanel } from "@/components/admin/health/health-farm-module-panel";
import { HealthNodeDetailDialog } from "@/components/admin/health/health-node-detail-dialog";
import { HealthNodePeekPopover } from "@/components/admin/health/health-node-peek-popover";
import { HealthOverallStatus } from "@/components/admin/health/health-overall-status";
import { HealthRefreshBar } from "@/components/admin/health/health-refresh-bar";
import { HealthSectionCard } from "@/components/admin/health/health-section-card";
import { dashboardControl } from "@/lib/ui/dashboard-page-ui";
import { useMobileLayout } from "@/lib/ui/use-mobile-layout";
import { cn } from "@/lib/utils";
type Props = {
  snapshot: HealthSnapshot;
};

type PeekState = {
  nodeId: HealthNodeId;
  anchor: PeekAnchor;
};

export function HealthSystemShell({ snapshot }: Props) {
  const isMobileLayout = useMobileLayout();
  const [peek, setPeek] = useState<PeekState | null>(null);
  const [dialogNodeId, setDialogNodeId] = useState<HealthNodeId | null>(null);
  const [farmPanelOpen, setFarmPanelOpen] = useState(false);
  const capWarn = snapshot.liveRowCount >= snapshot.liveRowLimit * 0.9;
  const moduleCounts = useMemo(
    () => countHealthStatuses(snapshot.modules),
    [snapshot.modules]
  );
  const overallStatus = worstHealthStatus(moduleCounts);

  const handleNodeSelect = useCallback(
    (payload: HealthDagNodeSelectPayload) => {
      if (isMobileLayout) {
        setDialogNodeId(payload.drillId);
        setPeek(null);
        return;
      }
      setPeek({ nodeId: payload.drillId, anchor: payload.anchor });
      setDialogNodeId(null);
    },
    [isMobileLayout]
  );

  const closePeek = useCallback(() => {
    setPeek(null);
    setDialogNodeId(null);
  }, []);

  const openDialogFromPeek = useCallback(() => {
    if (peek) setDialogNodeId(peek.nodeId);
  }, [peek]);

  const closeDialog = useCallback(() => {
    setDialogNodeId(null);
  }, []);

  const activeDrillId = dialogNodeId ?? peek?.nodeId ?? null;

  return (
    <div
      className={cn(
        "flex flex-col",
        farmPanelOpen
          ? "gap-2 md:gap-3"
          : "flex min-h-0 flex-1 flex-col overflow-hidden max-md:min-h-0 md:min-h-[calc(100vh-9rem)]"
      )}
    >
      <header className="mb-1 shrink-0 border-b pb-2 md:mb-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <HealthOverallStatus
            overallStatus={overallStatus}
            compact
            liveUsed={snapshot.liveRowCount}
            liveTotal={snapshot.liveRowLimit}
            liveWarn={capWarn}
          />
          <HealthRefreshBar
            key={snapshot.fetchedAt}
            fetchedAt={snapshot.fetchedAt}
            className="w-full shrink-0 sm:w-auto"
          />
        </div>
        {!snapshot.dbOk ? (
          <div className="mt-2 rounded-lg border border-amber-300/50 bg-amber-50 px-4 py-2 text-sm text-amber-900">
            SUPABASE_SERVICE_ROLE_KEY 또는 DB 연결이 필요합니다.
          </div>
        ) : null}
      </header>

      <div
        className={cn(
          "flex flex-col gap-2 md:gap-3",
          farmPanelOpen ? undefined : "min-h-0 flex-1 overflow-y-auto overscroll-contain"
        )}
      >
        <HealthSectionCard
          density="hub"
          title={HEALTH_UI.dataPath}
          className="w-full shrink-0"
          contentClassName="min-h-0"
        >
          <HealthDagGraph
            snapshot={snapshot}
            onNodeSelect={handleNodeSelect}
            activeDrillId={activeDrillId}
          />
        </HealthSectionCard>

        <HealthSectionCard
          density="hub"
          title={HEALTH_UI.farmModules}
          action={
            <button
              type="button"
              onClick={() => setFarmPanelOpen((v) => !v)}
              className={cn(
                dashboardControl.buttonOutline,
                "h-8 min-h-8 rounded-lg px-2.5 text-xs max-lg:text-xs lg:text-sm"
              )}
            >
              {farmPanelOpen ? "접기" : "펼치기"}
            </button>
          }
          className="w-full shrink-0"
          contentClassName={farmPanelOpen ? undefined : "hidden"}
        >
          {farmPanelOpen ? (
            <HealthFarmModulePanel modules={snapshot.modules} />
          ) : null}
        </HealthSectionCard>
      </div>

      {peek && !dialogNodeId && !isMobileLayout ? (
        <HealthNodePeekPopover
          nodeId={peek.nodeId}
          anchor={peek.anchor}
          snapshot={snapshot}
          onOpenDetail={openDialogFromPeek}
          onClose={closePeek}
        />
      ) : null}

      <HealthNodeDetailDialog
        nodeId={dialogNodeId}
        snapshot={snapshot}
        onClose={closeDialog}
      />
    </div>
  );
}
