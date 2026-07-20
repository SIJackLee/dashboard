"use server";

import { getThermoCommandHistory } from "@/lib/data/commands";
import { requireAdmin } from "@/lib/auth/require-admin";

type Args = {
  limit?: number;
  fromIso?: string | null;
};

/** 운영 홈 — 명령 이력 로드 (기간 필터 선택). */
export async function fetchOpsCommandHistoryAction(args: Args | number = 100) {
  await requireAdmin();
  const opts = typeof args === "number" ? { limit: args } : args;
  const capped = Math.min(Math.max(1, Math.floor(opts.limit ?? 100)), 200);
  const fromIso = opts.fromIso?.trim() || undefined;
  return getThermoCommandHistory(capped, fromIso ? { fromIso } : undefined);
}
