import { hintsFromPoints } from "@/lib/admin/health/d11-map";
import { MQTT_BROKER_MOD_CAPACITY } from "@/lib/admin/health/build-health-dag";
import { healthNodeTitle, countHealthStatuses } from "@/lib/admin/health/health-ui-labels";
import type { HealthNodeId, HealthSnapshot, HealthStatus } from "@/lib/admin/health/types";
import { HEALTH_STATUS_LABEL } from "@/lib/admin/health/types";

export type PeekAnchor = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type HealthDagNodeSelectPayload = {
  drillId: HealthNodeId;
  dagNodeId: string;
  anchor: PeekAnchor;
};

export function domRectToPeekAnchor(rect: DOMRect): PeekAnchor {
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

export type NodePeekContent = {
  nodeId: HealthNodeId;
  title: string;
  status: HealthStatus;
  kpis: string[];
  d11Line?: string;
};

function nodeStatus(snapshot: HealthSnapshot, nodeId: HealthNodeId): HealthStatus {
  const pipeline = snapshot.pipeline.find((n) => n.id === nodeId);
  if (pipeline) return pipeline.status;
  const collector = snapshot.collectorSub.find((n) => n.id === nodeId);
  if (collector) return collector.status;
  return "unknown";
}

function farmCount(modules: HealthSnapshot["modules"]): number {
  return new Set(modules.map((m) => m.farmId)).size;
}

function statusSummary(counts: Record<HealthStatus, number>): string {
  const parts: string[] = [];
  if (counts.critical > 0) parts.push(`critical ${counts.critical}`);
  if (counts.warn > 0) parts.push(`warn ${counts.warn}`);
  if (counts.ok > 0) parts.push(`ok ${counts.ok}`);
  return parts.join(" · ") || "—";
}

export function buildNodePeekContent(
  nodeId: HealthNodeId,
  snapshot: HealthSnapshot
): NodePeekContent {
  const title = healthNodeTitle(nodeId);
  const status = nodeStatus(snapshot, nodeId);
  const points = snapshot.pointsByNode[nodeId] ?? [];
  const pointHints = hintsFromPoints(points);
  const d11Line = pointHints[0]?.title;

  const kpis: string[] = [];

  switch (nodeId) {
    case "collector-mqtt": {
      const modCount = farmCount(snapshot.modules);
      kpis.push(`${modCount}/${MQTT_BROKER_MOD_CAPACITY} MOD`);
      kpis.push("RS raw 간접 추론");
      break;
    }
    case "collector-rs": {
      const last = snapshot.insertBuckets.at(-1);
      kpis.push(`최근 5분 raw ${last?.count ?? 0}`);
      const zeroRecent = snapshot.insertBuckets.slice(-3).every((b) => b.count === 0);
      if (zeroRecent) kpis.push("0 bucket 연속");
      break;
    }
    case "storage": {
      const lag = points.find((p) => p.label.includes("lag") || p.id.includes("lag"));
      const decode = points.find((p) => p.label.includes("decode") || p.id.includes("decode"));
      if (lag) kpis.push(lag.value);
      else if (decode) kpis.push(decode.value);
      kpis.push(`live ${snapshot.liveRowCount.toLocaleString()} rows`);
      break;
    }
    case "collector-c": {
      kpis.push(`24h 실패 ${snapshot.commandFailures.length}`);
      kpis.push(`checkpoint ${snapshot.commandCheckpointCount}`);
      break;
    }
    case "field-module": {
      kpis.push(statusSummary(countHealthStatuses(snapshot.modules)));
      kpis.push(`${snapshot.modules.length} modules`);
      break;
    }
    case "field-controller": {
      kpis.push(statusSummary(countHealthStatuses(snapshot.controllers)));
      kpis.push(`${snapshot.controllers.length} controllers`);
      break;
    }
    case "dashboard": {
      kpis.push(`${snapshot.liveRowCount}/${snapshot.liveRowLimit} live cap`);
      break;
    }
    case "collector-ekape":
    case "collector-ftp":
    case "external": {
      kpis.push("비활성화");
      break;
    }
    default: {
      for (const p of points.slice(0, 3)) {
        kpis.push(`${p.label}: ${p.value}`);
      }
    }
  }

  if (kpis.length === 0 && points.length > 0) {
    for (const p of points.slice(0, 3)) {
      kpis.push(`${p.label}: ${p.value}`);
    }
  }

  if (kpis.length === 0) {
    kpis.push(HEALTH_STATUS_LABEL[status]);
  }

  return {
    nodeId,
    title,
    status,
    kpis: kpis.slice(0, 3),
    d11Line,
  };
}
