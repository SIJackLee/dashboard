export type HealthStatus =
  | "ok"
  | "warn"
  | "critical"
  | "unknown"
  | "not_implemented";

export type PipelineNodeId =
  | "field-controller"
  | "field-module"
  | "collector"
  | "storage"
  | "dashboard"
  | "external";

export type CollectorNodeId =
  | "collector-mqtt"
  | "collector-rs"
  | "collector-c"
  | "collector-ekape"
  | "collector-ftp";

export type HealthNodeId = PipelineNodeId | CollectorNodeId;

export type HealthPoint = {
  id: string;
  label: string;
  value: string;
  status: HealthStatus;
  d11Hint?: string;
};

export type InsertBucket = {
  label: string;
  count: number;
};

export type ModuleHealthRow = {
  id: string;
  farmId: string;
  farmLabel: string;
  moduleUid: number;
  moduleLabel: string;
  controllerCount: number;
  /** 최근 round 내 갱신 장비 비율 (P1) */
  coveragePct?: number;
  lastReceivedAt: string | null;
  ageMin: number | null;
  status: HealthStatus;
  d11Hint: string;
  scope: string;
};

export type ControllerHealthRow = {
  id: string;
  farmId: string;
  farmLabel: string;
  moduleUid: number;
  moduleLabel: string;
  controllerKey: string;
  lastReceivedAt: string | null;
  ageMin: number | null;
  status: HealthStatus;
  d11Hint: string;
};

export type PipelineNodeState = {
  id: PipelineNodeId;
  label: string;
  short: string;
  status: HealthStatus;
  d11Hints: string[];
  href: string;
};

export type CollectorNodeState = {
  id: CollectorNodeId;
  label: string;
  short: string;
  status: HealthStatus;
  d11Hints: string[];
};

export type D11Hint = {
  id: string;
  title: string;
  summary: string;
};

export type CollectorGroupHealthRow = {
  id: string;
  label: string;
  farmIds: string[];
  farmCount: number;
  moduleCount: number;
  badModuleCount: number;
  status: HealthStatus;
  scope: string;
  d11Hint: string;
  insertBuckets: InsertBucket[];
  rsStatus: HealthStatus;
};

export type HealthAlertEvent = {
  id: string;
  severity: HealthStatus;
  nodeId: string;
  nodeLabel: string;
  message: string;
  d11Hint?: string;
  href: string;
  observedAt: string;
};

export type CommandFailureItem = {
  commandId: string;
  status: string;
  farmId: string;
  farmLabel: string;
  moduleUid: number;
  targetLabel: string;
  ageSec: number;
  reason: string;
};

/** C downlink 이벤트 그래프용 (24h ctrl_thermo_command). */
export type CommandTimelineItem = {
  commandId: string;
  lane: string;
  farmLabel: string;
  targetLabel: string;
  createdAt: string;
  sentAt: string | null;
  appliedAt: string | null;
  status: string;
  checkpoint: boolean;
  timelineStatus: HealthStatus;
  reason?: string;
};

export type HealthSnapshot = {
  fetchedAt: string;
  insertBuckets: InsertBucket[];
  liveRowCount: number;
  liveRowLimit: number;
  dbOk: boolean;
  modules: ModuleHealthRow[];
  controllers: ControllerHealthRow[];
  collectorGroups: CollectorGroupHealthRow[];
  activeAlerts: HealthAlertEvent[];
  pipeline: PipelineNodeState[];
  collectorSub: CollectorNodeState[];
  statusCounts: Record<HealthStatus, number>;
  d11Hints: D11Hint[];
  impactScope: string | null;
  pointsByNode: Partial<Record<HealthNodeId, HealthPoint[]>>;
  commandFailures: CommandFailureItem[];
  commandCheckpointCount: number;
  commandTimeline: CommandTimelineItem[];
};

export const HEALTH_STATUS_LABEL: Record<HealthStatus, string> = {
  ok: "정상",
  warn: "주의",
  critical: "장애",
  unknown: "알수없음",
  not_implemented: "미구현",
};
