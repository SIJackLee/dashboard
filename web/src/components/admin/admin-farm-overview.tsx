"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import {
  FARM_GEO_MAP_HUB_SHELL,
  FARM_GEO_MAP_SHELL,
} from "@/components/admin/farm-geo-map-shell";
import type { FarmLocationRow } from "@/lib/data/farm-location";
import { buildFarmMapPoints } from "@/lib/data/farm-geo-summary";
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
          "mx-0 flex w-full max-w-none items-center justify-center bg-muted/20"
        )}
      >
        <p className={cn("text-muted-foreground", dashboardUi.body)}>지도 로딩…</p>
      </div>
    ),
  }
);

type HubProps = {
  layout: "hub";
  farms: FarmSummaryRow[];
  locations: FarmLocationRow[];
  activeSido: string | null;
  onSelectSido: (sido: string | null) => void;
  className?: string;
  /** 모바일 허브 — 선택 농장 마커 강조 (지도 pan/fly 없음) */
  focusFarmId?: string | null;
  /** Z4/4 농장 카드 클릭 → 바텀 nav */
  onSelectFarm?: (farmId: string) => void;
};

type StandaloneProps = {
  layout?: "standalone";
  farms: FarmSummaryRow[];
  locations: FarmLocationRow[];
  activeSido?: string | null;
  onSelectSido?: (sido: string | null) => void;
  className?: string;
};

type Props = HubProps | StandaloneProps;

function isHubLayout(props: Props): props is HubProps {
  return props.layout === "hub";
}

export function AdminFarmOverview(props: Props) {
  const { farms, locations, className } = props;
  const hub = isHubLayout(props);
  const activeSido = hub ? props.activeSido : (props.activeSido ?? null);
  const onSelectSido = hub ? props.onSelectSido : (props.onSelectSido ?? (() => {}));

  const mapPoints = useMemo(
    () => buildFarmMapPoints(farms, locations, (farm) => farmShortLabel(farm.farmKey)),
    [farms, locations]
  );

  if (hub) {
    return (
      <div className={cn(FARM_GEO_MAP_HUB_SHELL, className)}>
        <FarmGeoMap
          points={mapPoints}
          activeSido={activeSido}
          onSelectSido={onSelectSido}
          focusFarmId={props.focusFarmId ?? null}
          onSelectFarm={props.onSelectFarm}
          showLegend={false}
          shellClassName="absolute inset-0 h-full w-full overflow-hidden rounded-xl border-0 bg-transparent"
          className="h-full w-full"
        />
      </div>
    );
  }

  return (
    <div className={cn("min-w-0 flex-1", className)}>
      <FarmGeoMap
        points={mapPoints}
        activeSido={activeSido}
        onSelectSido={onSelectSido}
        className="mx-0 w-full max-w-none"
      />
    </div>
  );
}
