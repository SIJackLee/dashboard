"use server";

import {
  statusesForCommandHistoryFilter,
  type CommandHistoryStatusFilter,
} from "@/components/controllers/command-history-filter";
import { getThermoCommandHistoryResult } from "@/lib/data/commands";
import { requireAdmin } from "@/lib/auth/require-admin";

type Args = {
  limit?: number;
  fromIso?: string | null;
  status?: CommandHistoryStatusFilter;
  q?: string | null;
};

export type OpsCommandHistoryActionResult = {
  commands: import("@/lib/data/commands").ThermoCommand[];
  error: string | null;
};

/** 운영 홈 — 명령 이력 로드 (기간·상태·검색어). */
export async function fetchOpsCommandHistoryAction(
  args: Args | number = 100,
): Promise<OpsCommandHistoryActionResult> {
  await requireAdmin();
  const opts = typeof args === "number" ? { limit: args } : args;
  const capped = Math.min(Math.max(1, Math.floor(opts.limit ?? 100)), 200);
  const fromIso = opts.fromIso?.trim() || undefined;
  const q = opts.q?.trim() || undefined;
  const status = opts.status ?? "all";
  const statuses = statusesForCommandHistoryFilter(status) ?? undefined;
  return getThermoCommandHistoryResult(capped, {
    fromIso,
    statuses,
    q,
  });
}
