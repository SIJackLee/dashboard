"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { AdminFarmOverview } from "@/components/admin/admin-farm-overview";
import { FarmPageContent } from "@/components/farm/farm-page-content";
import { FarmDrillStrip } from "@/components/farm/farm-drill-strip";
import { ScopeBar } from "@/components/layout/scope-bar";
import type { FarmLocationRow } from "@/lib/data/farm-location";
import type { FarmKey } from "@/lib/data/farm-key";
import type { FarmSummaryRow } from "@/lib/data/farm-summaries";
import type { BarnMapSnapshot, BarnReading } from "@/lib/data/iot";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export type FarmMapMode = "geo" | "grid";

type FarmDashboardShellProps =
  | {
      mapMode: "geo";
      farms: FarmSummaryRow[];
      locations: FarmLocationRow[];
    }
  | {
      mapMode: "grid";
      readings: BarnReading[];
      barnSnapshots: BarnMapSnapshot[];
      gridCols: number;
      gridRows: number;
      isAdmin?: boolean;
      farmOptions?: FarmKey[];
      activeFarmKey?: FarmKey | null;
      farmSummaries?: FarmSummaryRow[];
      sp?: string | null;
      view?: string | null;
    };

export function FarmDashboardShell(props: FarmDashboardShellProps) {
  const router = useRouter();

  if (props.mapMode === "geo") {
    return (
      <AdminFarmOverview farms={props.farms} locations={props.locations} />
    );
  }

  const {
    readings,
    barnSnapshots,
    gridCols,
    gridRows,
    isAdmin = false,
    farmOptions = [],
    activeFarmKey = null,
    farmSummaries = [],
    sp,
    view,
  } = props;

  const showAdminScope = isAdmin && farmOptions.length > 0;

  return (
    <div className="space-y-6">
      {showAdminScope ? (
        <ScopeBar
          sticky
          adminFarmSwitcher={{
            farmOptions,
            activeFarmKey,
            farmSummaries,
          }}
          onRefresh={() => router.refresh()}
        />
      ) : null}

      {isAdmin && activeFarmKey ? (
        <FarmDrillStrip
          activeFarmKey={activeFarmKey}
          sp={sp}
          view={view}
        />
      ) : null}

      <Suspense
        fallback={
          <p className={cn("text-muted-foreground", dashboardUi.body)}>로딩…</p>
        }
      >
        <FarmPageContent
          readings={readings}
          barnSnapshots={barnSnapshots}
          gridCols={gridCols}
          gridRows={gridRows}
        />
      </Suspense>
    </div>
  );
}
