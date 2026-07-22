"use client";

import { FarmMapView } from "@/components/farm/farm-map-view";
import type { AdminFarmGridPanel } from "@/lib/farm/admin-all-farms-grid-shared";
import { useAdminHubPanelsOptional } from "@/lib/navigation/admin-hub-panels-context";
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

export function AdminAllFarmsGridPanels({
  panels,
  locationOnlyHidden = 0,
  liveFromContext = false,
  consideredFarmCount,
}: Props) {
  const hub = useAdminHubPanelsOptional();
  const source =
    liveFromContext && hub && hub.panels.length > 0 ? hub.panels : panels;
  const livePanels = source.filter((p) => p.barnSnapshots.length > 0);
  const hidden =
    consideredFarmCount != null
      ? Math.max(0, consideredFarmCount - livePanels.length)
      : locationOnlyHidden;

  const awaitingClientHydrate =
    liveFromContext &&
    hub != null &&
    hub.panels.length === 0 &&
    (hub.tailFarmKeys.length > 0 ||
      (consideredFarmCount != null && consideredFarmCount > 0));

  if (livePanels.length === 0) {
    if (awaitingClientHydrate) {
      return (
        <div
          className={cn(
            "flex min-h-[16rem] flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center",
            dashboardUi.body,
          )}
          aria-busy
          data-audit-region="admin-hub-grid-loading"
        >
          <p className="font-medium text-foreground">농장 그리드 불러오는 중…</p>
          <p className="text-sm text-muted-foreground md:text-base">
            LIVE 축사 현황을 준비합니다.
          </p>
        </div>
      );
    }
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
      {hidden > 0 ? (
        <p className={cn("text-sm text-muted-foreground", dashboardUi.body)}>
          LIVE 축사가 있는 농장 {livePanels.length}곳만 표시 · 위치만 {hidden}
          곳 숨김
        </p>
      ) : null}
      {livePanels.map((panel) => (
        <section key={panel.farmKey.lsindRegistNo + panel.farmKey.itemCode}>
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
    </div>
  );
}
