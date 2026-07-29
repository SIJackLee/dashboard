import type { FarmKey } from "@/lib/data/farm-key";
import { parseFarmKeyFromQuery } from "@/lib/data/farm-key";

const FARM_RE = /\b(FARM\d{1,4})\b/i;

/**
 * 질문에서 농장 lsind 추출. 없으면 currentFarm 사용.
 * itemCode는 항상 currentFarm(또는 기본 P00) — 단일 농장 PoC.
 */
export function resolveFarmFromQuestion(
  question: string,
  currentFarm: FarmKey,
): { farmKey: FarmKey; fromQuestion: boolean } {
  const m = question.match(FARM_RE);
  if (!m) {
    return { farmKey: currentFarm, fromQuestion: false };
  }
  const lsind = m[1]!.toUpperCase();
  const item = currentFarm.itemCode?.trim() || "P00";
  const farmKey =
    parseFarmKeyFromQuery(lsind, item) ?? {
      lsindRegistNo: lsind,
      itemCode: item,
    };
  return { farmKey, fromQuestion: true };
}

export function truncateChars(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return t.slice(0, max).trimEnd();
}
