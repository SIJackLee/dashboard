import { healthNodeTitle } from "@/lib/admin/health/health-ui-labels";
import type {
  HealthAlertEvent,
  HealthSnapshot,
  HealthStatus,
} from "@/lib/admin/health/types";
import { HEALTH_STATUS_LABEL } from "@/lib/admin/health/types";

const SEVERITY_RANK: Record<HealthStatus, number> = {
  critical: 4,
  warn: 3,
  unknown: 2,
  ok: 1,
  not_implemented: 0,
};

export function buildHealthAlerts(snapshot: HealthSnapshot): HealthAlertEvent[] {
  const alerts: HealthAlertEvent[] = [];
  const at = snapshot.fetchedAt;

  for (const node of snapshot.pipeline) {
    if (node.status === "ok" || node.status === "not_implemented") continue;
    alerts.push({
      id: `pipeline-${node.id}`,
      severity: node.status,
      nodeId: node.id,
      nodeLabel: node.label,
      message: `${node.label} ${HEALTH_STATUS_LABEL[node.status]}`,
      d11Hint: node.d11Hints[0],
      href: node.href,
      observedAt: at,
    });
  }

  for (const sub of snapshot.collectorSub) {
    if (sub.status === "ok" || sub.status === "not_implemented") continue;
    alerts.push({
      id: `collector-${sub.id}`,
      severity: sub.status,
      nodeId: sub.id,
      nodeLabel: sub.label,
      message: `수집 ${sub.label} ${HEALTH_STATUS_LABEL[sub.status]}`,
      d11Hint: sub.d11Hints[0],
      href: `/admin/health/${sub.id}`,
      observedAt: at,
    });
  }

  for (const group of snapshot.collectorGroups) {
    if (group.scope !== "R3") continue;
    alerts.push({
      id: `group-${group.id}`,
      severity: group.status,
      nodeId: group.id,
      nodeLabel: group.label,
      message: `${group.label} · ${group.badModuleCount}/${group.moduleCount} 모듈 이상 (R3)`,
      d11Hint: group.d11Hint !== "—" ? group.d11Hint : "S1",
      href: `/admin/health/group/${group.id}`,
      observedAt: at,
    });
  }

  for (const [nodeId, points] of Object.entries(snapshot.pointsByNode)) {
    for (const p of points ?? []) {
      if (p.status !== "warn" && p.status !== "critical") continue;
      if (alerts.some((a) => a.id === `point-${nodeId}-${p.id}`)) continue;
      alerts.push({
        id: `point-${nodeId}-${p.id}`,
        severity: p.status,
        nodeId,
        nodeLabel: healthNodeTitle(nodeId),
        message: `${p.label}: ${p.value}`,
        d11Hint: p.d11Hint,
        href: `/admin/health/${nodeId}`,
        observedAt: at,
      });
    }
  }

  return alerts.sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
  );
}
