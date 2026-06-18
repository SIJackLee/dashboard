import "server-only";

import type { HealthPoint, HealthStatus } from "@/lib/admin/health/types";

/** Ekape export pipeline disabled — DB objects dropped (migration 20260619000000). */
export const EKAPE_PIPELINE_ENABLED = false;

export type EkapeHealthSummary = {
  status: HealthStatus;
  externalStatus: HealthStatus;
  points: HealthPoint[];
  externalPoints: HealthPoint[];
  snapshotCount: number;
  viewRowCount: number;
};

function disabledEkapeSummary(): EkapeHealthSummary {
  const disabledPoint = (id: string, label: string): HealthPoint => ({
    id,
    label,
    value: "비활성화 (Ekape 미구현)",
    status: "not_implemented",
    d11Hint: "S6-A",
  });

  return {
    status: "not_implemented",
    externalStatus: "not_implemented",
    snapshotCount: 0,
    viewRowCount: 0,
    points: [
      disabledPoint("ekape.snap.freshness", "snapshot job"),
      disabledPoint("ekape.snap.live_filter", "packet_mode=live"),
      disabledPoint("ekape.view.rows", "export View"),
    ],
    externalPoints: [
      disabledPoint("ext.snap.path", "snapshot → View"),
      {
        id: "ext.ftp.path",
        label: "FTP · 커서",
        value: "비활성화 (Ekape 미구현)",
        status: "not_implemented",
        d11Hint: "S6-A",
      },
      disabledPoint("ext.export.enabled", "export config"),
    ],
  };
}

/** No DB access — returns fixed disabled summary while Ekape is off. */
export async function fetchEkapeHealth(): Promise<EkapeHealthSummary> {
  return disabledEkapeSummary();
}

export function mqttPoints(rsStatus: HealthStatus): HealthPoint[] {
  const status: HealthStatus =
    rsStatus === "ok" ? "ok" : rsStatus === "warn" ? "warn" : "critical";

  return [
    {
      id: "mqtt.infer.via_rs",
      label: "RS 간접 추론",
      value:
        rsStatus === "ok"
          ? "전역 RS raw 최근 수신 있음 → Mosquitto 정상 추론"
          : rsStatus === "warn"
            ? "raw 수신 불안정 — Mosquitto 후보 점검"
            : "전역 raw 무활동 — Mosquitto·RS 후보",
      status,
      d11Hint: rsStatus !== "ok" ? "S1" : undefined,
    },
  ];
}

export function ftpPoints(): HealthPoint[] {
  return [
    {
      id: "ftp.worker",
      label: "FTP Worker",
      value: "비활성화 (Ekape 미구현)",
      status: "not_implemented",
      d11Hint: "S6-A",
    },
  ];
}
