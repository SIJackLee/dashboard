"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { FARM_GEO_MAP_SHELL } from "@/components/admin/farm-geo-map-shell";
import { FarmRegionPanel } from "@/components/admin/farm-region-panel";
import type { FarmLocationRow } from "@/lib/data/farm-location";
import {
  buildFarmMapPoints,
  clusterBySido,
  pointsWithoutLocation,
} from "@/lib/data/farm-geo-summary";
import { farmShortLabel, type FarmSummaryRow } from "@/lib/data/farm-summaries";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

const FarmGeoMap = dynamic(
  () =>
    import("@/components/admin/farm-geo-map").then((m) => m.FarmGeoMap),
  {
    ssr: false,
    loading: () => (
      <div
        className={cn(
          FARM_GEO_MAP_SHELL,
          "mx-0 w-full max-w-none flex items-center justify-center bg-muted/20"
        )}
      >
        <p className={cn("text-muted-foreground", dashboardUi.body)}>지도 로딩…</p>
      </div>
    ),
  }
);

type Props = {
  farms: FarmSummaryRow[];
  locations: FarmLocationRow[];
};

export function AdminFarmOverview({ farms, locations }: Props) {
  const [activeSido, setActiveSido] = useState<string | null>(null);

  const mapPoints = useMemo(
    () => buildFarmMapPoints(farms, locations, (farm) => farmShortLabel(farm.farmKey)),
    [farms, locations]
  );
  const clusters = useMemo(() => clusterBySido(mapPoints), [mapPoints]);
  const unlocatedFarms = useMemo(
    () => pointsWithoutLocation(farms, locations),
    [farms, locations]
  );
  const unlocatedCount = unlocatedFarms.length;

  return (
    <div className="flex w-full items-start gap-3">
      <div className="min-w-0 flex-1">
        <FarmGeoMap
          points={mapPoints}
          activeSido={activeSido}
          onSelectSido={setActiveSido}
          className="mx-0 w-full max-w-none"
        />
      </div>
      <FarmRegionPanel
        clusters={clusters}
        activeSido={activeSido}
        onSelectSido={setActiveSido}
        unlocatedCount={unlocatedCount}
        unlocatedFarms={unlocatedFarms}
      />
    </div>
  );
}
