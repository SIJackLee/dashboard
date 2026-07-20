"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { HealthSnapshot, HealthNodeId, HealthStatus } from "@/lib/admin/health/types";
import {
  HEALTH_UI,
  countHealthStatuses,
  worstHealthStatus,
} from "@/lib/admin/health/health-ui-labels";
import { parseHealthNodeId } from "@/lib/admin/health/health-routes";
import { farmKeyUrlSlug } from "@/lib/data/farm-key";
import type {
  HealthDagNodeSelectPayload,
  PeekAnchor,
} from "@/lib/admin/health/health-node-peek-content";
import { HealthDagGraph } from "@/components/admin/health/health-dag-graph";
import { HealthDataPathStrip } from "@/components/admin/health/health-data-path-strip";
import { HealthFarmModulePanel } from "@/components/admin/health/health-farm-module-panel";
import { HealthNodeDetailDialog } from "@/components/admin/health/health-node-detail-dialog";
import { HealthNodePeekPopover } from "@/components/admin/health/health-node-peek-popover";
import { HealthOverallStatus } from "@/components/admin/health/health-overall-status";
import { HealthRefreshBar } from "@/components/admin/health/health-refresh-bar";
import { opsControl, opsTypography } from "@/lib/ui/dashboard-page-ui";
import { useMobileLayout } from "@/lib/ui/use-mobile-layout";
import { cn } from "@/lib/utils";

type Props = {
  snapshot: HealthSnapshot;
};

type PeekState = {
  nodeId: HealthNodeId;
  anchor: PeekAnchor;
};

function needsAttention(status: HealthStatus): boolean {
  return status === "warn" || status === "critical" || status === "unknown";
}

const SUPPRESS_AUTO_KEY = "ops-health-suppress-auto";

function readSuppressKey(): string | null {
  try {
    return sessionStorage.getItem(SUPPRESS_AUTO_KEY);
  } catch {
    return null;
  }
}

function writeSuppressKey(key: string | null) {
  try {
    if (key) sessionStorage.setItem(SUPPRESS_AUTO_KEY, key);
    else sessionStorage.removeItem(SUPPRESS_AUTO_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

export function HealthSystemShell({ snapshot }: Props) {
  const isMobileLayout = useMobileLayout();
  const searchParams = useSearchParams();
  const queryNodeId = parseHealthNodeId(searchParams.get("node"));
  const queryFarmId = searchParams.get("farm")?.trim() || null;
  const queryModulesOpen = searchParams.get("modules") === "1";
  const [peek, setPeek] = useState<PeekState | null>(null);
  const [manualDialog, setManualDialog] = useState<HealthNodeId | null>(null);
  const [urlDialogDismissed, setUrlDialogDismissed] = useState(false);
  const [seenQueryNode, setSeenQueryNode] = useState(queryNodeId);
  const [userDetailOpen, setUserDetailOpen] = useState(false);
  const [suppressAutoKey, setSuppressAutoKey] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readSuppressKey(),
  );

  const moduleCounts = useMemo(
    () => countHealthStatuses(snapshot.modules),
    [snapshot.modules],
  );
  const overallStatus = worstHealthStatus(moduleCounts);
  const pipelineBad = snapshot.pipeline.some((n) => needsAttention(n.status));
  const autoDetail =
    queryModulesOpen || Boolean(queryFarmId) || pipelineBad || needsAttention(overallStatus);
  const autoKey = `${queryFarmId ?? ""}|${queryModulesOpen}|${overallStatus}|${pipelineBad}`;
  const detailOpen =
    userDetailOpen || (autoDetail && suppressAutoKey !== autoKey);

  if (queryNodeId !== seenQueryNode) {
    setSeenQueryNode(queryNodeId);
    setUrlDialogDismissed(false);
    setManualDialog(null);
  }

  const dialogNodeId =
    manualDialog ?? (urlDialogDismissed ? null : queryNodeId);

  const capWarn = snapshot.liveRowCount >= snapshot.liveRowLimit * 0.9;
  const showAlert = needsAttention(overallStatus) || pipelineBad;

  const handleNodeSelect = useCallback(
    (payload: HealthDagNodeSelectPayload) => {
      if (isMobileLayout) {
        setManualDialog(payload.drillId);
        setPeek(null);
        return;
      }
      setPeek({ nodeId: payload.drillId, anchor: payload.anchor });
      setManualDialog(null);
    },
    [isMobileLayout],
  );

  const closePeek = useCallback(() => {
    setPeek(null);
    setManualDialog(null);
  }, []);

  const openDialogFromPeek = useCallback(() => {
    if (peek) setManualDialog(peek.nodeId);
  }, [peek]);

  const closeDialog = useCallback(() => {
    setManualDialog(null);
    if (queryNodeId) setUrlDialogDismissed(true);
  }, [queryNodeId]);

  const toggleDetail = useCallback(() => {
    if (detailOpen) {
      setUserDetailOpen(false);
      if (autoDetail) {
        setSuppressAutoKey(autoKey);
        writeSuppressKey(autoKey);
      }
    } else {
      setUserDetailOpen(true);
      setSuppressAutoKey(null);
      writeSuppressKey(null);
    }
  }, [detailOpen, autoDetail, autoKey]);

  useEffect(() => {
    if (!queryFarmId || !detailOpen) return;
    const slug = farmKeyUrlSlug(queryFarmId);
    const timer = window.setTimeout(() => {
      document
        .querySelector(`[data-health-farm-id="${slug}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [queryFarmId, detailOpen, snapshot.modules.length]);

  const activeDrillId = dialogNodeId ?? peek?.nodeId ?? null;

  const detailPanel = detailOpen ? (
    <div className="mt-3 flex flex-col gap-3 border-t pt-3">
      <HealthDagGraph
        snapshot={snapshot}
        onNodeSelect={handleNodeSelect}
        activeDrillId={activeDrillId}
      />
      <div>
        <p className={cn("mb-2 font-semibold", opsTypography.meta)}>
          {HEALTH_UI.farmModules}
        </p>
        <HealthFarmModulePanel
          modules={snapshot.modules}
          highlightFarmId={queryFarmId}
        />
      </div>
    </div>
  ) : null;

  const dbWarn = !snapshot.dbOk ? (
    <div
      className={cn(
        "rounded-lg border border-amber-300/50 bg-amber-50 px-4 py-2 text-amber-900",
        opsTypography.alert,
        isMobileLayout ? "mt-2" : "mt-2",
      )}
    >
      SUPABASE_SERVICE_ROLE_KEY 또는 DB 연결이 필요합니다.
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-2 md:gap-3">
      <div
        className={cn(
          "w-full shrink-0 rounded-xl border",
          showAlert
            ? "border-amber-400/70 bg-amber-50/40 dark:bg-amber-950/20"
            : "border-border/70 bg-muted/15",
        )}
      >
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 px-3",
            showAlert || detailOpen ? "py-2" : "py-1.5",
          )}
        >
          <div className="min-w-0 flex-1">
            <HealthOverallStatus
              overallStatus={overallStatus}
              compact
              liveUsed={snapshot.liveRowCount}
              liveTotal={snapshot.liveRowLimit}
              liveWarn={capWarn}
            />
          </div>
          <HealthRefreshBar
            key={snapshot.fetchedAt}
            fetchedAt={snapshot.fetchedAt}
            compact
            className="shrink-0"
          />
          <button
            type="button"
            onClick={toggleDetail}
            className={cn(opsControl.buttonOutline, "shrink-0 border")}
          >
            {detailOpen ? "상세 접기" : "상세"}
          </button>
        </div>
        {!showAlert && !detailOpen ? null : (
          <div className="px-3 pb-2">
            <HealthDataPathStrip
              snapshot={snapshot}
              onNodeSelect={handleNodeSelect}
              activeDrillId={activeDrillId}
              compactCollectors={!detailOpen}
            />
          </div>
        )}
        {showAlert ? (
          <p
            className={cn(
              "border-t border-amber-300/40 px-3 py-1.5 font-medium text-amber-950 dark:text-amber-100",
              opsTypography.meta,
            )}
          >
            이상 감지 — 상세에서 DAG·모듈을 확인하세요.
          </p>
        ) : null}
        {dbWarn ? <div className="px-3 pb-2">{dbWarn}</div> : null}
        {detailOpen ? <div className="px-3 pb-3">{detailPanel}</div> : null}
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
