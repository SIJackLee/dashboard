"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchFarmScopedPanelDataAction } from "@/app/(dashboard)/farm/actions";
import { AdminHubFarmSkeleton } from "@/components/common/loading-skeletons";
import { StaleWhileRevalidateShell } from "@/components/common/stale-while-revalidate-shell";
import { FarmPageContent } from "@/components/farm/farm-page-content";
import type { FarmKey } from "@/lib/data/farm-key";
import { farmKeyId } from "@/lib/data/farm-key";
import { farmShortLabel } from "@/lib/data/farm-summaries";
import {
  getFarmPanelCache,
  setFarmPanelCache,
} from "@/lib/farm/farm-panel-cache";
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

function resolveInitialPanel(
  farmId: string,
  farmKey: FarmKey | null,
  initialData: FarmScopedPanelData | null,
): FarmScopedPanelData | null {
  if (
    initialData &&
    farmKey &&
    farmKeyId(initialData.farmKey) === farmId
  ) {
    return initialData;
  }
  return getFarmPanelCache(farmId) ?? null;
}

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
  const [panelData, setPanelData] = useState<FarmScopedPanelData | null>(() =>
    resolveInitialPanel(farmId, farmKey, initialData),
  );
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    () => {
      const seeded = resolveInitialPanel(farmId, farmKey, initialData);
      return seeded ? "ready" : farmKey ? "loading" : "idle";
    },
  );
  const [revalidating, setRevalidating] = useState(false);

  const loadedScopeRef = useRef<string | null>(panelData ? farmId : null);
  const loadSeqRef = useRef(0);
  const scopeId = farmKey ? farmKeyId(farmKey) : null;

  const loadData = useCallback(
    (key: FarmKey, targetFarmId: string, options?: { background?: boolean }) => {
      const background = options?.background ?? false;
      const cached = getFarmPanelCache(targetFarmId);
      const seq = ++loadSeqRef.current;

      if (!background && !cached) {
        setStatus("loading");
      } else {
        setRevalidating(true);
        if (cached) {
          setPanelData(cached);
          setStatus("ready");
        }
      }

      void fetchFarmScopedPanelDataAction(key)
        .then((data) => {
          if (seq !== loadSeqRef.current) return;
          if (farmKeyId(data.farmKey) !== targetFarmId) return;
          loadedScopeRef.current = targetFarmId;
          setFarmPanelCache(targetFarmId, data);
          setPanelData(data);
          setStatus("ready");
        })
        .catch(() => {
          if (seq !== loadSeqRef.current) return;
          if (!getFarmPanelCache(targetFarmId)) {
            loadedScopeRef.current = null;
            setStatus("error");
          }
        })
        .finally(() => {
          if (seq === loadSeqRef.current) setRevalidating(false);
        });
    },
    [],
  );

  useEffect(() => {
    if (!farmKey || scopeId !== farmId) {
      loadSeqRef.current += 1;
      loadedScopeRef.current = null;
      setPanelData(null);
      setStatus("idle");
      setRevalidating(false);
      return;
    }

    if (initialData && farmKeyId(initialData.farmKey) === farmId) {
      loadedScopeRef.current = farmId;
      setFarmPanelCache(farmId, initialData);
      setPanelData(initialData);
      setStatus("ready");
      return;
    }

    const cached = getFarmPanelCache(farmId);
    if (cached && farmKeyId(cached.farmKey) === farmId) {
      loadedScopeRef.current = farmId;
      setPanelData(cached);
      setStatus("ready");
      loadData(farmKey, farmId, { background: true });
      return;
    }

    if (loadedScopeRef.current === farmId) {
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

  if ((status === "loading" || status === "idle") && !panelData) {
    return <AdminHubFarmSkeleton embedded={embedded} />;
  }

  if (status === "error" && !panelData) {
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
            dashboardUi.body,
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

  if (!panelData) {
    return <AdminHubFarmSkeleton embedded={embedded} />;
  }

  const isStale = revalidating && status === "ready";

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        embedded ? "h-full" : "min-h-0 flex-1",
      )}
      data-audit-region={
        embedded ? "admin-hub-farm-scoped-mobile" : "admin-hub-farm-scoped"
      }
    >
      {!embedded && !hideViewTabs ? (
        <p
          className={cn(
            "mb-2 shrink-0 truncate px-0.5 font-semibold text-foreground",
            dashboardUi.tableMeta,
          )}
        >
          {farmLabel} · 농장 현황
        </p>
      ) : null}
      <StaleWhileRevalidateShell
        stale={isStale}
        className={cn(
          "min-h-0 overflow-y-auto overscroll-contain",
          embedded ? "flex-1" : "flex-1",
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
      </StaleWhileRevalidateShell>
    </div>
  );
}
