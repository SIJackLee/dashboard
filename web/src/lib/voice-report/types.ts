import type { FarmKey } from "@/lib/data/farm-key";

export type VoiceAskMode = "text" | "audio";

export type VoiceFarmFacts = {
  farmKey: FarmKey;
  farmLabel: string;
  totalControllers: number;
  onlineControllers: number;
  offlineControllers: number;
  alarmTotal: number;
  alarmCritical: number;
  alarmWarning: number;
  stalls: {
    stallTyCode: string;
    stallLabel: string;
    controllers: number;
    online: number;
    alarmCount: number;
    tempAvgC: number | null;
    humidityAvgPct: number | null;
  }[];
  /**
   * 활성 알람 상세 — 「어느 컨트롤러?」 후속 질문용.
   * 건수가 많으면 위험 우선 상위 N건만.
   */
  alarmItems: {
    stallLabel: string;
    stallNo: string | null;
    controllerLabel: string;
    controllerKey: string;
    eqpmnNo: string;
    alarmType: string;
    severity: "warning" | "critical";
    detail: string;
  }[];
  generatedAt: string;
};

export type VoiceUsageSnapshot = {
  month: string;
  spentUsd: number;
  softCapUsd: number;
  hardCapUsd: number;
  requestCount: number;
  softWarn: boolean;
};

export type VoiceAskSuccess = {
  ok: true;
  text: string;
  /** STT로 인식된 질문 (audio 모드) */
  question?: string;
  farmKey: FarmKey;
  farmLabel: string;
  source: "openai" | "template";
  mode: VoiceAskMode;
  usage: VoiceUsageSnapshot;
  estimatedCostUsd: number;
  audioBase64: string | null;
  audioMimeType?: string | null;
  /** TTS를 원했지만 음성이 없을 때 */
  ttsSkipped?: "openai_missing" | "tts_failed" | null;
};

export type VoiceAskErrorCode =
  | "disabled"
  | "unauthorized"
  | "no_access"
  | "farm_denied"
  | "farm_unresolved"
  | "rate_limit"
  | "cooldown"
  | "monthly_cap"
  | "request_cap"
  | "question_empty"
  | "question_too_long"
  | "record_too_long"
  | "upload_too_large"
  | "openai_error"
  | "invalid_body";

export type VoiceAskError = {
  ok: false;
  error: VoiceAskErrorCode;
  message: string;
  usage?: VoiceUsageSnapshot;
};
