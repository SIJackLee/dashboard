"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Map, List } from "lucide-react";
import type { BarnMapSnapshot } from "@/lib/data/iot";
import type { BarnReading } from "@/lib/data/iot";
import type { TrendPeriodData, TrendPeriodId } from "@/lib/data/farm-trend-types";
import type { ControllerGridData } from "@/components/farm/farm-map-controller-panel";
import { FarmMapView } from "@/components/farm/farm-map-view";
import { BarnTable } from "@/components/farm/barn-table";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  readings: BarnReading[];
  barnSnapshots: BarnMapSnapshot[];
  gridCols: number;
  gridRows: number;
  trendByPeriod?: Record<TrendPeriodId, TrendPeriodData> | null;
  controller?: ControllerGridData | null;
};

export function FarmPageContent({
  readings,
  barnSnapshots,
  gridCols,
  gridRows,
  trendByPeriod,
  controller,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "list" ? "list" : "map";
  const sp = searchParams.get("sp") ?? undefined;

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
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-5 py-2.5 font-medium transition-colors",
            dashboardUi.tabNav,
            view === "map"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setView("map", sp)}
        >
          <Map className={dashboardUi.iconSm} aria-hidden />
          지도
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "list"}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-5 py-2.5 font-medium transition-colors",
            dashboardUi.tabNav,
            view === "list"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setView("list", sp)}
        >
          <List className={dashboardUi.iconSm} aria-hidden />
          목록
        </button>
      </div>

      {view === "map" ? (
        <div className="max-h-[40dvh] min-h-0 overflow-hidden lg:max-h-none lg:min-h-[16rem]">
          <FarmMapView
            barns={barnSnapshots}
            gridCols={gridCols}
            gridRows={gridRows}
            trendByPeriod={trendByPeriod}
            controller={controller}
          />
        </div>
      ) : (
        <BarnTable rows={readings} initialSp={sp} />
      )}
    </div>
  );
}
