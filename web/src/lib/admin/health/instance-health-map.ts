import {
  INSTANCE_DISK_WARN_PCT,
  INSTANCE_HEALTH_STALE_UNKNOWN_SEC,
  INSTANCE_HEALTH_STALE_WARN_SEC,
  INSTANCE_MEM_WARN_MB,
} from "@/lib/admin/health/constants";
import { ageSecFromIso, worstStatus } from "@/lib/admin/health/staleness";
import type { HealthPoint, HealthStatus } from "@/lib/admin/health/types";

/** rsd-healthcheck.timer가 upsert하는 EC2 파이프라인 헬스 원본 행. */
export type InstanceHealthRow = {
  instance_id: string;
  checked_at: string;
  overall: string;
  mqtt_status: string;
  rs_status: string;
  c_status: string;
  mqtt_listen: boolean;
  mqtt_roundtrip: boolean;
  rs_active: boolean;
  c_active: boolean;
  disk_used_percent: number | string | null;
  mem_available_mb: number | null;
  raw_last_received_at: string | null;
  raw_last_age_sec: number | null;
  command_last_sent_at: string | null;
  command_last_age_sec: number | null;
  note: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type InstanceFreshness = "fresh" | "warn" | "stale";

export type InstanceHealthSummary = {
  row: InstanceHealthRow | null;
  instanceId: string | null;
  ageSec: number | null;
  freshness: InstanceFreshness;
  /** 서버 신선도가 유효(=stale 아님)면 per-service 상태를 노드에 반영한다. */
  trustPerService: boolean;
  mqttStatus: HealthStatus;
  rsStatus: HealthStatus;
  cStatus: HealthStatus;
  overall: HealthStatus;
  note: string | null;
  points: { mqtt: HealthPoint[]; rs: HealthPoint[]; c: HealthPoint[] };
};

/**
 * 수집/명령 노드의 d11 힌트 결정.
 * - 인스턴스 실측 신뢰 시: 서버가 실제 장애일 때만 힌트(자원 warn은 드릴다운 포인트로만).
 *   warnCounts=true(명령 노드)는 warn도 힌트 대상, false(MQTT/RS)는 critical만.
 * - 폴백 시: 기존 데이터흐름 판정(fallbackBad)을 그대로 사용.
 */
export function collectorNodeHint(
  useInstance: boolean,
  nodeStatus: HealthStatus,
  fallbackBad: boolean,
  code: string,
  opts?: { warnCounts?: boolean },
): string[] {
  const bad = useInstance
    ? opts?.warnCounts
      ? nodeStatus !== "ok" && nodeStatus !== "unknown"
      : nodeStatus === "critical"
    : fallbackBad;
  return bad ? [code] : [];
}

/** instance 상태 문자열(ok/warn/fail) → 대시보드 HealthStatus. */
export function mapInstanceStatus(value: string | null | undefined): HealthStatus {
  switch (value) {
    case "ok":
      return "ok";
    case "warn":
      return "warn";
    case "fail":
      return "critical";
    default:
      return "unknown";
  }
}

/** checked_at 경과로 updater 신선도 판정. */
export function instanceFreshness(
  checkedAtIso: string | null,
  nowMs: number,
): { ageSec: number | null; level: InstanceFreshness } {
  const ageSec = ageSecFromIso(checkedAtIso, nowMs);
  if (ageSec === null) return { ageSec: null, level: "stale" };
  if (ageSec <= INSTANCE_HEALTH_STALE_WARN_SEC) return { ageSec, level: "fresh" };
  if (ageSec <= INSTANCE_HEALTH_STALE_UNKNOWN_SEC) return { ageSec, level: "warn" };
  return { ageSec, level: "stale" };
}

/** 자원(mem/disk) 경고 상태. per-service와 별개로 수집 노드에 합산 반영. */
export function instanceResourceStatus(row: InstanceHealthRow): HealthStatus {
  let status: HealthStatus = "ok";
  if (row.mem_available_mb != null && row.mem_available_mb < INSTANCE_MEM_WARN_MB) {
    status = "warn";
  }
  if (
    row.disk_used_percent != null &&
    Number(row.disk_used_percent) > INSTANCE_DISK_WARN_PCT
  ) {
    status = "warn";
  }
  return status;
}

function formatAge(sec: number | null): string {
  if (sec == null) return "—";
  if (sec < 90) return `${Math.round(sec)}초`;
  const min = sec / 60;
  if (min < 90) return `${Math.round(min)}분`;
  const hr = min / 60;
  if (hr < 48) return `${hr.toFixed(1)}시간`;
  return `${(hr / 24).toFixed(1)}일`;
}

function resourcePoints(row: InstanceHealthRow): HealthPoint[] {
  const points: HealthPoint[] = [];
  if (row.disk_used_percent != null) {
    const pct = Number(row.disk_used_percent);
    const over = pct > INSTANCE_DISK_WARN_PCT;
    points.push({
      id: "host.disk",
      label: "루트 디스크 사용률",
      value: `${pct.toFixed(0)}%`,
      status: over ? "warn" : "ok",
      d11Hint: over ? "S2" : undefined,
    });
  }
  if (row.mem_available_mb != null) {
    const low = row.mem_available_mb < INSTANCE_MEM_WARN_MB;
    points.push({
      id: "host.mem",
      label: "가용 메모리",
      value: `${row.mem_available_mb} MB`,
      status: low ? "warn" : "ok",
      d11Hint: low ? "S2" : undefined,
    });
  }
  return points;
}

function mqttPointsFromRow(row: InstanceHealthRow): HealthPoint[] {
  return [
    {
      id: "mqtt.listen",
      label: "브로커 포트 listen",
      value: row.mqtt_listen ? "수신 대기 중" : "닫힘",
      status: row.mqtt_listen ? "ok" : "critical",
      d11Hint: row.mqtt_listen ? undefined : "S1",
    },
    {
      id: "mqtt.roundtrip",
      label: "local pub/sub 왕복",
      value: row.mqtt_roundtrip ? "정상" : "실패",
      status: row.mqtt_roundtrip ? "ok" : "critical",
      d11Hint: row.mqtt_roundtrip ? undefined : "S1",
    },
  ];
}

function rsPointsFromRow(
  row: InstanceHealthRow,
  freshness: InstanceFreshness,
  ageSec: number | null,
): HealthPoint[] {
  const points: HealthPoint[] = [
    {
      id: "rs.systemd",
      label: "rsd-rs systemd",
      value: row.rs_active ? "active" : "inactive",
      status: row.rs_active ? "ok" : "critical",
      d11Hint: row.rs_active ? undefined : "S1",
    },
    {
      // 서버 노드 색에는 영향 없음(장비 몫). 마지막 수신 경과는 정보로만 표시.
      id: "rs.raw.age",
      label: "최근 raw 수신 경과",
      value: formatAge(row.raw_last_age_sec),
      status: "ok",
    },
    ...resourcePoints(row),
  ];
  if (row.note) {
    points.push({
      id: "rs.note",
      label: "updater note",
      value: row.note,
      status: "ok",
    });
  }
  if (freshness === "warn") {
    points.push({
      id: "rs.updater.delay",
      label: "updater 신선도",
      value: `checked_at ${formatAge(ageSec)} 경과`,
      status: "warn",
      d11Hint: "S2",
    });
  }
  return points;
}

function cPointsFromRow(row: InstanceHealthRow): HealthPoint[] {
  return [
    {
      id: "c.systemd",
      label: "rsd-c systemd",
      value: row.c_active ? "active" : "inactive",
      status: row.c_active ? "ok" : "critical",
      d11Hint: row.c_active ? undefined : "S4",
    },
    {
      id: "c.command.age",
      label: "최근 명령 전송 경과",
      value: formatAge(row.command_last_age_sec),
      status: "ok",
    },
  ];
}

export const EMPTY_INSTANCE_SUMMARY: InstanceHealthSummary = {
  row: null,
  instanceId: null,
  ageSec: null,
  freshness: "stale",
  trustPerService: false,
  mqttStatus: "unknown",
  rsStatus: "unknown",
  cStatus: "unknown",
  overall: "unknown",
  note: null,
  points: { mqtt: [], rs: [], c: [] },
};

/** 원본 행 → 대시보드 소비용 요약(순수 함수, DB 없이 테스트 가능). */
export function summarizeInstanceHealth(
  row: InstanceHealthRow | null,
  nowMs: number,
): InstanceHealthSummary {
  if (!row) return EMPTY_INSTANCE_SUMMARY;

  const { ageSec, level } = instanceFreshness(row.checked_at, nowMs);
  const trustPerService = level !== "stale";
  const rsStatus = worstStatus([
    mapInstanceStatus(row.rs_status),
    instanceResourceStatus(row),
  ]);

  return {
    row,
    instanceId: row.instance_id,
    ageSec,
    freshness: level,
    trustPerService,
    mqttStatus: mapInstanceStatus(row.mqtt_status),
    rsStatus,
    cStatus: mapInstanceStatus(row.c_status),
    overall: mapInstanceStatus(row.overall),
    note: row.note,
    points: {
      mqtt: mqttPointsFromRow(row),
      rs: rsPointsFromRow(row, level, ageSec),
      c: cPointsFromRow(row),
    },
  };
}
