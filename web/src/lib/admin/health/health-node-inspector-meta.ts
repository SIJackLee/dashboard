import { classifyHealthError } from "@/lib/admin/health/d11-map";
import { formatHealthAgeMin } from "@/lib/admin/health/format-health-time";
import { healthNodeTitle } from "@/lib/admin/health/health-ui-labels";
import type {
  HealthNodeId,
  HealthPoint,
  HealthSnapshot,
  HealthStatus,
} from "@/lib/admin/health/types";
import { HEALTH_STATUS_LABEL } from "@/lib/admin/health/types";

const NODE_SHORT: Record<string, string> = {
  "field-module": "농장",
  "field-controller": "제어",
  "collector-mqtt": "MQTT",
  "collector-rs": "수집",
  collector: "수집",
  "collector-c": "명령",
  storage: "DB",
  dashboard: "화면",
  external: "연계",
  "collector-ekape": "연계",
  "collector-ftp": "연계",
};

export function healthNodeShort(nodeId: string): string {
  return NODE_SHORT[nodeId] ?? healthNodeTitle(nodeId);
}

export function healthNodeStatus(
  nodeId: HealthNodeId,
  snapshot: HealthSnapshot,
): HealthStatus {
  const pipeline = snapshot.pipeline.find((n) => n.id === nodeId);
  if (pipeline) return pipeline.status;
  const collector = snapshot.collectorSub.find((n) => n.id === nodeId);
  if (collector) return collector.status;
  return "unknown";
}

export type HealthNodeTechKind = "proc" | "db" | "probe" | "off" | "src";

export type HealthNodeTechRow = {
  kind: HealthNodeTechKind;
  label: string;
  value: string;
};

export function healthNodeTechRows(
  nodeId: string,
  liveRowLimit?: number,
): HealthNodeTechRow[] {
  switch (nodeId) {
    case "collector-rs":
      return [
        { kind: "proc", label: "프로세스", value: "rsd-rs · RS.py" },
        { kind: "db", label: "원본", value: "iot_room_state_raw" },
        { kind: "probe", label: "프로브", value: "systemd 실측 · 수신 보조" },
      ];
    case "storage":
      return [
        { kind: "db", label: "뷰", value: "v_iot_decoded_latest" },
        { kind: "db", label: "원본", value: "iot_room_state_raw" },
        { kind: "proc", label: "디코드", value: "커서 lag" },
      ];
    case "collector-c":
      return [
        { kind: "db", label: "명령", value: "ctrl_thermo_command" },
        { kind: "db", label: "체크포인트", value: "health_command_checkpoint" },
      ];
    case "collector-mqtt":
      return [
        { kind: "probe", label: "브로커", value: "Mosquitto" },
        { kind: "probe", label: "프로브", value: "listen·왕복 실측" },
      ];
    case "collector-ekape":
    case "collector-ftp":
    case "external":
      return [{ kind: "off", label: "상태", value: "비활성화" }];
    case "field-module":
    case "field-controller":
      return [
        { kind: "src", label: "소스", value: "v_iot_decoded_latest" },
        { kind: "probe", label: "주기", value: "5분 · 10분 주의 · 30분 장애" },
      ];
    case "dashboard":
      return [
        { kind: "db", label: "LIVE 한도", value: String(liveRowLimit ?? "—") },
        { kind: "proc", label: "디코드", value: "대시보드" },
      ];
    default:
      return [];
  }
}

export function healthNodeActionPath(
  nodeId: HealthNodeId,
  snapshot: HealthSnapshot,
) {
  const pipeline = snapshot.pipeline.find((n) => n.id === nodeId);
  const collector = snapshot.collectorSub.find((n) => n.id === nodeId);
  const hint = pipeline?.d11Hints[0] ?? collector?.d11Hints[0] ?? "";
  if (!hint) return null;
  const scope = snapshot.impactScope ?? "—";
  return classifyHealthError(hint, scope, nodeId);
}

/** 기술·빈 값·중복 수치 — 패널에서는 숨김 */
const DRAWER_HIDDEN_POINT_IDS = new Set([
  "ctrl.decode.live",
  "ctrl.identity",
  "rs.raw.latency",
  "rs.topic.integrity",
  "db.views.decoded_latest",
]);

const POINT_SHORT_LABEL: Record<string, string> = {
  "mod.uplink.activity": "모듈",
  "mod.device.coverage": "커버리지",
  "mod.staleness.worst": "최신",
  "ctrl.raw.latest": "장비",
  "rs.raw.insert_rate": "수신",
  "db.connectivity": "연결",
  "db.decode.lag": "디코드 지연",
  "db.decode.failed": "디코드 실패",
  "ui.live.query": "조회",
  "ui.global.limit": "LIVE",
  "mqtt.infer.via_rs": "추론",
  "ftp.worker": "FTP",
  "c.cmd.pending_age": "대기",
  "c.cmd.sent_stuck": "전송",
  "c.cmd.throughput": "적용",
  "c.cmd.checkpoint": "실패",
  "ekape.snap.freshness": "상태",
  "ext.snap.path": "상태",
};

const STATUS_WORD: Record<string, string> = {
  ok: HEALTH_STATUS_LABEL.ok,
  warn: HEALTH_STATUS_LABEL.warn,
  critical: HEALTH_STATUS_LABEL.critical,
  unknown: HEALTH_STATUS_LABEL.unknown,
  not_implemented: HEALTH_STATUS_LABEL.not_implemented,
};

export type CompactDrawerPoint = {
  id: string;
  label: string;
  value: string;
  status: HealthStatus;
  title: string;
};

function compactPointValue(point: HealthPoint): string {
  const { id, value, status } = point;
  switch (id) {
    case "mod.uplink.activity": {
      if (value === "데이터 없음") return "없음";
      const match = value.match(/^(\d+) modules · worst (\w+)$/);
      if (match) {
        return `${match[1]} · ${STATUS_WORD[match[2]] ?? match[2]}`;
      }
      return value;
    }
    case "mod.device.coverage":
      return value.replace(/ modules$/, "");
    case "mod.staleness.worst": {
      const match = value.match(/^([\d.]+) min$/);
      if (match) return formatHealthAgeMin(Number(match[1])) ?? value;
      return value;
    }
    case "ctrl.raw.latest": {
      if (value === "데이터 없음") return "없음";
      const match = value.match(/^(\d+) ctrl · (\d+) critical$/);
      if (match) return `${match[1]} · ${match[2]}장애`;
      return value;
    }
    case "rs.raw.insert_rate":
      return value.replace(" rows / 5m", "/5분");
    case "db.connectivity":
    case "ui.live.query":
      if (value === "success" || value === "ok") return "정상";
      if (value === "fail") return "실패";
      return value;
    case "db.decode.lag":
      return value.replace(" rows", "행");
    case "ui.global.limit":
      return value.replace(" ctrl", "");
    case "mqtt.infer.via_rs":
      if (status === "ok") return "수신 있음";
      if (status === "warn") return "불안정";
      return "수신 없음";
    case "c.cmd.pending_age":
    case "c.cmd.sent_stuck":
    case "c.cmd.throughput":
    case "c.cmd.checkpoint":
      return value
        .replace(/ · 체크포인트 무시 /g, " · 무시 ")
        .replace(/ · 무시됨 /g, " · 무시 ");
    default:
      if (value.startsWith("비활성화")) return "비활성화";
      return value;
  }
}

export function compactDrawerPoints(points: HealthPoint[]): CompactDrawerPoint[] {
  const visible = points.filter((point) => !DRAWER_HIDDEN_POINT_IDS.has(point.id));
  const collapsed = visible.filter((point) => point.value.startsWith("비활성화"));
  const source =
    collapsed.length >= 2
      ? [collapsed[0]!]
      : visible;
  return source.map((point) => ({
    id: point.id,
    label: POINT_SHORT_LABEL[point.id] ?? point.label,
    value: compactPointValue(point),
    status: point.status,
    title: `${point.label}: ${point.value}`,
  }));
}
