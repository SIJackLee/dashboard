"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import {
  FARM_GEO_MAP_HUB_SHELL,
  FARM_GEO_MAP_MINI_SHELL,
  FARM_GEO_MAP_SHELL,
} from "@/components/admin/farm-geo-map-shell";
import { shortSidoDisplay } from "@/lib/monitoring/hub-view-state";
import type { FarmLocationRow } from "@/lib/data/farm-location";
import { buildFarmMapPoints, pointsWithoutLocation } from "@/lib/data/farm-geo-summary";
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
  /** 데스크톱 — region 선택 후 미니맵 */
  variant?: "full" | "mini";
  /** 미니맵 클릭 → 전국 지도 복원 */
  onExpand?: () => void;
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

  const unlocatedFarmCount = useMemo(
    () => pointsWithoutLocation(farms, locations).length,
    [farms, locations]
  );

  if (hub) {
    const mini = props.variant === "mini";
    const hubShell = mini ? FARM_GEO_MAP_MINI_SHELL : FARM_GEO_MAP_HUB_SHELL;

    return (
      <div
        className={cn(
          "flex min-h-0 flex-col gap-1.5",
          mini ? "shrink-0" : "h-full",
          className
        )}
      >
        {mini ? (
          <div className="flex shrink-0 items-center justify-between gap-2 px-0.5">
            <p className={cn("truncate font-semibold text-foreground", dashboardUi.tableMeta)}>
              {activeSido ? `${shortSidoDisplay(activeSido)} · 미니맵` : "미니맵"}
            </p>
            <span className={cn("shrink-0 text-muted-foreground", dashboardUi.tableMeta)}>
              클릭 → 줌 복원
            </span>
          </div>
        ) : null}
        <div
          className={cn(
            hubShell,
            mini ? "ring-1 ring-primary/20" : "min-h-0 flex-1"
          )}
        >
          <FarmGeoMap
            points={mapPoints}
            activeSido={activeSido}
            onSelectSido={onSelectSido}
            focusFarmId={props.focusFarmId ?? null}
            onSelectFarm={props.onSelectFarm}
            showLegend={false}
            compactMode={mini}
            onCompactExpand={mini ? props.onExpand : undefined}
            unlocatedFarmCount={unlocatedFarmCount}
            shellClassName="absolute inset-0 h-full w-full overflow-hidden rounded-xl border-0 bg-transparent"
            className="h-full w-full"
          />
        </div>
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
