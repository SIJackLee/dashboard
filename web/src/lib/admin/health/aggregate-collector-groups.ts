import type { InsertBucket } from "@/lib/admin/health/types";
import { insertRateStatus } from "@/lib/admin/health/group-insert-buckets";
import { worstStatus } from "@/lib/admin/health/staleness";
import type { CollectorGroupDef } from "@/lib/admin/health/collector-groups";
import type {
  CollectorGroupHealthRow,
  ModuleHealthRow,
} from "@/lib/admin/health/types";

export function aggregateCollectorGroups(
  groups: CollectorGroupDef[],
  modules: ModuleHealthRow[],
  bucketsByGroup: Map<string, InsertBucket[]>
): CollectorGroupHealthRow[] {
  const rows = groups.map((group) => {
    const groupModules = modules.filter((m) => group.farmIds.includes(m.farmId));
    const farmCount = new Set(groupModules.map((m) => m.farmId)).size;
    const badModules = groupModules.filter(
      (m) => m.status === "critical" || m.status === "warn"
    );
    const statuses = groupModules.map((m) => m.status);
    const status = worstStatus(statuses.length ? statuses : ["unknown"]);
    const insertBuckets = bucketsByGroup.get(group.id) ?? [];

    let d11Hint = "—";
    let scope = "—";
    if (status === "critical") {
      d11Hint = "S1";
      scope = badModules.length >= groupModules.length * 0.5 ? "R3" : "R2";
    } else if (status === "warn") {
      d11Hint = "S3";
      scope = badModules.length >= 2 ? "R3" : "R2";
    }

    return {
      id: group.id,
      label: group.label,
      farmIds: group.farmIds,
      farmCount,
      moduleCount: groupModules.length,
      badModuleCount: badModules.length,
      status,
      scope,
      d11Hint,
      insertBuckets,
      rsStatus: insertRateStatus(insertBuckets),
    };
  });

  return rows.map((row) => {
    if (!isGroupR3Candidate(row, rows)) return row;
    return { ...row, scope: "R3", d11Hint: row.d11Hint === "—" ? "S1" : row.d11Hint };
  });
}

function isGroupR3Candidate(
  group: CollectorGroupHealthRow,
  allGroups: CollectorGroupHealthRow[]
): boolean {
  if (group.moduleCount === 0) return false;
  const groupBad =
    group.badModuleCount >= Math.max(1, Math.ceil(group.moduleCount * 0.4));
  const otherOk = allGroups.some(
    (g) => g.id !== group.id && g.status === "ok" && g.moduleCount > 0
  );
  return groupBad && otherOk;
}
