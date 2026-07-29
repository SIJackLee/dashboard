import { VOICE_PRICE_USD } from "@/lib/voice-report/limits";

/** 한국어 대략 1토큰 ≈ 2자 (추정용) */
export function estimateTokensFromChars(chars: number): number {
  return Math.max(1, Math.ceil(chars / 2));
}

export function estimateSttUsd(durationSec: number): number {
  if (durationSec <= 0) return 0;
  return (durationSec / 60) * VOICE_PRICE_USD.sttPerMinute;
}

export function estimateChatUsd(inputChars: number, outputChars: number): number {
  const inTok = estimateTokensFromChars(inputChars);
  const outTok = estimateTokensFromChars(outputChars);
  return (
    (inTok / 1_000_000) * VOICE_PRICE_USD.chatInputPer1M +
    (outTok / 1_000_000) * VOICE_PRICE_USD.chatOutputPer1M
  );
}

export function estimateTtsUsd(answerChars: number): number {
  if (answerChars <= 0) return 0;
  return (answerChars / 1_000_000) * VOICE_PRICE_USD.ttsPer1MChars;
}

export function estimateAskCostUsd(opts: {
  sttSec?: number;
  promptChars: number;
  answerChars: number;
  withTts?: boolean;
}): number {
  const stt = estimateSttUsd(opts.sttSec ?? 0);
  const chat = estimateChatUsd(opts.promptChars, opts.answerChars);
  const tts = opts.withTts ? estimateTtsUsd(opts.answerChars) : 0;
  return stt + chat + tts;
}
