import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { FarmKey } from "@/lib/data/farm-key";
import type { AriaRoute, AriaSession } from "@/lib/aria/protocol/types";

const Q_MAX = 200;
const ANS_MAX = 120;
/** DB 보관 일수 — cron·insert 후 RPC와 동일 */
export const ARIA_TURN_LOG_RETENTION_DAYS = 7;

export type AriaTurnLogInput = {
  userId: string;
  farmKey: FarmKey | null;
  question: string;
  route: AriaRoute | string;
  depth: number | null;
  source: string;
  sessionIn: AriaSession | null;
  sessionOut: AriaSession | null;
  answer: string;
  protocolV1: boolean;
};

/** `ARIA_TURN_LOG=false|0|off` 이면 비활성 (기본 on) */
export function ariaTurnLogEnabled(): boolean {
  const v = process.env.ARIA_TURN_LOG?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off") return false;
  return true;
}

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/**
 * 오분류 추적용 턴 로그. 실패해도 ask 응답을 막지 않음.
 */
export async function recordAriaTurnLog(
  input: AriaTurnLogInput,
): Promise<void> {
  if (!ariaTurnLogEnabled()) return;

  const row = {
    user_id: input.userId,
    lsind_regist_no: input.farmKey?.lsindRegistNo ?? null,
    item_code: input.farmKey?.itemCode ?? null,
    question: clip(input.question, Q_MAX),
    route: String(input.route),
    depth: input.depth,
    source: input.source,
    session_depth_in: input.sessionIn?.depth ?? null,
    session_route_in: input.sessionIn?.lastRoute ?? null,
    session_depth_out: input.sessionOut?.depth ?? null,
    session_route_out: input.sessionOut?.lastRoute ?? null,
    answer_preview: clip(input.answer, ANS_MAX),
    protocol_v1: input.protocolV1,
  };

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("aria_turn_log").insert(row);
    if (error) {
      console.error("[aria-turn-log] insert", error.message);
      console.info("[aria-turn-log]", JSON.stringify(row));
    } else {
      // 보관 7일 — 사용 시에도 정리 (cron 보조)
      void supabase.rpc("cleanup_aria_turn_log", {
        retention_days: ARIA_TURN_LOG_RETENTION_DAYS,
      });
    }
  } catch (e) {
    console.error("[aria-turn-log]", e);
    console.info("[aria-turn-log]", JSON.stringify(row));
  }
}

export type AriaTurnFeedback = "ok" | "bad";

export type AriaTurnLogRow = {
  id: string;
  createdAt: string;
  userId: string;
  lsindRegistNo: string | null;
  itemCode: string | null;
  question: string;
  route: string;
  depth: number | null;
  source: string | null;
  sessionDepthIn: number | null;
  sessionRouteIn: string | null;
  sessionDepthOut: number | null;
  sessionRouteOut: string | null;
  answerPreview: string | null;
  protocolV1: boolean;
  feedback: AriaTurnFeedback | null;
  feedbackAt: string | null;
};

export async function listAriaTurnLogs(args: {
  limit?: number;
  route?: string | null;
  feedback?: AriaTurnFeedback | "none" | null;
}): Promise<AriaTurnLogRow[]> {
  const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
  const supabase = await createClient();
  let q = supabase
    .from("aria_turn_log")
    .select(
      "id, created_at, user_id, lsind_regist_no, item_code, question, route, depth, source, session_depth_in, session_route_in, session_depth_out, session_route_out, answer_preview, protocol_v1, feedback, feedback_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (args.route?.trim()) {
    q = q.eq("route", args.route.trim().toUpperCase());
  }
  if (args.feedback === "none") {
    q = q.is("feedback", null);
  } else if (args.feedback === "ok" || args.feedback === "bad") {
    q = q.eq("feedback", args.feedback);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    id: r.id as string,
    createdAt: r.created_at as string,
    userId: r.user_id as string,
    lsindRegistNo: (r.lsind_regist_no as string | null) ?? null,
    itemCode: (r.item_code as string | null) ?? null,
    question: r.question as string,
    route: r.route as string,
    depth: (r.depth as number | null) ?? null,
    source: (r.source as string | null) ?? null,
    sessionDepthIn: (r.session_depth_in as number | null) ?? null,
    sessionRouteIn: (r.session_route_in as string | null) ?? null,
    sessionDepthOut: (r.session_depth_out as number | null) ?? null,
    sessionRouteOut: (r.session_route_out as string | null) ?? null,
    answerPreview: (r.answer_preview as string | null) ?? null,
    protocolV1: Boolean(r.protocol_v1),
    feedback:
      r.feedback === "ok" || r.feedback === "bad"
        ? (r.feedback as AriaTurnFeedback)
        : null,
    feedbackAt: (r.feedback_at as string | null) ?? null,
  }));
}

export async function setAriaTurnLogFeedback(args: {
  id: string;
  feedback: AriaTurnFeedback | null;
  adminUserId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const payload =
    args.feedback == null
      ? { feedback: null, feedback_at: null, feedback_by: null }
      : {
          feedback: args.feedback,
          feedback_at: new Date().toISOString(),
          feedback_by: args.adminUserId,
        };

  const { data, error } = await supabase
    .from("aria_turn_log")
    .update(payload)
    .eq("id", args.id)
    .select("id");

  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "not_updated" };
  return { ok: true };
}
