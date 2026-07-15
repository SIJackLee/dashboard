import { SEVERITY_ORDER } from "@/lib/admin/health/health-ui-labels";
import { worstStatus } from "@/lib/admin/health/staleness";
import type { HealthNodeId, HealthSnapshot, HealthStatus } from "@/lib/admin/health/types";

export type DagNodeKind = "rollup" | "instance" | "infra" | "external";
export type DagEdgeLane = "uplink" | "downlink" | "side";

export type HealthDagNode = {
  id: string;
  drillId: HealthNodeId;
  label: string;
  short: string;
  status: HealthStatus;
  kind: DagNodeKind;
  metric?: string;
  inUplink: boolean;
  /** 클릭 시 drawer 대신 현장 rank 펼침/접힘 */
  togglesField?: boolean;
};

export type HealthDagEdge = {
  from: string;
  to: string;
  lane: DagEdgeLane;
};

export type HealthDagGraph = {
  nodes: HealthDagNode[];
  edges: HealthDagEdge[];
};

export type BuildHealthDagOptions = {
  /** P4: false=농장 1노드 rollup · true=농장별 MOD 노드 */
  fieldExpanded?: boolean;
};

/** 농장당 환경 컨트롤러 슬롯 (sim_fleet 48C/farm) */
const CONTROLLERS_PER_FARM = 48;

/** MQTT 브로커 통신모듈 수용 한도 */
export const MQTT_BROKER_MOD_CAPACITY = 20;

/** P2: 농장 펼침 시 zone1 그리드 열 수 (10농장 → 2×5) */
const DAG_FARM_GRID_COLUMNS = 2;

/** S4 가변폭 노드 스케일 (2×) */
const DAG_NODE_WIDTH = {
  min: 200,
  base: 280,
  wide: 336,
  mqtt: 360,
} as const;

export const DAG_S4_LAYOUT = {
  nodeWidth: DAG_NODE_WIDTH.base,
  nodeHeight: 148,
  rankGap: 96,
  nodeGap: 20,
  padding: 48,
} as const;

const WIDE_NODE_IDS = new Set(["ui", "ext-link"]);
const BASE_NODE_IDS = new Set(["field", "rs", "c-cmd", "decode", "db"]);

export type BuildHealthDagNodeWidthsOptions = {
  fieldExpanded?: boolean;
  /** spread 5구역 중 zone1(농장) 가로폭 — 2열 노드 폭 산출 */
  farmZoneWidth?: number;
};

/** S4: 라벨·역할에 따라 노드 가로폭 분기 */
export function buildHealthDagNodeWidths(
  graph: HealthDagGraph,
  options: BuildHealthDagNodeWidthsOptions = {}
): Record<string, number> {
  const { fieldExpanded, farmZoneWidth } = options;
  const widths: Record<string, number> = {};
  let farmCellW: number = DAG_NODE_WIDTH.min;

  if (fieldExpanded && farmZoneWidth != null && farmZoneWidth > 0) {
    const cols = DAG_FARM_GRID_COLUMNS;
    farmCellW = Math.floor(
      (farmZoneWidth - DAG_S4_LAYOUT.nodeGap * (cols - 1)) / cols
    );
    farmCellW = Math.max(180, Math.min(farmCellW, DAG_NODE_WIDTH.min));
  }

  for (const node of graph.nodes) {
    if (node.id === "mqtt") {
      widths[node.id] = DAG_NODE_WIDTH.mqtt;
    } else if (node.id.startsWith("mod-") && fieldExpanded) {
      widths[node.id] = farmCellW;
    } else if (WIDE_NODE_IDS.has(node.id) || node.short.length >= 7) {
      widths[node.id] = DAG_NODE_WIDTH.wide;
    } else if (BASE_NODE_IDS.has(node.id)) {
      widths[node.id] = DAG_NODE_WIDTH.base;
    } else {
      widths[node.id] = DAG_NODE_WIDTH.base;
    }
  }
  return widths;
}

/** P2: 농장 rank 2열 그리드 */
export function buildHealthDagRankColumns(
  graph: HealthDagGraph,
  fieldExpanded: boolean
): Record<number, number> {
  if (!fieldExpanded) return {};
  const hasFarmMods = graph.nodes.some((n) => n.id.startsWith("mod-"));
  if (!hasFarmMods) return {};
  return { 0: DAG_FARM_GRID_COLUMNS };
}

function controllerCountForFarm(
  controllers: HealthSnapshot["controllers"],
  farmId: string
): number {
  return controllers.filter(
    (c) => c.farmId === farmId && c.status !== "unknown"
  ).length;
}

type FarmRollup = {
  farmId: string;
  farmLabel: string;
  module: HealthSnapshot["modules"][number];
};

function pipelineNode(snapshot: HealthSnapshot, id: HealthDagNode["drillId"]) {
  return snapshot.pipeline.find((n) => n.id === id);
}

function collectorSub(snapshot: HealthSnapshot, id: string) {
  return snapshot.collectorSub.find((n) => n.id === id);
}

function decodeStatus(snapshot: HealthSnapshot): {
  status: HealthStatus;
  metric: string;
} {
  const lag = snapshot.pointsByNode.storage?.find((p) => p.id === "db.decode.lag");
  const failed = snapshot.pointsByNode.storage?.find(
    (p) => p.id === "db.decode.failed"
  );
  const status =
    lag?.status === "critical" || failed?.status === "warn"
      ? lag?.status === "critical"
        ? "critical"
        : "warn"
      : (lag?.status ?? "ok");
  const lagVal = lag?.value?.replace(" rows", "") ?? "0";
  return { status, metric: `lag ${lagVal}` };
}

function recentInsert(snapshot: HealthSnapshot): string {
  const recent = snapshot.insertBuckets.at(-1)?.count ?? 0;
  return `${recent}/5m`;
}

function farmsFromModules(modules: HealthSnapshot["modules"]): FarmRollup[] {
  const byFarm = new Map<string, HealthSnapshot["modules"]>();
  for (const m of modules) {
    const list = byFarm.get(m.farmId) ?? [];
    list.push(m);
    byFarm.set(m.farmId, list);
  }

  return [...byFarm.entries()]
    .map(([farmId, rows]) => {
      const sorted = [...rows].sort((a, b) => {
        const sd = SEVERITY_ORDER[a.status] - SEVERITY_ORDER[b.status];
        if (sd !== 0) return sd;
        return (b.ageMin ?? 0) - (a.ageMin ?? 0);
      });
      return {
        farmId,
        farmLabel: sorted[0].farmLabel,
        module: sorted[0],
      };
    })
    .sort((a, b) => {
      const sd = SEVERITY_ORDER[a.module.status] - SEVERITY_ORDER[b.module.status];
      if (sd !== 0) return sd;
      return (b.module.ageMin ?? 0) - (a.module.ageMin ?? 0);
    });
}

function farmShortLabel(farmLabel: string, farmId: string): string {
  const part = farmLabel.split("·")[0]?.trim();
  if (part) return part.replace(/\s+/g, "");
  return farmId.split("/")[0] ?? farmId;
}

function mqttNodeIdForFarm(): string {
  return "mqtt";
}

function addInfraTail(
  snapshot: HealthSnapshot,
  nodes: HealthDagNode[],
  edges: HealthDagEdge[],
  rsFromIds: string[]
) {
  const rs = collectorSub(snapshot, "collector-rs");
  nodes.push({
    id: "rs",
    drillId: "collector-rs",
    label: rs?.label ?? "수집 서버",
    short: "수집 서버",
    status: rs?.status ?? "unknown",
    kind: "infra",
    metric: recentInsert(snapshot),
    inUplink: true,
  });

  for (const from of rsFromIds) {
    edges.push({ from, to: "rs", lane: "uplink" });
  }

  const decode = decodeStatus(snapshot);
  nodes.push({
    id: "decode",
    drillId: "storage",
    label: "decode-batch Edge 함수",
    short: "Edge 함수",
    status: decode.status,
    kind: "infra",
    metric: decode.metric,
    inUplink: true,
  });
  edges.push({ from: "rs", to: "decode", lane: "uplink" });

  const db = pipelineNode(snapshot, "storage");
  nodes.push({
    id: "db",
    drillId: "storage",
    label: db?.label ?? "데이터 저장소",
    short: db?.short ?? "DB",
    status: db?.status ?? "unknown",
    kind: "infra",
    inUplink: true,
  });
  edges.push({ from: "decode", to: "db", lane: "uplink" });

  const ui = pipelineNode(snapshot, "dashboard");
  nodes.push({
    id: "ui",
    drillId: "dashboard",
    label: ui?.label ?? "사용자 화면",
    short: "사용자 화면",
    status: ui?.status ?? "unknown",
    kind: "infra",
    inUplink: true,
  });
  edges.push({ from: "db", to: "ui", lane: "uplink" });

  const cCmd = collectorSub(snapshot, "collector-c");
  nodes.push({
    id: "c-cmd",
    drillId: "collector-c",
    label: cCmd?.label ?? "명령 서버",
    short: "명령 서버",
    status: cCmd?.status ?? "unknown",
    kind: "external",
    inUplink: false,
  });
  edges.push({ from: "db", to: "c-cmd", lane: "downlink" });
  edges.push({ from: "c-cmd", to: "mqtt", lane: "downlink" });

  const ek = collectorSub(snapshot, "collector-ekape");
  const ftp = collectorSub(snapshot, "collector-ftp");
  nodes.push({
    id: "ext-link",
    drillId: "external",
    label: "외부연계 서버",
    short: "외부연계 서버",
    status: worstStatus([
      ek?.status ?? "not_implemented",
      ftp?.status ?? "not_implemented",
    ]),
    kind: "external",
    inUplink: false,
  });
  edges.push({ from: "db", to: "ext-link", lane: "side" });
}

function addMqttLayer(snapshot: HealthSnapshot, nodes: HealthDagNode[]): string[] {
  const mqttBase = collectorSub(snapshot, "collector-mqtt");
  const modCount = farmsFromModules(snapshot.modules).length;

  nodes.push({
    id: "mqtt",
    drillId: "collector-mqtt",
    label: mqttBase?.label ?? "MQTT 브로커 서버",
    short: "MQTT 브로커 서버",
    status: mqttBase?.status ?? "unknown",
    kind: "infra",
    metric: `${modCount}/${MQTT_BROKER_MOD_CAPACITY} MOD`,
    inUplink: true,
  });
  return ["mqtt"];
}

/** DAG 가로 5구역 (농장 → MQTT → 수집·명령 → 저장 → 표시·외부) */
export const DAG_ZONE_COUNT = 5;

/** 구역 하단 라벨 (rank 순서와 1:1) */
export const DAG_ZONE_LABELS = [
  "농장",
  "MQTT",
  "수집",
  "저장",
  "표시",
] as const;

export function buildHealthDagRankOverrides(
  graph: HealthDagGraph,
  fieldExpanded: boolean
): Record<string, number> {
  const ids = new Set(graph.nodes.map((n) => n.id));
  const ranks: Record<string, number> = {};
  let r = 0;

  if (fieldExpanded) {
    const farmRank = r;
    const modIds = [...ids].filter((x) => x.startsWith("mod-")).sort();
    for (const id of modIds) ranks[id] = farmRank;
    if (modIds.length > 0) r++;
  } else if (ids.has("field")) {
    ranks["field"] = r++;
  }

  if (ids.has("mqtt")) ranks["mqtt"] = r++;

  const collectRank = r;
  if (ids.has("rs")) ranks["rs"] = collectRank;
  if (ids.has("c-cmd")) ranks["c-cmd"] = collectRank;
  if (ids.has("rs") || ids.has("c-cmd")) r++;

  const storageRank = r;
  if (ids.has("decode")) ranks["decode"] = storageRank;
  if (ids.has("db")) ranks["db"] = storageRank;
  if (ids.has("decode") || ids.has("db")) r++;

  const displayRank = r;
  if (ids.has("ui")) ranks["ui"] = displayRank;
  if (ids.has("ext-link")) ranks["ext-link"] = displayRank;

  return ranks;
}

/** HealthSnapshot → DAG nodes/edges · P1 rollup + P4 field collapse */
export function buildHealthDag(
  snapshot: HealthSnapshot,
  options: BuildHealthDagOptions = {}
): HealthDagGraph {
  const fieldExpanded = options.fieldExpanded ?? false;
  const nodes: HealthDagNode[] = [];
  const edges: HealthDagEdge[] = [];
  const farms = farmsFromModules(snapshot.modules);
  const mqttIds = addMqttLayer(snapshot, nodes);

  if (!fieldExpanded) {
    const fieldStatuses = [
      ...snapshot.modules.map((m) => m.status),
      ...snapshot.controllers.map((c) => c.status),
    ];
    const totalCtrl = snapshot.controllers.length;

    nodes.unshift({
      id: "field",
      drillId: "field-module",
      label: "농장",
      short: "농장",
      status: worstStatus(fieldStatuses.length ? fieldStatuses : ["unknown"]),
      kind: "rollup",
      metric: `${farms.length}/${MQTT_BROKER_MOD_CAPACITY} MOD · ${totalCtrl}C`,
      inUplink: true,
      togglesField: true,
    });

    for (const mqttId of mqttIds) {
      edges.push({ from: "field", to: mqttId, lane: "uplink" });
    }
  } else {
    for (const farm of farms) {
      const id = `mod-${farm.farmId.replace("/", "--")}`;
      const short = farmShortLabel(farm.farmLabel, farm.farmId);
      const ctrlCount = controllerCountForFarm(snapshot.controllers, farm.farmId);
      nodes.push({
        id,
        drillId: "field-module",
        label: `${farm.farmLabel} ${farm.module.moduleLabel}`,
        short,
        status: farm.module.status,
        kind: "instance",
        metric: `${ctrlCount}C`,
        inUplink: true,
      });
      const mqttId = mqttNodeIdForFarm();
      edges.push({ from: id, to: mqttId, lane: "uplink" });
    }
  }

  addInfraTail(snapshot, nodes, edges, mqttIds);

  return { nodes, edges };
}
