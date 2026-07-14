import type { ReactNode } from "react";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { FarmDashboardShell } from "@/components/farm/farm-dashboard-shell";
import { AdminAllFarmsGridLoader } from "@/components/farm/admin-all-farms-grid-loader";
import { FarmContentSkeleton } from "@/components/common/loading-skeletons";
import { AdminHubPanelsProvider } from "@/lib/navigation/admin-hub-panels-context";
import { resolveActiveFarmKey } from "@/lib/auth/farm-access";
import { getCurrentUser, canCommand } from "@/lib/auth/get-current-user";
import { getPageShellContext } from "@/lib/data/page-shell-data";
import { loadFarmScopedPanelData } from "@/lib/farm/load-farm-scoped-panel-data";
import { getThermoCommandHistory, getThermoSettingsMap } from "@/lib/data/commands";
import { mergeThermoSettingsMaps } from "@/lib/controllers/controller-settings";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { ThermoCommand } from "@/lib/data/commands";

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

/** 레거시 tab=ops|devices|alarms → 현황(/farm) */
function redirectLegacyOpsTab(params: Record<string, string | undefined>) {
  if (
    params.tab !== "ops" &&
    params.tab !== "devices" &&
    params.tab !== "alarms"
  ) {
    return;
  }
  const clean = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "tab") clean.set(key, value);
  }
  const q = clean.toString();
  redirect(q ? `/farm?${q}` : "/farm");
}

export default async function FarmPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    view?: string;
    lsind?: string;
    item?: string;
    sp?: string;
    stall?: string;
    ctrl?: string;
    module?: string;
    alarm?: string;
    panel?: string;
    ok?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
  stripLegacyOverviewView(params);
  redirectLegacyOpsTab(params);

  if (params.panel === "alarm" || params.panel === "display" || params.panel === "farm") {
    if (params.panel === "farm") {
      const user = await getCurrentUser();
      if (user?.isAdmin) {
        redirect("/admin/ops/farms");
      }
    }
    const legacy = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "panel") legacy.set(key, value);
    }
    const q = legacy.toString();
    redirect(q ? `/farm?${q}` : "/farm");
  }

  const user = await getCurrentUser();
  const isAdmin = Boolean(user?.isAdmin);
  const activeFarmKey = user ? resolveActiveFarmKey(user, params) : null;

  const shellParams = {
    lsind: params.lsind,
    item: params.item,
    view: params.view,
  };

  const shellCtx = await getPageShellContext(shellParams);

  const adminAllFarmsMode =
    isAdmin && !activeFarmKey && shellCtx.farmOptions.length > 0;

  /** Admin hub 단일 농장 — server action POST 시 무거운 SSR 생략, 클라이언트 캐시·lazy fetch */
  const adminScopedFarmDefer =
    isAdmin && activeFarmKey != null && !adminAllFarmsMode;

  let scopedPanelData: Awaited<ReturnType<typeof loadFarmScopedPanelData>> | null =
    null;
  let thermoSettings: Record<string, ControllerThermoSettings> = {};
  let history: ThermoCommand[] = [];

  const needsPanelData = Boolean(activeFarmKey) && !adminScopedFarmDefer;
  const needsHistory = needsPanelData || !adminAllFarmsMode;

  if (needsHistory) {
    const [historyRes, commandThermoMap] = await Promise.all([
      getThermoCommandHistory(100),
      getThermoSettingsMap(500),
    ]);
    history = historyRes;
    thermoSettings = mergeThermoSettingsMaps(commandThermoMap, {});
    if (needsPanelData && activeFarmKey) {
      scopedPanelData = await loadFarmScopedPanelData({
        farmKey: activeFarmKey,
        commandThermoMap: thermoSettings,
        history,
        canCommand: canCommand(user),
      });
    }
  }

  const pageBody = (content: ReactNode) => (
    <div className="space-y-4 md:space-y-5">
      <Suspense fallback={<FarmContentSkeleton view={params.view} />}>
        {content}
      </Suspense>
    </div>
  );

  const deferredAdminGrid = adminAllFarmsMode ? (
    <AdminAllFarmsGridLoader farmOptions={shellCtx.farmOptions} />
  ) : null;

  return (
    <PageShell wide searchParams={shellParams}>
      {pageBody(
        <AdminHubPanelsProvider>
          <FarmDashboardShell
            readings={scopedPanelData?.readings ?? []}
            barnSnapshots={scopedPanelData?.barnSnapshots ?? []}
            gridCols={scopedPanelData?.gridCols ?? 4}
            gridRows={scopedPanelData?.gridRows ?? 4}
            isAdmin={isAdmin}
            farmOptions={shellCtx.farmOptions}
            activeFarmKey={shellCtx.activeFarmKey}
            farmSummaries={shellCtx.farmSummaries}
            sp={params.sp}
            view={params.view}
            trendByPeriod={scopedPanelData?.trendByPeriod ?? null}
            controller={
              scopedPanelData?.controller ?? {
                readings: [],
                thermoSettings,
                commands: history,
                canCommand: canCommand(user),
              }
            }
            allFarmGrids={adminAllFarmsMode ? null : undefined}
            deferAdminGridLoad={adminAllFarmsMode}
          >
            {deferredAdminGrid}
          </FarmDashboardShell>
        </AdminHubPanelsProvider>
      )}
    </PageShell>
  );
}
