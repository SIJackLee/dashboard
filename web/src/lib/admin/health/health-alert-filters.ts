import type { HealthAlertEvent } from "@/lib/admin/health/types";

/** 허브 UI: 토폴로지·농장 테이블과 겹치지 않는 인프라 알림만 */
export function filterInfraAlerts(alerts: HealthAlertEvent[]): HealthAlertEvent[] {
  const skipPipeline = new Set([
    "field-controller",
    "field-module",
    "collector",
    "storage",
    "dashboard",
  ]);

  return alerts.filter((a) => {
    if (a.id.startsWith("group-")) return false;
    if (a.id.startsWith("pipeline-")) {
      const nodeId = a.id.slice("pipeline-".length);
      return !skipPipeline.has(nodeId);
    }
    if (
      a.id.startsWith("point-field-module") ||
      a.id.startsWith("point-field-controller")
    ) {
      return false;
    }
    return true;
  });
}
