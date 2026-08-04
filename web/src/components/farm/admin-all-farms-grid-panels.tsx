"use client";

import { useCallback, useEffect, useRef } from "react";
import { FarmMapView } from "@/components/farm/farm-map-view";
import type { AdminFarmGridPanel } from "@/lib/farm/admin-all-farms-grid-shared";
import { useAdminHubPanelsOptional } from "@/lib/navigation/admin-hub-panels-context";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import { farmShortLabel } from "@/lib/data/farm-summaries";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  panels: AdminFarmGridPanel[];
  /** farmOptions 중 LIVE 축사 없어 숨긴 수 (위치만 등록) */
  locationOnlyHidden?: number;
  /** progressive hydrate — context panels를 우선 표시 */
  liveFromContext?: boolean;
  /** LIVE 후보 농장 수 — hidden = considered - live */
  consideredFarmCount?: number;
};

function HubFarmPlaceholder({
  farmKey,
  onVisible,
}: {
  farmKey: FarmKey;
  onVisible: (farmKey: FarmKey) => void;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          onVisible(farmKey);
        }
      },
      { rootMargin: "240px 0px", threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [farmKey, onVisible]);

  return (
    <section
      ref={ref}
      data-farm-key={farmKeyId(farmKey)}
      className={cn(
        "min-h-[12rem] rounded-xl border border-dashed bg-muted/20 px-4 py-8",
        dashboardUi.body,
      )}
      aria-busy
    >
      <p className="font-medium text-foreground">{farmShortLabel(farmKey)}</p>
      <p className="mt-1 text-sm text-muted-foreground">그리드 불러오는 중…</p>
    </section>
  );
}

export function AdminAllFarmsGridPanels({
  panels,
  locationOnlyHidden = 0,
  liveFromContext = false,
  consideredFarmCount,
}: Props) {
  const hub = useAdminHubPanelsOptional();
  const requestPriorityFarmKeys = hub?.requestPriorityFarmKeys;
  const source =
    liveFromContext && hub && hub.panels.length > 0 ? hub.panels : panels;
  const livePanels = source.filter((p) => p.barnSnapshots.length > 0);
  const loadedIds = new Set(source.map((p) => farmKeyId(p.farmKey)));
  const pendingKeys =
    liveFromContext && hub
      ? hub.hubFarmKeys.filter((k) => !loadedIds.has(farmKeyId(k)))
      : [];
  const stillHydrating =
    liveFromContext &&
    hub != null &&
    (hub.tailFarmKeys.length > 0 ||
      (hub.hubFarmKeys.length > 0 && !hub.ready && livePanels.length === 0));
  const placeholderKeys =
    pendingKeys.length > 0
      ? pendingKeys
      : stillHydrating && hub
        ? hub.hubFarmKeys
        : [];
  const hidden =
    consideredFarmCount != null
      ? Math.max(0, consideredFarmCount - livePanels.length - pendingKeys.length)
      : locationOnlyHidden;

  const onPlaceholderVisible = useCallback(
    (farmKey: FarmKey) => {
      requestPriorityFarmKeys?.([farmKey]);
    },
    [requestPriorityFarmKeys],
  );

  if (livePanels.length === 0 && placeholderKeys.length === 0) {
    return (
      <div
        className={cn(
          "flex min-h-[16rem] flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center",
          dashboardUi.body,
        )}
      >
        <p className="font-medium text-foreground">
          표시할 농장 그리드가 없습니다.
        </p>
        <p className="text-sm text-muted-foreground md:text-base">
          LIVE 데이터·축사유형이 수신되면 farm별 그리드가 여기에 표시됩니다.
          {hidden > 0
            ? ` (위치만 등록된 농장 ${hidden}곳은 숨김)`
            : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {hidden > 0 && livePanels.length > 0 && pendingKeys.length === 0 ? (
        <p className={cn("text-sm text-muted-foreground", dashboardUi.body)}>
          LIVE 축사가 있는 농장 {livePanels.length}곳만 표시 · 위치만 {hidden}
          곳 숨김
        </p>
      ) : null}
      {livePanels.map((panel) => (
        <section key={farmKeyId(panel.farmKey)}>
          <FarmMapView
            barns={panel.barnSnapshots}
            readings={panel.readings}
            gridCols={panel.gridCols}
            gridRows={panel.gridRows}
            compactShell
            navigateFarmKey={panel.farmKey}
            sectionTitle={farmShortLabel(panel.farmKey)}
          />
        </section>
      ))}
      {placeholderKeys.map((farmKey) => (
        <HubFarmPlaceholder
          key={farmKeyId(farmKey)}
          farmKey={farmKey}
          onVisible={onPlaceholderVisible}
        />
      ))}
    </div>
  );
}
