import { VOICE_LIMITS } from "@/lib/voice-report/limits";
import type { VoiceUsageSnapshot } from "@/lib/voice-report/types";

type MonthBucket = {
  spentUsd: number;
  requestCount: number;
};

type RateBucket = {
  timestamps: number[];
  lastAt: number;
};

/** PoC — 프로세스 메모리. 재시작 시 리셋. */
const monthlyByKey = new Map<string, MonthBucket>();
const rateByUser = new Map<string, RateBucket>();

export function voiceUsageMonthKey(now = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthStoreKey(userId: string, month = voiceUsageMonthKey()): string {
  return `${userId}:${month}`;
}

export function getVoiceUsage(userId: string): VoiceUsageSnapshot {
  const month = voiceUsageMonthKey();
  const soft = VOICE_LIMITS.monthlySoftUsd();
  const hard = VOICE_LIMITS.monthlyHardUsd();
  const bucket = monthlyByKey.get(monthStoreKey(userId, month));
  const spent = bucket?.spentUsd ?? 0;
  return {
    month,
    spentUsd: roundUsd(spent),
    softCapUsd: soft,
    hardCapUsd: hard,
    requestCount: bucket?.requestCount ?? 0,
    softWarn: spent >= soft * 0.8,
  };
}

export function canAffordVoiceRequest(
  userId: string,
  estimatedCostUsd: number,
): { ok: true } | { ok: false; reason: "monthly_cap" | "request_cap" } {
  const soft = VOICE_LIMITS.monthlySoftUsd();
  const perReq = VOICE_LIMITS.maxCostPerRequestUsd();
  if (estimatedCostUsd > perReq) return { ok: false, reason: "request_cap" };
  const usage = getVoiceUsage(userId);
  if (usage.spentUsd + estimatedCostUsd > soft) {
    return { ok: false, reason: "monthly_cap" };
  }
  return { ok: true };
}

export function recordVoiceSpend(userId: string, costUsd: number): VoiceUsageSnapshot {
  const month = voiceUsageMonthKey();
  const key = monthStoreKey(userId, month);
  const prev = monthlyByKey.get(key) ?? { spentUsd: 0, requestCount: 0 };
  monthlyByKey.set(key, {
    spentUsd: prev.spentUsd + Math.max(0, costUsd),
    requestCount: prev.requestCount + 1,
  });
  return getVoiceUsage(userId);
}

export function checkVoiceRateLimit(
  userId: string,
  now = Date.now(),
): { ok: true } | { ok: false; reason: "rate_limit" | "cooldown" } {
  const bucket = rateByUser.get(userId) ?? { timestamps: [], lastAt: 0 };
  if (now - bucket.lastAt < VOICE_LIMITS.cooldownMs()) {
    return { ok: false, reason: "cooldown" };
  }
  const hourAgo = now - 60 * 60 * 1000;
  const minAgo = now - 60 * 1000;
  const recent = bucket.timestamps.filter((t) => t >= hourAgo);
  const perMin = recent.filter((t) => t >= minAgo).length;
  if (perMin >= VOICE_LIMITS.rateLimitPerMin()) {
    return { ok: false, reason: "rate_limit" };
  }
  if (recent.length >= VOICE_LIMITS.rateLimitPerHour()) {
    return { ok: false, reason: "rate_limit" };
  }
  return { ok: true };
}

export function markVoiceRequest(userId: string, now = Date.now()): void {
  const bucket = rateByUser.get(userId) ?? { timestamps: [], lastAt: 0 };
  const hourAgo = now - 60 * 60 * 1000;
  const timestamps = [...bucket.timestamps.filter((t) => t >= hourAgo), now];
  rateByUser.set(userId, { timestamps, lastAt: now });
}

function roundUsd(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
