import { ADMIN_OPS_BASE_PATH } from "@/lib/admin/ops-tabs";
import type { HealthNodeId } from "@/lib/admin/health/types";

const HEALTH_NODE_IDS = new Set<string>([
  "field-controller",
  "field-module",
  "collector",
  "storage",
  "dashboard",
  "external",
  "collector-mqtt",
  "collector-rs",
  "collector-c",
  "collector-ekape",
  "collector-ftp",
]);

export function parseHealthNodeId(raw: string | null | undefined): HealthNodeId | null {
  const id = raw?.trim();
  if (!id || !HEALTH_NODE_IDS.has(id)) return null;
  return id as HealthNodeId;
}

export type AdminOpsHealthLink = {
  node?: string;
  farm?: string;
  /** Open farm/module panel automatically */
  modules?: boolean;
};

/** Admin ops system tab in-page drill-down query links */
export function adminOpsHealthHref(opts?: AdminOpsHealthLink): string {
  const params = new URLSearchParams();
  const node = parseHealthNodeId(opts?.node);
  if (node) params.set("node", node);
  const farm = opts?.farm?.trim();
  if (farm) params.set("farm", farm);
  if (opts?.modules) params.set("modules", "1");
  const q = params.toString();
  return q ? `${ADMIN_OPS_BASE_PATH}?${q}` : ADMIN_OPS_BASE_PATH;
}
