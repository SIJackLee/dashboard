import { HealthCommandEventGraph } from "@/components/admin/health/health-command-event-graph";
import { HealthCommandFailurePanel } from "@/components/admin/health/health-command-failure-panel";
import type { HealthSnapshot } from "@/lib/admin/health/types";
import {
  CollectorSubGrid,
  HealthCollectorTopology,
} from "@/components/admin/health/health-collector-topology";
import { HealthD11Panel, HealthPointTable } from "@/components/admin/health/health-point-table";
import { hintsFromPoints } from "@/lib/admin/health/d11-map";
import { HealthAlertList } from "@/components/admin/health/health-alert-list";
import { HealthCollectorGroupTable } from "@/components/admin/health/health-collector-group-table";
import { HealthControllerTable } from "@/components/admin/health/health-controller-table";
import { HealthFarmModuleTable } from "@/components/admin/health/health-farm-module-table";
import { HealthInsertRateChart } from "@/components/admin/health/health-insert-rate-chart";
import { HealthModuleAgeChart } from "@/components/admin/health/health-module-age-chart";
import { HealthRefreshBar } from "@/components/admin/health/health-refresh-bar";
import { HealthStatusStats } from "@/components/admin/health/health-status-stats";
import { HealthTopologyGraph } from "@/components/admin/health/health-topology-graph";
import { HealthUsageBar } from "@/components/admin/health/health-usage-bar";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type HealthOverviewViewProps = {
  snapshot: HealthSnapshot;
};

export function HealthOverviewView({ snapshot }: HealthOverviewViewProps) {
  const capWarn = snapshot.liveRowCount >= snapshot.liveRowLimit * 0.9;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className={cn(dashboardTypography.meta)}>
            /admin/health · 1층 개요 (민감정보 없음)
          </p>
          {snapshot.impactScope ? (
            <p className={cn(dashboardTypography.body, "mt-1")}>
              영향 범위: <strong>{snapshot.impactScope}</strong>
            </p>
          ) : null}
        </div>
        <HealthRefreshBar key={snapshot.fetchedAt} fetchedAt={snapshot.fetchedAt} />
      </div>

      {!snapshot.dbOk ? (
        <div className="rounded-xl border border-amber-300/50 bg-amber-50 px-5 py-4 text-amber-900">
          <p className={dashboardTypography.body}>
            SUPABASE_SERVICE_ROLE_KEY 또는 DB 연결이 필요합니다. service role 없으면
            집계가 제한됩니다.
          </p>
        </div>
      ) : null}

      {snapshot.d11Hints.length > 0 ? (
        <div className="rounded-xl border border-amber-300/50 bg-amber-50 px-5 py-4">
          <p className={cn(dashboardTypography.sectionTitle, "text-amber-900")}>
            D11 힌트
          </p>
          <p className={cn(dashboardTypography.body, "text-amber-900")}>
            {snapshot.d11Hints.map((h) => `${h.id} ${h.title}`).join(" · ")}
          </p>
        </div>
      ) : null}

      <section className="rounded-xl border bg-card p-5">
        <h2 className={cn(dashboardTypography.cardTitle, "mb-4")}>
          6칸 파이프라인 · 토폴로지
        </h2>
        <HealthTopologyGraph
          nodes={snapshot.pipeline}
          downlinkBranch={snapshot.collectorSub.find((n) => n.id === "collector-c")}
        />
      </section>

      <HealthStatusStats counts={snapshot.statusCounts} />

      <section className="rounded-xl border bg-card p-5">
        <h2 className={cn(dashboardTypography.cardTitle, "mb-4")}>
          활성 알림 · 스냅샷
        </h2>
        <HealthAlertList
          key={snapshot.fetchedAt}
          alerts={snapshot.activeAlerts}
          fetchedAt={snapshot.fetchedAt}
        />
      </section>

      {snapshot.collectorGroups.length > 0 ? (
        <section className="rounded-xl border bg-card p-5">
          <h2 className={cn(dashboardTypography.cardTitle, "mb-4")}>
            수집 서버 그룹 · R3
          </h2>
          <HealthCollectorGroupTable groups={snapshot.collectorGroups} />
        </section>
      ) : null}

      <section className="rounded-xl border bg-card p-5">
        <HealthInsertRateChart buckets={snapshot.insertBuckets} />
      </section>

      <section className="rounded-xl border bg-card p-5">
        <HealthModuleAgeChart modules={snapshot.modules} />
      </section>

      <section className="rounded-xl border bg-card p-5">
        <HealthUsageBar
          label="관리 화면 · live 조회 상한 (D9)"
          used={snapshot.liveRowCount}
          total={snapshot.liveRowLimit}
          tone={capWarn ? "warn" : "default"}
        />
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className={cn(dashboardTypography.cardTitle, "mb-4")}>
          농장 · 모듈 (worst rollup)
        </h2>
        <HealthFarmModuleTable modules={snapshot.modules} />
      </section>
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
      <section className="rounded-xl border bg-card p-5">
        <HealthCollectorTopology nodes={snapshot.collectorSub} />
      </section>
      <CollectorSubGrid nodes={snapshot.collectorSub} />
      {snapshot.collectorGroups.length > 0 ? (
        <section className="rounded-xl border bg-card p-5">
          <h2 className={cn(dashboardTypography.cardTitle, "mb-4")}>
            수집 그룹 · R3
          </h2>
          <HealthCollectorGroupTable groups={snapshot.collectorGroups} />
        </section>
      ) : null}
      <section className="rounded-xl border bg-card p-5">
        <HealthInsertRateChart buckets={snapshot.insertBuckets} />
      </section>
    </div>
  );
}

type HealthNodeDetailViewProps = {
  nodeId: string;
  snapshot: HealthSnapshot;
};

export function HealthNodeDetailView({
  nodeId,
  snapshot,
}: HealthNodeDetailViewProps) {
  const points = snapshot.pointsByNode[nodeId as keyof typeof snapshot.pointsByNode] ?? [];
  const hints = hintsFromPoints(points);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-6">
        <p className={dashboardTypography.meta}>
          /admin/health/{nodeId} · 2층 상세
        </p>
        <HealthPointTable points={points.length ? points : [{ id: "—", label: "포인트", value: "P0 미구현", status: "unknown" }]} />
        {nodeId === "collector-rs" ? (
          <section className="rounded-xl border bg-card p-5">
            <HealthInsertRateChart buckets={snapshot.insertBuckets} />
          </section>
        ) : null}
        {nodeId === "dashboard" ? (
          <section className="rounded-xl border bg-card p-5">
            <HealthUsageBar
              label="v_iot_live_latest"
              used={snapshot.liveRowCount}
              total={snapshot.liveRowLimit}
              tone={snapshot.liveRowCount >= snapshot.liveRowLimit * 0.9 ? "warn" : "default"}
            />
          </section>
        ) : null}
        {nodeId === "field-module" ? (
          <section className="rounded-xl border bg-card p-5">
            <h2 className={cn(dashboardTypography.cardTitle, "mb-4")}>
              모듈 목록 (전역)
            </h2>
            <HealthFarmModuleTable modules={snapshot.modules} />
          </section>
        ) : null}
        {nodeId === "field-controller" ? (
          <section className="rounded-xl border bg-card p-5">
            <h2 className={cn(dashboardTypography.cardTitle, "mb-4")}>
              장비 목록 (전역)
            </h2>
            <HealthControllerTable controllers={snapshot.controllers} limit={50} />
          </section>
        ) : null}
        {nodeId === "collector-c" ? (
          <>
            <section className="rounded-xl border bg-card p-5">
              <HealthCommandEventGraph
                items={snapshot.commandTimeline}
                fetchedAt={snapshot.fetchedAt}
              />
            </section>
            <section className="rounded-xl border bg-card p-5">
              <h2 className={cn(dashboardTypography.cardTitle, "mb-4")}>
                C 실패 이력 · 체크포인트
              </h2>
              <HealthCommandFailurePanel
                failures={snapshot.commandFailures}
                checkpointCount={snapshot.commandCheckpointCount}
              />
            </section>
          </>
        ) : null}
        {nodeId === "collector-mqtt" ? (
          <div className="rounded-xl border border-sky-300/40 bg-sky-50 px-5 py-4">
            <p className={dashboardTypography.body}>
              Mosquitto active probe 없음 — RS raw 수신으로 간접 추론 (spec §3a).
            </p>
          </div>
        ) : null}
        {nodeId === "collector-ekape" ? (
          <div className="rounded-xl border border-sky-300/40 bg-sky-50 px-5 py-4">
            <p className={dashboardTypography.body}>
              Ekape export 비활성화 — snapshot·View·config 테이블 제거됨
              (migration 20260619000000).
            </p>
          </div>
        ) : null}
        {nodeId === "collector-ftp" ? (
          <div className="rounded-xl border border-sky-300/40 bg-sky-50 px-5 py-4">
            <p className={dashboardTypography.body}>
              FTP Worker 비활성화 (Ekape 미구현). 수집 서버 rollup에서 제외됩니다.
            </p>
          </div>
        ) : null}
        {nodeId === "external" ? (
          <div className="rounded-xl border border-sky-300/40 bg-sky-50 px-5 py-4">
            <p className={dashboardTypography.body}>
              외부 연계(축평원) 비활성화 — 재개 시 D10·migration 이력 참고.
            </p>
          </div>
        ) : null}
        <details className="rounded-xl border bg-card p-5">
          <summary className={cn(dashboardTypography.sectionTitle, "cursor-pointer")}>
            기술 상세 (admin 2층)
          </summary>
          <ul className={cn("mt-4 space-y-2", dashboardTypography.meta)}>
            {nodeId === "collector-rs" && (
              <>
                <li>Process: RS.py</li>
                <li>Table: iot_room_state_raw</li>
                <li>Mosquitto: RS 간접 추론 — active probe 없음</li>
              </>
            )}
            {nodeId === "storage" && (
              <>
                <li>View: v_iot_live_latest (v0x0C DISTINCT ON) · v_iot_raw_live (이력)</li>
                <li>Supabase (service role)</li>
              </>
            )}
            {nodeId === "collector-c" && (
              <>
                <li>Table: ctrl_thermo_command</li>
                <li>Checkpoint: health_command_checkpoint (admin)</li>
                <li>COL rollup: uplink only — C는 별도 downlink 노드</li>
              </>
            )}
            {nodeId === "collector-mqtt" && (
              <>
                <li>Broker: Mosquitto</li>
                <li>Probe: 없음 — RS raw 간접 추론</li>
              </>
            )}
            {nodeId === "collector-ekape" && (
              <>
                <li>상태: 비활성화 (Ekape 미구현)</li>
                <li>설계 참고: Diagrams/D10-external-ekape.md</li>
              </>
            )}
            {nodeId === "collector-ftp" && (
              <>
                <li>상태: 비활성화 (Ekape 미구현)</li>
              </>
            )}
            {nodeId === "external" && (
              <>
                <li>상태: 비활성화 (Ekape 미구현)</li>
                <li>설계 참고: Diagrams/D10-external-ekape.md</li>
              </>
            )}
            {nodeId === "field-module" && (
              <>
                <li>Source: v_iot_live_latest (module rollup)</li>
                <li>Staleness: D9 gap = 300÷N</li>
              </>
            )}
            {nodeId === "field-controller" && (
              <>
                <li>Source: v_iot_live_latest (controller_key)</li>
                <li>단일 장비 이상 → S5</li>
              </>
            )}
            {nodeId === "dashboard" && (
              <>
                <li>GLOBAL_LIVE_ROW_LIMIT: {snapshot.liveRowLimit}</li>
                <li>Decode: Dashboard TS layer</li>
              </>
            )}
            <li>docs/architecture-firmware-ec2-db.md</li>
          </ul>
        </details>
      </div>
      <aside className="space-y-4 rounded-xl border bg-muted/30 p-5">
        <h2 className={dashboardTypography.sectionTitle}>D11 추천</h2>
        <HealthD11Panel hints={hints} />
      </aside>
    </div>
  );
}
