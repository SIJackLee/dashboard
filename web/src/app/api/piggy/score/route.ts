import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function isValidPlayerId(playerId: unknown): playerId is string {
  return (
    typeof playerId === "string" &&
    playerId.length >= 2 &&
    playerId.length <= 20 &&
    /^[a-zA-Z0-9가-힣 _-]+$/.test(playerId)
  );
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const playerId = payload?.playerId;
    const score = payload?.score;

    if (!isValidPlayerId(playerId)) {
      return NextResponse.json(
        { ok: false, error: "Invalid playerId (2~20 chars)" },
        { status: 400 }
      );
    }
    if (
      typeof score !== "number" ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > 1_000_000
    ) {
      return NextResponse.json({ ok: false, error: "Invalid score" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: existing, error: readErr } = await supabase
      .from("game_high_scores")
      .select("best_score")
      .eq("player_id", playerId)
      .maybeSingle();

    if (readErr) {
      if (readErr.code === "42P01" || readErr.message?.includes("game_high_scores")) {
        return NextResponse.json({
          ok: true,
          playerId,
          bestScore: Math.floor(score),
          pendingMigration: true,
        });
      }
      throw readErr;
    }

    const nextBest = Math.max(existing?.best_score ?? 0, Math.floor(score));
    const { error: upsertErr } = await supabase
      .from("game_high_scores")
      .upsert(
        { player_id: playerId, best_score: nextBest },
        { onConflict: "player_id" }
      );

    if (upsertErr) throw upsertErr;

    return NextResponse.json({ ok: true, playerId, bestScore: nextBest });
  } catch (err) {
    console.error("[piggy/score]", err);
    return NextResponse.json({ ok: false, error: "Server Error" }, { status: 500 });
  }
}
