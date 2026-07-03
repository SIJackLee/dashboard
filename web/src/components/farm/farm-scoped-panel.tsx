"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchFarmScopedPanelDataAction } from "@/app/(dashboard)/farm/actions";
import { FarmPageContent } from "@/components/farm/farm-page-content";
import type { FarmKey } from "@/lib/data/farm-key";
import { farmKeyId } from "@/lib/data/farm-key";
import { farmShortLabel } from "@/lib/data/farm-summaries";
import type { FarmScopedPanelData } from "@/lib/farm/load-farm-scoped-panel-data";
import type { HubBarnLayoutPrefs } from "@/lib/monitoring/hub-view-state";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  farmId: string;
  farmKey: FarmKey | null;
  layoutPrefs: HubBarnLayoutPrefs;
  initialData?: FarmScopedPanelData | null;
  embedded?: boolean;
  hubMode?: boolean;
  hideViewTabs?: boolean;
  deepLinkSp?: string | null;
  deepLinkStallNo?: string | null;
  deepLinkMapLevel?: "sp" | "stalls";
  hubUrlEpoch?: number;
  onHubUrlChange?: () => void;
};

export function FarmScopedPanel({
  farmId,
  farmKey,
  layoutPrefs: _layoutPrefs,
  initialData = null,
  embedded = false,
  hubMode = false,
  hideViewTabs = false,
  deepLinkSp,
  deepLinkStallNo,
  deepLinkMapLevel,
  hubUrlEpoch = 0,
  onHubUrlChange,
}: Props) {
  const [panelData, setPanelData] = useState<FarmScopedPanelData | null>(
    initialData &&
      farmKey &&
      farmKeyId(initialData.farmKey) === farmId
      ? initialData
      : null
  );
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    () => (panelData ? "ready" : farmKey ? "loading" : "idle")
  );

  const loadedScopeRef = useRef<string | null>(null);
  const loadSeqRef = useRef(0);
  const scopeId = farmKey ? farmKeyId(farmKey) : null;

  const loadData = useCallback((key: FarmKey, targetFarmId: string) => {
    const seq = ++loadSeqRef.current;
    setStatus("loading");
    setPanelData(null);
    void fetchFarmScopedPanelDataAction(key)
      .then((data) => {
        if (seq !== loadSeqRef.current) return;
        if (farmKeyId(data.farmKey) !== targetFarmId) return;
        loadedScopeRef.current = targetFarmId;
        setPanelData(data);
        setStatus("ready");
      })
      .catch(() => {
        if (seq !== loadSeqRef.current) return;
        loadedScopeRef.current = null;
        setStatus("error");
      });
  }, []);

  useEffect(() => {
    if (!farmKey || scopeId !== farmId) {
      loadSeqRef.current += 1;
      loadedScopeRef.current = null;
      setPanelData(null);
      setStatus("idle");
      return;
    }
    if (loadedScopeRef.current === farmId) {
      return;
    }
    if (initialData && farmKeyId(initialData.farmKey) === farmId) {
      loadedScopeRef.current = farmId;
      setPanelData(initialData);
      setStatus("ready");
      return;
    }
    loadedScopeRef.current = farmId;
    loadData(farmKey, farmId);
  }, [farmId, scopeId, farmKey, initialData, loadData]);

  const farmLabel = useMemo(() => {
    if (panelData) return farmShortLabel(panelData.farmKey);
    if (farmKey) return farmShortLabel(farmKey);
    return farmId;
  }, [panelData, farmKey, farmId]);

  if (!farmKey) {
    return (
      <p className={cn("py-8 text-center text-muted-foreground", dashboardUi.body)}>
        농장 데이터를 불러올 수 없습니다.
      </p>
    );
  }

  if (status === "loading" || status === "idle") {
    return (
      <div
        className={cn(
          "min-h-[8rem] animate-pulse rounded-xl border bg-muted/15",
          embedded ? "h-full min-h-[12rem]" : "min-h-[16rem]"
        )}
        data-audit-region={
          embedded ? "admin-hub-farm-scoped-mobile" : "admin-hub-farm-scoped"
        }
      />
    );
  }

  if (status === "error" || !panelData) {
    return (
      <div
        className="flex min-h-[8rem] flex-col items-center justify-center gap-3 rounded-xl border bg-muted/10 p-6"
        data-audit-region={
          embedded ? "admin-hub-farm-scoped-mobile" : "admin-hub-farm-scoped"
        }
      >
        <p className={cn("text-muted-foreground", dashboardUi.body)}>
          농장 현황을 불러오지 못했습니다.
        </p>
        <button
          type="button"
          className={cn(
            "rounded-lg border bg-background px-4 py-2 font-medium hover:bg-muted/40",
            dashboardUi.body
          )}
          onClick={() => {
            loadedScopeRef.current = null;
            loadData(farmKey, farmId);
          }}
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        embedded ? "h-full" : "min-h-0 flex-1"
      )}
      data-audit-region={
        embedded ? "admin-hub-farm-scoped-mobile" : "admin-hub-farm-scoped"
      }
    >
      {!embedded && !hideViewTabs ? (
        <p
          className={cn(
            "mb-2 shrink-0 truncate px-0.5 font-semibold text-foreground",
            dashboardUi.tableMeta
          )}
        >
          {farmLabel} · 농장 현황
        </p>
      ) : null}
      <div
        className={cn(
          "min-h-0 overflow-y-auto overscroll-contain",
          embedded ? "flex-1" : "flex-1"
        )}
      >
        <FarmPageContent
          key={farmId}
          readings={panelData.readings}
          barnSnapshots={panelData.barnSnapshots}
          gridCols={panelData.gridCols}
          gridRows={panelData.gridRows}
          trendByPeriod={panelData.trendByPeriod}
          controller={panelData.controller}
          hubMode={hubMode}
          hideViewTabs={hideViewTabs}
          deepLinkSp={deepLinkSp}
          deepLinkStallNo={deepLinkStallNo}
          deepLinkMapLevel={deepLinkMapLevel}
          hubUrlEpoch={hubUrlEpoch}
          onHubUrlChange={onHubUrlChange}
        />
      </div>
    </div>
  );
}
