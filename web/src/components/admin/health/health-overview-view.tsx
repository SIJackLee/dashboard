import type { HealthSnapshot } from "@/lib/admin/health/types";
import {
  CollectorSubGrid,
  HealthCollectorTopology,
} from "@/components/admin/health/health-collector-topology";
import { HealthCollectorGroupTable } from "@/components/admin/health/health-collector-group-table";
import { HealthInsertRateChart } from "@/components/admin/health/health-insert-rate-chart";
import { HealthRefreshBar } from "@/components/admin/health/health-refresh-bar";
import { HealthSectionCard } from "@/components/admin/health/health-section-card";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";

export { HealthNodeDetailView } from "@/components/admin/health/health-node-detail-view";

type HealthCollectorViewProps = {
  snapshot: HealthSnapshot;
};

export function HealthCollectorView({ snapshot }: HealthCollectorViewProps) {
  return (
    <div className="space-y-6">
      <HealthRefreshBar key={snapshot.fetchedAt} fetchedAt={snapshot.fetchedAt} />
      <div className="rounded-xl border border-sky-300/40 bg-sky-50 px-5 py-4">
        <p className={dashboardTypography.body}>
          COL rollup = worst(MQTT, RS) uplink only. C downlink은 별도 노드·S4.
          Ekape·FTP는 비활성화 시 rollup 제외.
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
