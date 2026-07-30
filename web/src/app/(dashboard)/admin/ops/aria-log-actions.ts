"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import {
  listAriaTurnLogs,
  setAriaTurnLogFeedback,
  type AriaTurnFeedback,
  type AriaTurnLogRow,
} from "@/lib/aria/protocol/turn-log";

export type { AriaTurnFeedback, AriaTurnLogRow };

export async function fetchAriaTurnLogsAction(input?: {
  limit?: number;
  route?: string | null;
  feedback?: AriaTurnFeedback | "none" | null;
}): Promise<
  | { ok: true; rows: AriaTurnLogRow[] }
  | { ok: false; error: string }
> {
  await requireAdmin();
  try {
    const rows = await listAriaTurnLogs({
      limit: input?.limit ?? 50,
      route: input?.route ?? null,
      feedback: input?.feedback ?? null,
    });
    return { ok: true, rows };
  } catch (e) {
    const message = e instanceof Error ? e.message : "list_failed";
    return { ok: false, error: message };
  }
}

export async function setAriaTurnFeedbackAction(input: {
  id: string;
  feedback: AriaTurnFeedback | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requireAdmin();
  if (!input.id.trim()) return { ok: false, error: "invalid" };
  return setAriaTurnLogFeedback({
    id: input.id.trim(),
    feedback: input.feedback,
    adminUserId: admin.id,
  });
}
