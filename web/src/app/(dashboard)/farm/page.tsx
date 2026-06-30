import type { ReactNode } from "react";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { FarmDashboardShell } from "@/components/farm/farm-dashboard-shell";
import { MonitoringTabs } from "@/components/monitoring/monitoring-tabs";
import { MonitoringTabPanel } from "@/components/monitoring/monitoring-tab-panel";
import { OpsTriageView } from "@/components/ops/ops-triage-view";
import { getFarmTrendAllPeriods } from "@/lib/data/farm-trend-history";
import {
  filterReadingsByFarmKey,
  resolveActiveFarmKey,
} from "@/lib/auth/farm-access";
import { getCurrentUser, canCommand } from "@/lib/auth/get-current-user";
import { getBarnLayoutPrefs, mergeBarnLayouts } from "@/lib/data/barn-meta";
import {
  buildAutoBarnMap,
  gridDimensionsForBarnMap,
} from "@/lib/data/barn-map";
import { resolveFarmerOpsBarnGrid } from "@/lib/monitoring/farmer-ops-barn-grid";
import { getPageShellContext } from "@/lib/data/page-shell-data";
import { getLiveReadings } from "@/lib/data/iot";
import {
  summarizeControllers,
  toFarmOverview,
} from "@/lib/data/dashboard-summary";
import { FIRMWARE_CTRL_COUNT } from "@/lib/data/iot-firmware";
import { getThermoCommandHistory, getThermoSettingsMap } from "@/lib/data/commands";
import { mergeThermoSettingsMaps } from "@/lib/controllers/controller-settings";
import { deriveAlarmsFromReadings, summarizeAlarms } from "@/lib/data/alarms";
import { getAlarmSettings } from "@/lib/data/alarm-settings";
import { getFarmLocations } from "@/lib/data/farm-location";
import { parseMonitoringTab } from "@/lib/monitoring/monitoring-tabs";

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

  if (params.tab === "devices" || params.tab === "alarms") {
    const legacy = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "tab") legacy.set(key, value);
    }
    legacy.set("tab", "ops");
    redirect(`/farm?${legacy.toString()}`);
  }

  if (params.panel === "alarm" || params.panel === "display" || params.panel === "farm") {
    if (params.panel === "farm") {
      const user = await getCurrentUser();
      if (user?.isAdmin) {
        redirect("/admin/ops?tab=farms");
      }
    }
    const legacy = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "panel") legacy.set(key, value);
    }
    if (!legacy.has("tab")) legacy.set("tab", "ops");
    redirect(`/farm?${legacy.toString()}`);
  }

  const user = await getCurrentUser();
  const isAdmin = Boolean(user?.isAdmin);
  const activeFarmKey = user ? resolveActiveFarmKey(user, params) : null;

  const tab = parseMonitoringTab(params.tab);

  /** Admin 농장 스코프 — 모바일·데스크톱 공통 ops 허브로 */
  if (isAdmin && activeFarmKey && tab === "map") {
    const scoped = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "tab") scoped.set(key, value);
    }
    scoped.set("tab", "ops");
    redirect(`/farm?${scoped.toString()}`);
  }
  /** Admin 전국 허브 — 컨트롤러 선택(tab=ops) 후에도 3열 유지 */
  const isAdminMonitoringHub =
    isAdmin && (!activeFarmKey || tab === "ops");

  const shellParams = {
    lsind: params.lsind,
    item: params.item,
    view: params.view,
  };

  const trendData = activeFarmKey
    ? await getFarmTrendAllPeriods({ farmKey: activeFarmKey })
    : null;

  const pageBody = (
    content: ReactNode,
    options?: { hideTabs?: boolean }
  ) => (
    <div className="space-y-4 md:space-y-5">
      {!options?.hideTabs ? (
        <Suspense fallback={null}>
          <MonitoringTabs active={tab} isAdmin={isAdmin} />
        </Suspense>
      ) : null}
      <Suspense fallback={null}>
        <MonitoringTabPanel serverTab={tab}>{content}</MonitoringTabPanel>
      </Suspense>
    </div>
  );

  /** Admin 전국 — 지도·농장목록·컨트롤러 가로 3열 허브 */
  if (isAdminMonitoringHub) {
    const [shellCtx, history, commandThermoMap, readings, alarmSettings, farmLocations] =
      await Promise.all([
        getPageShellContext(shellParams),
        getThermoCommandHistory(100),
        getThermoSettingsMap(500),
        getLiveReadings({}),
        getAlarmSettings(),
        getFarmLocations(),
      ]);

    const thermoSettings = mergeThermoSettingsMaps(commandThermoMap, {});
    const scopedReadings = filterReadingsByFarmKey(readings, null);
    const alarms = deriveAlarmsFromReadings(scopedReadings, alarmSettings);
    const alarmSummary = summarizeAlarms(alarms);

    const deviceNotices: Record<string, { tone: "ok" | "error"; text: string }> = {
      saved: { tone: "ok", text: "저장했습니다." },
      invalid: { tone: "error", text: "입력값이 올바르지 않습니다." },
      save: { tone: "error", text: "저장에 실패했습니다. 권한을 확인하세요." },
      forbidden: {
        tone: "error",
        text: "이 항목을 수정할 권한이 없습니다. 명령 권한 또는 관리자 역할이 필요합니다.",
      },
    };
    const settingsNotice = params.ok
      ? deviceNotices[params.ok]
      : params.error
        ? deviceNotices[params.error]
        : null;

    return (
      <PageShell wide searchParams={shellParams}>
        {pageBody(
          <Suspense fallback={null}>
            <OpsTriageView
              readings={scopedReadings}
              alarms={alarms}
              alarmSummary={alarmSummary}
              initialLsind={params.lsind}
              initialItem={params.item}
              initialSp={params.sp}
              initialStall={params.stall}
              initialCtrl={params.ctrl}
              initialAlarm={params.alarm}
              canCommand={canCommand(user)}
              commands={history}
              thermoSettings={thermoSettings}
              isAdmin={isAdmin}
              adminAllFarms
              farmSummaries={shellCtx.farmSummaries}
              adminFarmOptions={shellCtx.farmOptions}
              adminActiveFarmKey={shellCtx.activeFarmKey}
              alarmSettings={alarmSettings}
              settingsNotice={settingsNotice}
              geoHub={{
                farmSummaries: shellCtx.farmSummaries,
                locations: farmLocations,
              }}
            />
          </Suspense>,
          { hideTabs: true }
        )}
      </PageShell>
    );
  }

  const [shellCtx, history, commandThermoMap] = await Promise.all([
    getPageShellContext(shellParams),
    getThermoCommandHistory(100),
    getThermoSettingsMap(500),
  ]);
  const thermoSettings = mergeThermoSettingsMaps(commandThermoMap, {});

  /** 운영 탭 — 3열 트리아지 (장비+이상 통합) */
  if (tab === "ops") {
    const [readings, alarmSettings, layoutPrefs] = await Promise.all([
      getLiveReadings(activeFarmKey ? { farmKey: activeFarmKey } : {}),
      getAlarmSettings(),
      getBarnLayoutPrefs(),
    ]);

    const scopedReadings = filterReadingsByFarmKey(readings, activeFarmKey);
    const barnGridData = resolveFarmerOpsBarnGrid(scopedReadings, layoutPrefs);
    if (Object.keys(barnGridData.layoutsToPersist).length > 0) {
      await mergeBarnLayouts(barnGridData.layoutsToPersist);
    }
    const alarms = deriveAlarmsFromReadings(scopedReadings, alarmSettings);
    const alarmSummary = summarizeAlarms(alarms);

    const deviceNotices: Record<string, { tone: "ok" | "error"; text: string }> = {
      saved: { tone: "ok", text: "저장했습니다." },
      invalid: { tone: "error", text: "입력값이 올바르지 않습니다." },
      save: { tone: "error", text: "저장에 실패했습니다. 권한을 확인하세요." },
      forbidden: {
        tone: "error",
        text: "이 항목을 수정할 권한이 없습니다. 명령 권한 또는 관리자 역할이 필요합니다.",
      },
    };
    const settingsNotice = params.ok
      ? deviceNotices[params.ok]
      : params.error
        ? deviceNotices[params.error]
        : null;

    return (
      <PageShell wide searchParams={shellParams}>
        {pageBody(
          <Suspense fallback={null}>
            <OpsTriageView
              readings={scopedReadings}
              alarms={alarms}
              alarmSummary={alarmSummary}
              initialLsind={params.lsind}
              initialItem={params.item}
              initialSp={params.sp}
              initialStall={params.stall}
              initialCtrl={params.ctrl}
              initialAlarm={params.alarm}
              canCommand={canCommand(user)}
              commands={history}
              thermoSettings={thermoSettings}
              isAdmin={isAdmin}
              adminAllFarms={false}
              farmSummaries={shellCtx.farmSummaries}
              adminFarmOptions={shellCtx.farmOptions}
              adminActiveFarmKey={shellCtx.activeFarmKey}
              alarmSettings={alarmSettings}
              settingsNotice={settingsNotice}
              barnGrid={{
                snapshots: barnGridData.snapshots,
                gridCols: barnGridData.gridCols,
                gridRows: barnGridData.gridRows,
              }}
            />
          </Suspense>
        )}
      </PageShell>
    );
  }

  /** 현황 탭 · scoped grid */
  const [readings, layoutPrefs, alarmSettings] = await Promise.all([
    getLiveReadings(activeFarmKey ? { farmKey: activeFarmKey } : {}),
    getBarnLayoutPrefs(),
    getAlarmSettings(),
  ]);

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

  return (
    <PageShell wide searchParams={shellParams}>
      {pageBody(
        <FarmDashboardShell
          mapMode="grid"
          readings={scopedReadings}
          barnSnapshots={barnSnapshots}
          gridCols={gridSize.cols}
          gridRows={gridSize.rows}
          isAdmin={isAdmin}
          farmOptions={shellCtx.farmOptions}
          activeFarmKey={shellCtx.activeFarmKey}
          farmSummaries={shellCtx.farmSummaries}
          sp={params.sp}
          view={params.view}
          trendByPeriod={trendData}
          controller={{
            readings: scopedReadings,
            thermoSettings,
            commands: history,
            canCommand: canCommand(user),
            alarmSettings,
          }}
        />
      )}
    </PageShell>
  );
}
