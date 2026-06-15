"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Map, List } from "lucide-react";
import type { BarnMapSnapshot } from "@/lib/data/iot";
import type { BarnReading } from "@/lib/data/iot";
import { FarmMapView } from "@/components/farm/farm-map-view";
import { BarnTable } from "@/components/barns/barn-table";
import { useDisplayEnabled } from "@/components/display/display-settings-provider";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  readings: BarnReading[];
  barnSnapshots: BarnMapSnapshot[];
  gridCols: number;
  gridRows: number;
};

export function FarmPageContent({
  readings,
  barnSnapshots,
  gridCols,
  gridRows,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "list" ? "list" : "map";
  const sp = searchParams.get("sp") ?? undefined;
  const showMap = useDisplayEnabled("farm.map");
  const showBarnTable = useDisplayEnabled("farm.barnTable");

  const setView = (next: "map" | "list", spCode?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("view");
    if (next === "list") params.set("view", "list");
    if (spCode) params.set("sp", spCode);
    else params.delete("sp");
    const q = params.toString();
    router.replace(q ? `/farm?${q}` : "/farm", { scroll: false });
  };

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "inline-flex rounded-xl border bg-muted/20 p-1",
          dashboardUi.body
        )}
        role="tablist"
        aria-label="농장 보기"
      >
        <button
          type="button"
          role="tab"
          aria-selected={view === "map"}
          disabled={!showMap}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-5 py-2.5 font-medium transition-colors",
            dashboardUi.tabNav,
            view === "map"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
            !showMap && "cursor-not-allowed opacity-40"
          )}
          onClick={() => showMap && setView("map", sp)}
        >
          <Map className={dashboardUi.iconSm} aria-hidden />
          지도
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "list"}
          disabled={!showBarnTable}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-5 py-2.5 font-medium transition-colors",
            dashboardUi.tabNav,
            view === "list"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
            !showBarnTable && "cursor-not-allowed opacity-40"
          )}
          onClick={() => showBarnTable && setView("list", sp)}
        >
          <List className={dashboardUi.iconSm} aria-hidden />
          목록
        </button>
      </div>

      {view === "map" && showMap ? (
        <FarmMapView
          barns={barnSnapshots}
          gridCols={gridCols}
          gridRows={gridRows}
        />
      ) : null}

      {view === "map" && !showMap ? (
        <p className={cn("rounded-xl border bg-muted/30 px-5 py-8", dashboardUi.body)}>
          농장 지도가 표시 설정에서 숨김 처리되어 있습니다. 설정 → 표시에서 변경할 수
          있습니다.
        </p>
      ) : null}

      {view === "list" && showBarnTable ? (
        <BarnTable rows={readings} initialSp={sp} />
      ) : null}

      {view === "list" && !showBarnTable ? (
        <p className={cn("rounded-xl border bg-muted/30 px-5 py-8", dashboardUi.body)}>
          축사 목록이 표시 설정에서 숨김 처리되어 있습니다. 설정 → 표시에서 변경할 수
          있습니다.
        </p>
      ) : null}
    </div>
  );
}
