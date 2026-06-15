import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { AdminFarmOverview } from "@/components/admin/admin-farm-overview";
import { FarmPageContent } from "@/components/farm/farm-page-content";
import {
  filterReadingsByFarmKey,
  resolveActiveFarmKey,
} from "@/lib/auth/farm-access";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { deriveAlarmsFromReadings } from "@/lib/data/alarms";
import { getAlarmSettings } from "@/lib/data/alarm-settings";
import { getBarnLayoutPrefs, mergeBarnLayouts } from "@/lib/data/barn-meta";
import {
  buildAutoBarnMap,
  gridDimensionsForBarnMap,
} from "@/lib/data/barn-map";
import { buildFarmSummaries } from "@/lib/data/farm-summaries";
import { getFarmLocations } from "@/lib/data/farm-location";
import { getLiveReadings } from "@/lib/data/iot";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

function stripLegacyOverviewView(params: {
  view?: string;
  lsind?: string;
  item?: string;
  sp?: string;
}) {
  if (params.view !== "overview") return null;
  const clean = new URLSearchParams();
  if (params.lsind) clean.set("lsind", params.lsind);
  if (params.item) clean.set("item", params.item);
  if (params.sp) clean.set("sp", params.sp);
  const q = clean.toString();
  redirect(q ? `/farm?${q}` : "/farm");
}

/** 관리자 /farm 은 전국 지리 지도만 — 구 drill-down 쿼리 제거 */
function stripAdminFarmDrillDown(params: {
  view?: string;
  lsind?: string;
  item?: string;
  sp?: string;
}) {
  if (!params.lsind && !params.item && !params.sp && params.view !== "list") {
    return null;
  }
  redirect("/farm");
}

export default async function FarmPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    lsind?: string;
    item?: string;
    sp?: string;
  }>;
}) {
  const params = await searchParams;
  stripLegacyOverviewView(params);

  const user = await getCurrentUser();
  const isAdmin = Boolean(user?.isAdmin);

  if (isAdmin) {
    stripAdminFarmDrillDown(params);
  }

  const activeFarmKey = user ? resolveActiveFarmKey(user, params) : null;

  const [readings, layoutPrefs, alarmSettings, farmLocations] = await Promise.all([
    getLiveReadings(),
    getBarnLayoutPrefs(),
    getAlarmSettings(),
    getFarmLocations(),
  ]);

  if (isAdmin) {
    const alarms = deriveAlarmsFromReadings(readings, alarmSettings);
    const farmSummaries = buildFarmSummaries(readings, alarms);

    return (
      <PageShell title="농장" wide>
        <AdminFarmOverview farms={farmSummaries} locations={farmLocations} />
      </PageShell>
    );
  }

  const scopedReadings = filterReadingsByFarmKey(readings, activeFarmKey);
  const { snapshots: barnSnapshots, layoutsToPersist } = buildAutoBarnMap(
    scopedReadings,
    layoutPrefs
  );

  if (Object.keys(layoutsToPersist).length > 0) {
    await mergeBarnLayouts(layoutsToPersist);
  }

  const mergedLayouts = { ...layoutPrefs.layouts, ...layoutsToPersist };
  const gridSize = gridDimensionsForBarnMap(barnSnapshots, mergedLayouts);

  const shellParams = {
    lsind: params.lsind,
    item: params.item,
    view: params.view,
  };

  return (
    <PageShell title="농장 현황" wide searchParams={shellParams}>
      <Suspense
        fallback={
          <p className={cn("text-muted-foreground", dashboardUi.body)}>로딩…</p>
        }
      >
        <FarmPageContent
          readings={scopedReadings}
          barnSnapshots={barnSnapshots}
          gridCols={gridSize.cols}
          gridRows={gridSize.rows}
        />
      </Suspense>
    </PageShell>
  );
}
