import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  GLOBAL_LIVE_ROW_LIMIT,
  INSERT_BUCKET_COUNT,
  INSERT_BUCKET_MINUTES,
} from "@/lib/admin/health/constants";
import {
  d11HintForInsertRate,
  d11HintForLiveCap,
  hintsFromModules,
  scopeFromModules,
} from "@/lib/admin/health/d11-map";
import {
  aggregateControllers,
  aggregateModulesFromLive,
  mapDbRowsToLiveHealth,
  mapLiveLatestDbRowsToLiveHealth,
  rollupFieldStatus,
  type DbLiveRow,
  type DbLiveLatestRow,
} from "@/lib/admin/health/aggregate-controllers";
import {
  aggregateCollectorGroups,
} from "@/lib/admin/health/aggregate-collector-groups";
import {
  resolveCollectorGroups,
} from "@/lib/admin/health/collector-groups";
import { fetchGroupInsertBuckets } from "@/lib/admin/health/group-insert-buckets";
import { fetchCommandHealth } from "@/lib/admin/health/fetch-command-health";
import {
  buildHealthAlerts,
  r3GroupSummary,
} from "@/lib/admin/health/health-events";
import {
  fetchEkapeHealth,
  ftpPoints,
  mqttPoints,
} from "@/lib/admin/health/fetch-ekape-health";
import { formatHealthTime } from "@/lib/admin/health/format-health-time";
import { worstStatus } from "@/lib/admin/health/staleness";
import type {
  CollectorNodeState,
  CommandFailureItem,
  CommandTimelineItem,
  ControllerHealthRow,
  D11Hint,
  HealthPoint,
  HealthSnapshot,
  HealthStatus,
  InsertBucket,
  ModuleHealthRow,
  PipelineNodeState,
} from "@/lib/admin/health/types";

/** COL rollup: uplink only (MQTT → RS). C·Ekape·FTP는 별도 노드. */
const COLLECTOR_ROLLUP_IDS = new Set([
  "collector-mqtt",
  "collector-rs",
]);

function formatBucketLabel(iso: string): string {
  return formatHealthTime(iso);
}

async function countRawBetween(
  admin: ReturnType<typeof createAdminClient>,
  startIso: string,
  endIso: string
): Promise<number> {
  const { count, error } = await admin
    .from("iot_room_state_raw")
    .select("id", { count: "exact", head: true })
    .gte("received_at", startIso)
    .lt("received_at", endIso);

  if (error) return 0;
  return count ?? 0;
}

async function fetchInsertBuckets(
  admin: ReturnType<typeof createAdminClient>,
  nowMs: number
): Promise<InsertBucket[]> {
  const buckets: InsertBucket[] = [];
  for (let i = INSERT_BUCKET_COUNT - 1; i >= 0; i--) {
    const endMs = nowMs - i * INSERT_BUCKET_MINUTES * 60 * 1000;
    const startMs = endMs - INSERT_BUCKET_MINUTES * 60 * 1000;
    const count = await countRawBetween(
      admin,
      new Date(startMs).toISOString(),
      new Date(endMs).toISOString()
    );
    buckets.push({
      label: formatBucketLabel(new Date(startMs).toISOString()),
      count,
    });
  }
  return buckets;
}

function fieldModulePoints(modules: ModuleHealthRow[]): HealthPoint[] {
  if (modules.length === 0) {
    return [
      {
        id: "mod.uplink.activity",
        label: "모듈 uplink",
        value: "데이터 없음",
        status: "unknown",
        d11Hint: "S1",
      },
    ];
  }

  const worst = worstStatus(modules.map((m) => m.status));
  const lowCoverage = modules.filter(
    (m) => (m.coveragePct ?? 100) < 80
  ).length;

  return [
    {
      id: "mod.uplink.activity",
      label: "모듈 uplink (worst)",
      value: `${modules.length} modules · worst ${worst}`,
      status: worst,
      d11Hint: worst === "critical" ? "S1" : worst === "warn" ? "S3" : undefined,
    },
    {
      id: "mod.device.coverage",
      label: "coverage < 80%",
      value: `${lowCoverage} / ${modules.length} modules`,
      status: lowCoverage > 0 ? "warn" : "ok",
      d11Hint: lowCoverage > 0 ? "S5" : undefined,
    },
    {
      id: "mod.staleness.worst",
      label: "worst last seen",
      value: `${modules[0]?.ageMin?.toFixed(1) ?? "—"} min`,
      status: modules[0]?.status ?? "unknown",
    },
  ];
}

function fieldControllerPoints(controllers: ControllerHealthRow[]): HealthPoint[] {
  if (controllers.length === 0) {
    return [
      {
        id: "ctrl.raw.latest",
        label: "장비 last seen",
        value: "데이터 없음",
        status: "unknown",
        d11Hint: "S1",
      },
    ];
  }

  const worst = worstStatus(controllers.map((c) => c.status));
  const criticalCount = controllers.filter((c) => c.status === "critical").length;

  return [
    {
      id: "ctrl.raw.latest",
      label: "장비 last seen (worst)",
      value: `${controllers.length} ctrl · ${criticalCount} critical`,
      status: worst,
      d11Hint:
        criticalCount === 1
          ? "S5"
          : worst === "critical"
            ? "S1"
            : worst === "warn"
              ? "S3"
              : undefined,
    },
    {
      id: "ctrl.decode.live",
      label: "live decode (샘플)",
      value: "v_iot_live_latest 기반",
      status: worst === "critical" ? "warn" : "ok",
    },
    {
      id: "ctrl.identity",
      label: "D3 키 필드",
      value: "lsind·item·module·controller_key",
      status: "ok",
    },
  ];
}

function insertRateStatus(buckets: InsertBucket[]): HealthStatus {
  const recent = buckets.slice(-2);
  if (recent.every((b) => b.count === 0)) return "critical";
  if (recent.some((b) => b.count === 0)) return "warn";
  return "ok";
}

function rsPoints(buckets: InsertBucket[]): HealthPoint[] {
  const recent = buckets.slice(-2);
  const rateStatus = insertRateStatus(buckets);
  return [
    {
      id: "rs.raw.insert_rate",
      label: "원본 INSERT rate (5m)",
      value: `${recent[recent.length - 1]?.count ?? 0} rows / 5m`,
      status: rateStatus,
      d11Hint: d11HintForInsertRate(recent.every((b) => b.count === 0)),
    },
    {
      id: "rs.raw.latency",
      label: "received_at skew",
      value: "패시브 추정",
      status: rateStatus === "ok" ? "ok" : "warn",
    },
    {
      id: "rs.topic.integrity",
      label: "topic·농장키 null",
      value: "—",
      status: "unknown",
    },
  ];
}

function storagePoints(dbOk: boolean): HealthPoint[] {
  return [
    {
      id: "db.connectivity",
      label: "DB 연결",
      value: dbOk ? "success" : "fail",
      status: dbOk ? "ok" : "critical",
      d11Hint: dbOk ? undefined : "S2",
    },
    {
      id: "db.views.live",
      label: "v_iot_live_latest",
      value: dbOk ? "accessible" : "—",
      status: dbOk ? "ok" : "critical",
    },
  ];
}

function dashboardPoints(liveCount: number, dbOk: boolean): HealthPoint[] {
  const capHint = d11HintForLiveCap(liveCount, GLOBAL_LIVE_ROW_LIMIT);
  const capStatus: HealthStatus =
    liveCount >= GLOBAL_LIVE_ROW_LIMIT * 0.9
      ? "warn"
      : dbOk
        ? "ok"
        : "critical";

  return [
    {
      id: "ui.live.query",
      label: "live snapshot 조회",
      value: dbOk ? "ok" : "fail",
      status: dbOk ? "ok" : "critical",
      d11Hint: dbOk ? undefined : "S2",
    },
    {
      id: "ui.global.limit",
      label: "전역 ctrl 상한",
      value: `${liveCount} / ${GLOBAL_LIVE_ROW_LIMIT} ctrl`,
      status: capStatus,
      d11Hint: capHint,
    },
  ];
}

function dedupeHints(hints: D11Hint[]): D11Hint[] {
  const seen = new Set<string>();
  return hints.filter((h) => {
    if (seen.has(h.id)) return false;
    seen.add(h.id);
    return true;
  });
}

export const fetchHealthSnapshot = cache(async (): Promise<HealthSnapshot> => {
  const nowMs = Date.now();
  const fetchedAt = new Date(nowMs).toISOString();

  let dbOk = false;
  let liveRowCount = 0;
  let insertBuckets: InsertBucket[] = [];
  let modules: ModuleHealthRow[] = [];
  let controllers: ControllerHealthRow[] = [];
  let commandHealth = {
    status: "unknown" as HealthStatus,
    points: [] as HealthPoint[],
    activeFailures: [] as CommandFailureItem[],
    checkpointCount: 0,
    timeline: [] as CommandTimelineItem[],
  };
  const ekapeHealth = await fetchEkapeHealth();

  try {
    const admin = createAdminClient();

    const [buckets, liveCountRes, liveRowsRes, cmdHealth] = await Promise.all([
      fetchInsertBuckets(admin, nowMs),
      admin
        .from("v_iot_live_latest")
        .select("controller_key", { count: "exact", head: true }),
      admin
        .from("v_iot_live_latest")
        .select(
          "lsind_regist_no, item_code, module_uid, controller_key, packet_mode, received_at"
        )
        .order("received_at", { ascending: false })
        .limit(GLOBAL_LIVE_ROW_LIMIT),
      fetchCommandHealth(nowMs),
    ]);

    let resolvedCountRes = liveCountRes;
    let resolvedRowsRes: typeof liveRowsRes = liveRowsRes;
    let useLiveLatest = !liveCountRes.error && !liveRowsRes.error;

    if (!useLiveLatest) {
      const [rawCountRes, rawRowsRes] = await Promise.all([
        admin
          .from("v_iot_raw_live")
          .select("id", { count: "exact", head: true }),
        admin
          .from("v_iot_raw_live")
          .select(
            "id, lsind_regist_no, item_code, module_uid, received_at, payload_bytea"
          )
          .order("received_at", { ascending: false })
          .limit(GLOBAL_LIVE_ROW_LIMIT),
      ]);
      resolvedCountRes = rawCountRes as typeof liveCountRes;
      resolvedRowsRes = rawRowsRes as typeof liveRowsRes;
      useLiveLatest = false;
    }

    insertBuckets = buckets;
    dbOk = !resolvedCountRes.error && !resolvedRowsRes.error;
    liveRowCount = resolvedCountRes.count ?? 0;
    commandHealth = cmdHealth;

    if (resolvedRowsRes.data) {
      const liveRows = useLiveLatest
        ? mapLiveLatestDbRowsToLiveHealth(
            resolvedRowsRes.data as DbLiveLatestRow[]
          )
        : mapDbRowsToLiveHealth(resolvedRowsRes.data as DbLiveRow[]);
      modules = aggregateModulesFromLive(liveRows, nowMs);
      controllers = aggregateControllers(liveRows, nowMs);
    }
  } catch {
    dbOk = false;
  }

  const rsStatus = insertRateStatus(insertBuckets);

  const groupDefs = resolveCollectorGroups(modules);
  let groupBuckets = new Map<string, InsertBucket[]>();
  try {
    groupBuckets = await fetchGroupInsertBuckets(groupDefs, nowMs);
  } catch {
    /* empty buckets */
  }
  const collectorGroups = aggregateCollectorGroups(
    groupDefs,
    modules,
    groupBuckets
  );

  const mqttStatus: HealthStatus =
    rsStatus === "ok" ? "ok" : rsStatus === "warn" ? "warn" : "critical";

  const fieldStatus = rollupFieldStatus(modules, controllers);

  const storageStatus = dbOk ? "ok" : "critical";
  const dashboardStatus = worstStatus([
    dbOk ? "ok" : "critical",
    liveRowCount >= GLOBAL_LIVE_ROW_LIMIT * 0.9 ? "warn" : "ok",
  ]);

  const collectorSub: CollectorNodeState[] = [
    {
      id: "collector-mqtt",
      label: "Mosquitto",
      short: "MQTT",
      status: mqttStatus,
      d11Hints: rsStatus !== "ok" ? ["S1"] : [],
    },
    {
      id: "collector-rs",
      label: "RS 수신",
      short: "RS",
      status: rsStatus,
      d11Hints: rsStatus !== "ok" ? ["S1"] : [],
    },
    {
      id: "collector-c",
      label: "C 명령",
      short: "C",
      status: commandHealth.status,
      d11Hints: commandHealth.status !== "ok" ? ["S4"] : [],
    },
    {
      id: "collector-ekape",
      label: "Ekape job",
      short: "EK",
      status: "not_implemented",
      d11Hints: [],
    },
    {
      id: "collector-ftp",
      label: "FTP Worker",
      short: "FTP",
      status: "not_implemented",
      d11Hints: [],
    },
  ];

  const collectorRollup = worstStatus(
    collectorSub
      .filter((n) => COLLECTOR_ROLLUP_IDS.has(n.id))
      .map((n) => n.status)
  );

  const pipeline: PipelineNodeState[] = [
    {
      id: "field-controller",
      label: "환경 컨트롤러",
      short: "CTRL",
      status: fieldStatus,
      d11Hints: fieldStatus !== "ok" ? ["S3", "S5"] : [],
      href: "/admin/health/field-controller",
    },
    {
      id: "field-module",
      label: "통신 모듈",
      short: "MOD",
      status: fieldStatus,
      d11Hints: fieldStatus === "critical" ? ["S1"] : ["S5"],
      href: "/admin/health/field-module",
    },
    {
      id: "collector",
      label: "수집 서버",
      short: "COL",
      status: collectorRollup,
      d11Hints: collectorRollup !== "ok" ? ["S1"] : [],
      href: "/admin/health/collector",
    },
    {
      id: "storage",
      label: "데이터 저장소",
      short: "DB",
      status: storageStatus,
      d11Hints: storageStatus !== "ok" ? ["S2"] : [],
      href: "/admin/health/storage",
    },
    {
      id: "dashboard",
      label: "관리 화면",
      short: "UI",
      status: dashboardStatus,
      d11Hints: dashboardStatus !== "ok" ? ["S2"] : [],
      href: "/admin/health/dashboard",
    },
    {
      id: "external",
      label: "외부 연계",
      short: "EXT",
      status: "not_implemented",
      d11Hints: [],
      href: "/admin/health/external",
    },
  ];

  const statusCounts: Record<HealthStatus, number> = {
    ok: 0,
    warn: 0,
    critical: 0,
    unknown: 0,
    not_implemented: 0,
  };
  for (const n of pipeline) {
    statusCounts[n.status] += 1;
  }
  statusCounts.not_implemented += 1;

  const d11Hints = hintsFromModules(modules);
  if (rsStatus !== "ok") {
    d11Hints.unshift({
      id: "S1",
      title: "측정이 안 옴",
      summary: "다른 농장에 새 데이터가 오는지 확인 → R2 vs R3 분기",
    });
  }
  if (dashboardStatus === "warn") {
    d11Hints.push({
      id: "S2",
      title: "화면에 안 보임",
      summary: "live View·ctrl 상한(1500)·decode 오류 확인 (R4)",
    });
  }

  if (
    commandHealth.activeFailures.length > 0 &&
    commandHealth.status !== "ok" &&
    commandHealth.status !== "unknown"
  ) {
    d11Hints.push({
      id: "S4",
      title: "명령이 안 먹음",
      summary: "uplink 정상 후 명령 대기열 pending/sent 확인 · 체크포인트로 검토 완료 표시 가능",
    });
  }
  const impactScope =
    r3GroupSummary(collectorGroups) ?? scopeFromModules(modules);

  const snapshotBody = {
    fetchedAt,
    insertBuckets,
    liveRowCount,
    liveRowLimit: GLOBAL_LIVE_ROW_LIMIT,
    dbOk,
    modules,
    controllers,
    collectorGroups,
    pipeline,
    collectorSub,
    statusCounts,
    d11Hints: dedupeHints(d11Hints),
    impactScope,
    commandFailures: commandHealth.activeFailures,
    commandCheckpointCount: commandHealth.checkpointCount,
    commandTimeline: commandHealth.timeline,
    pointsByNode: {
      "field-controller": fieldControllerPoints(controllers),
      "field-module": fieldModulePoints(modules),
      "collector-mqtt": mqttPoints(rsStatus),
      "collector-rs": rsPoints(insertBuckets),
      "collector-c": commandHealth.points,
      "collector-ekape": ekapeHealth.points,
      "collector-ftp": ftpPoints(),
      external: ekapeHealth.externalPoints,
      storage: storagePoints(dbOk),
      dashboard: dashboardPoints(liveRowCount, dbOk),
    },
  };

  return {
    ...snapshotBody,
    activeAlerts: buildHealthAlerts({
      ...snapshotBody,
      activeAlerts: [],
    }),
  };
});

export function modulesForFarm(
  modules: ModuleHealthRow[],
  farmId: string
): ModuleHealthRow[] {
  return modules.filter((m) => m.farmId === farmId);
}

export function controllersForFarm(
  controllers: ControllerHealthRow[],
  farmId: string
): ControllerHealthRow[] {
  return controllers.filter((c) => c.farmId === farmId);
}

export function nodeTitle(nodeId: string): string {
  const map: Record<string, string> = {
    collector: "수집 서버 · 5세분",
    "collector-rs": "RS 수신",
    "collector-mqtt": "Mosquitto",
    "collector-c": "C 명령",
    "collector-ekape": "Ekape job",
    "collector-ftp": "FTP Worker",
    storage: "데이터 저장소",
    dashboard: "관리 화면",
    external: "외부 연계",
    "field-module": "통신 모듈",
    "field-controller": "환경 컨트롤러",
  };
  return map[nodeId] ?? nodeId;
}

export function isKnownHealthNode(nodeId: string): boolean {
  return [
    "collector",
    "collector-rs",
    "collector-mqtt",
    "collector-c",
    "collector-ekape",
    "collector-ftp",
    "storage",
    "dashboard",
    "external",
    "field-module",
    "field-controller",
  ].includes(nodeId);
}
