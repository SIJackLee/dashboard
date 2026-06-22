import type { HealthSnapshot } from "@/lib/admin/health/types";
import {
  CollectorSubGrid,
  HealthCollectorTopology,
} from "@/components/admin/health/health-collector-topology";
import { HealthAlertList } from "@/components/admin/health/health-alert-list";
import { HealthCollectorGroupTable } from "@/components/admin/health/health-collector-group-table";
import { HealthFarmModuleTable } from "@/components/admin/health/health-farm-module-table";
import { HealthInsertRateChart } from "@/components/admin/health/health-insert-rate-chart";
import { HealthModuleAgeChart } from "@/components/admin/health/health-module-age-chart";
import { HealthRefreshBar } from "@/components/admin/health/health-refresh-bar";
import { HealthSectionCard } from "@/components/admin/health/health-section-card";
import { HealthStatusStats } from "@/components/admin/health/health-status-stats";
import { HealthTopologyGraph } from "@/components/admin/health/health-topology-graph";
import { HealthUsageBar } from "@/components/admin/health/health-usage-bar";
import { HealthOverallStatus } from "@/components/admin/health/health-overall-status";
import { HEALTH_UI, worstHealthStatus } from "@/lib/admin/health/health-ui-labels";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export { HealthNodeDetailView } from "@/components/admin/health/health-node-detail-view";

type HealthOverviewViewProps = {
  snapshot: HealthSnapshot;
};

export function HealthOverviewView({ snapshot }: HealthOverviewViewProps) {
  const capWarn = snapshot.liveRowCount >= snapshot.liveRowLimit * 0.9;
  const overallStatus = worstHealthStatus(snapshot.statusCounts);

  return (
    <div className="space-y-6">
      <div
        className={cn(
          "sticky top-0 z-20 -mx-1 flex flex-wrap items-start justify-between gap-4",
          "border-b bg-background/95 px-1 py-3 backdrop-blur supports-backdrop-filter:bg-background/80"
        )}
      >
        <HealthOverallStatus
          overallStatus={overallStatus}
          impactScope={snapshot.impactScope}
        />
        <HealthRefreshBar
          key={snapshot.fetchedAt}
          fetchedAt={snapshot.fetchedAt}
          className="shrink-0"
        />
      </div>

      {!snapshot.dbOk ? (
        <div className="rounded-xl border border-amber-300/50 bg-amber-50 px-5 py-4 text-amber-900">
          <p className={dashboardTypography.body}>
            SUPABASE_SERVICE_ROLE_KEY 또는 DB 연결이 필요합니다. service role 없으면
            집계가 제한됩니다.
          </p>
        </div>
      ) : null}

      <HealthStatusStats counts={snapshot.statusCounts} />

      <HealthSectionCard
        title={HEALTH_UI.activeAlerts}
        description={HEALTH_UI.activeAlertsDesc}
      >
        {snapshot.d11Hints.length > 0 ? (
          <div className="mb-4 rounded-lg border border-amber-300/40 bg-amber-50/80 px-4 py-3">
            <p className={cn(dashboardTypography.meta, "text-amber-900")}>
              {HEALTH_UI.actionHint}:{" "}
              {snapshot.d11Hints.map((h) => h.title).join(" · ")}
            </p>
          </div>
        ) : null}
        <HealthAlertList
          key={snapshot.fetchedAt}
          alerts={snapshot.activeAlerts}
          fetchedAt={snapshot.fetchedAt}
        />
      </HealthSectionCard>

      <HealthSectionCard title={HEALTH_UI.dataPath} description={HEALTH_UI.dataPathDesc}>
        <HealthTopologyGraph
          nodes={snapshot.pipeline}
          downlinkBranch={snapshot.collectorSub.find((n) => n.id === "collector-c")}
        />
      </HealthSectionCard>

      {snapshot.collectorGroups.length > 0 ? (
        <HealthSectionCard
          title={HEALTH_UI.collectorGroups}
          description={HEALTH_UI.collectorGroupsDesc}
        >
          <HealthCollectorGroupTable groups={snapshot.collectorGroups} />
        </HealthSectionCard>
      ) : null}

      <HealthSectionCard title={HEALTH_UI.insertRate} description={HEALTH_UI.insertRateDesc}>
        <HealthInsertRateChart buckets={snapshot.insertBuckets} hideTitle />
      </HealthSectionCard>

      <HealthSectionCard title={HEALTH_UI.moduleAge} description={HEALTH_UI.moduleAgeDesc}>
        <HealthModuleAgeChart modules={snapshot.modules} hideTitle />
      </HealthSectionCard>

      <HealthSectionCard title={HEALTH_UI.liveCap} description={HEALTH_UI.liveCapDesc}>
        <HealthUsageBar
          label={HEALTH_UI.liveCap}
          used={snapshot.liveRowCount}
          total={snapshot.liveRowLimit}
          tone={capWarn ? "warn" : "default"}
          hideLabel
        />
      </HealthSectionCard>

      <HealthSectionCard
        title={HEALTH_UI.farmModules}
        description={HEALTH_UI.farmModulesDesc}
      >
        <HealthFarmModuleTable modules={snapshot.modules} />
      </HealthSectionCard>
    </div>
  );
}

type HealthCollectorViewProps = {
  snapshot: HealthSnapshot;
};

export function HealthCollectorView({ snapshot }: HealthCollectorViewProps) {
  return (
    <div className="space-y-6">
      <HealthRefreshBar key={snapshot.fetchedAt} fetchedAt={snapshot.fetchedAt} />
      <div className="rounded-xl border border-sky-300/40 bg-sky-50 px-5 py-4">
        <p className={dashboardTypography.body}>
          COL rollup = worst(MQTT, RS) uplink only. C downlink는 별도 노드·S4.
          Ekape·FTP는 비활성화 — rollup 제외.
        </p>
      </div>
      <HealthSectionCard>
        <HealthCollectorTopology nodes={snapshot.collectorSub} />
      </HealthSectionCard>
      <CollectorSubGrid nodes={snapshot.collectorSub} />
      {snapshot.collectorGroups.length > 0 ? (
        <HealthSectionCard title="수집 그룹 · R3">
          <HealthCollectorGroupTable groups={snapshot.collectorGroups} />
        </HealthSectionCard>
      ) : null}
      <HealthSectionCard>
        <HealthInsertRateChart buckets={snapshot.insertBuckets} />
      </HealthSectionCard>
    </div>
  );
}
