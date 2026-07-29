/**
 * 음성 AI 리포팅 PoC — 과금·요청 가드레일 상수.
 * 환경변수로 덮어쓸 수 있음 (서버 전용).
 */

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export const VOICE_LIMITS = {
  monthlySoftUsd: () => numEnv("VOICE_MONTHLY_SOFT_USD", 20),
  monthlyHardUsd: () => numEnv("VOICE_MONTHLY_HARD_USD", 24),
  maxRecordSec: () => numEnv("VOICE_MAX_RECORD_SEC", 15),
  minRecordSec: () => numEnv("VOICE_MIN_RECORD_SEC", 0.8),
  maxUploadBytes: () => numEnv("VOICE_MAX_UPLOAD_BYTES", 480_000),
  maxQuestionChars: () => numEnv("VOICE_MAX_QUESTION_CHARS", 200),
  maxAnswerChars: () => numEnv("VOICE_MAX_ANSWER_CHARS", 250),
  maxCostPerRequestUsd: () => numEnv("VOICE_MAX_COST_PER_REQUEST_USD", 0.02),
  rateLimitPerMin: () => numEnv("VOICE_RATE_LIMIT_PER_MIN", 10),
  rateLimitPerHour: () => numEnv("VOICE_RATE_LIMIT_PER_HOUR", 60),
  cooldownMs: () => numEnv("VOICE_COOLDOWN_MS", 2000),
  /** fact JSON 대략 상한 (문자) */
  maxFactChars: () => numEnv("VOICE_MAX_FACT_CHARS", 6000),
} as const;

/** OpenAI 추정 단가 (USD) — soft cap 추적용, 실청구와 차이 허용 */
export const VOICE_PRICE_USD = {
  sttPerMinute: 0.003,
  chatInputPer1M: 0.15,
  chatOutputPer1M: 0.6,
  ttsPer1MChars: 15,
} as const;

export const VOICE_MODELS = {
  stt: "gpt-4o-mini-transcribe",
  chat: "gpt-4o-mini",
  tts: "tts-1",
} as const;

export function voiceReportEnabled(): boolean {
  const v = process.env.VOICE_REPORT_ENABLED?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off") return false;
  return true;
}
