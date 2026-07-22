"use client";

import { FarmMapView } from "@/components/farm/farm-map-view";
import type { AdminFarmGridPanel } from "@/lib/farm/admin-all-farms-grid-shared";
import { farmShortLabel } from "@/lib/data/farm-summaries";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  panels: AdminFarmGridPanel[];
  /** farmOptions 중 LIVE 축사 없어 숨긴 수 (위치만 등록) */
  locationOnlyHidden?: number;
};

export function AdminAllFarmsGridPanels({
  panels,
  locationOnlyHidden = 0,
}: Props) {
  const livePanels = panels.filter((p) => p.barnSnapshots.length > 0);

  if (livePanels.length === 0) {
    return (
      <div
        className={cn(
          "flex min-h-[16rem] flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center",
          dashboardUi.body
        )}
      >
        <p className="font-medium text-foreground">표시할 농장 그리드가 없습니다.</p>
        <p className="text-sm text-muted-foreground md:text-base">
          LIVE 데이터·축사유형이 수신되면 farm별 그리드가 여기에 표시됩니다.
          {locationOnlyHidden > 0
            ? ` (위치만 등록된 농장 ${locationOnlyHidden}곳은 숨김)`
            : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {locationOnlyHidden > 0 ? (
        <p className={cn("text-sm text-muted-foreground", dashboardUi.body)}>
          LIVE 축사가 있는 농장 {livePanels.length}곳만 표시 · 위치만{" "}
          {locationOnlyHidden}곳 숨김
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
