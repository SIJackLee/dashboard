import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { listAriaTurnLogs } from "@/lib/aria/protocol/turn-log";

/**
 * 관리자 전용 — ARIA 턴 로그 (오분류 검수).
 * GET /api/voice-report/aria-logs?limit=50&route=FARM
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!user.isAdmin) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const route = url.searchParams.get("route");

  try {
    const rows = await listAriaTurnLogs({
      limit: Number.isFinite(limit) ? limit : 50,
      route,
    });
    return NextResponse.json({ ok: true, rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "list_failed";
    console.error("[aria-logs]", message);
    return NextResponse.json(
      { ok: false, error: "list_failed", message },
      { status: 500 },
    );
  }
}
