/**
 * 일보 PDF용 직렬화 페이로드 — 서버/클라이언트 공유 (server-only 금지).
 */

import type { FarmKey } from "@/lib/data/farm-key";
import type { TrendPeriodId } from "@/lib/data/farm-trend-types";

export type DailyReportControllerRow = {
  controllerKey: string;
  eqpmnNo: string;
  tempC: number | null;
  humidityPct: number | null;
  motorA: number | null;
  motorB: number | null;
  motorC: number | null;
  status: string;
};

export type DailyReportSeries = {
  categories: string[];
  temp: (number | null)[];
  humidity: (number | null)[];
  motorA: (number | null)[];
  motorB: (number | null)[];
  motorC: (number | null)[];
};

export type DailyReportBarn = {
  stallTyCode: string;
  stallLabel: string;
  stallNo: string;
  kpi: {
    tempNow: number | null;
    humNow: number | null;
    motorA: number | null;
    motorB: number | null;
    motorC: number | null;
    tMin24: number | null;
    tMax24: number | null;
    online: number;
    total: number;
    judge: string;
  };
  controllers: DailyReportControllerRow[];
  periods: Record<TrendPeriodId, DailyReportSeries>;
  /** 24h 발췌 표 — 15분 버킷에서 약 8포인트 샘플 */
  detailRows: {
    label: string;
    temp: number | null;
    humidity: number | null;
    motorA: number | null;
    motorB: number | null;
    motorC: number | null;
  }[];
};

export type DailyReportAlarmRow = {
  stallLabel: string;
  stallNo: string;
  stallTyCode: string | null;
  eqpmnNo: string;
  controllerKey: string;
  alarmType: string;
  severity: "warning" | "critical";
  detail: string;
  /** 모듈 에러 vs 통신두절 (임계 파생 없음) */
  source: "module" | "offline";
};

export type DailyReportPayload = {
  farmKey: FarmKey;
  /** 표지·헤더용 농장 표시명 (내부 키 비노출) */
  farmLabel: string;
  reportDate: string;
  generatedAt: string;
  overview: {
    barnCount: number;
    controllerCount: number;
    onlineCount: number;
    offlineCount: number;
    /** 이상상황 건수 = 모듈 에러 + 통신두절 */
    alarmCount: number;
  };
  barns: DailyReportBarn[];
  /** LIVE 기준 이상상황 (모듈 에러코드 + 통신두절) */
  alarms: DailyReportAlarmRow[];
  /**
   * 표지 그래프 가이드 — 이 농장에 저장된 알람 상·하한
   * (농장 스코프 → 없으면 계정 전역 → 기본 10~35℃ / 30~90%).
   */
  alarmGuide: {
    tempLow: number;
    tempHigh: number;
    humidityLow: number;
    humidityHigh: number;
  };
};

export function dailyReportPdfFilename(payload: DailyReportPayload): string {
  const raw = payload.farmLabel.trim() || "농장";
  const safe = raw.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80);
  return `${safe}_일보_${payload.reportDate}.pdf`;
}
