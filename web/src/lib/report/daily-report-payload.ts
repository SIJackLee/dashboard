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
  /** 24h 발췌 표 — RPC 15분 버킷 시리즈에서 약 8포인트 샘플 */
  detailRows: {
    label: string;
    temp: number | null;
    humidity: number | null;
    motorA: number | null;
    motorB: number | null;
  }[];
};

export type DailyReportPayload = {
  farmKey: FarmKey;
  reportDate: string;
  generatedAt: string;
  overview: {
    barnCount: number;
    controllerCount: number;
    onlineCount: number;
    offlineCount: number;
    alarmCount: number;
  };
  barns: DailyReportBarn[];
};
