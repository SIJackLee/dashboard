import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const top = Math.max(
      1,
      Math.min(50, Number(searchParams.get("top") ?? 10) || 10)
    );

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("game_high_scores")
      .select("player_id,best_score,updated_at")
      .order("best_score", { ascending: false })
      .order("updated_at", { ascending: true })
      .limit(top);

    if (error) {
      if (error.code === "42P01" || error.message?.includes("game_high_scores")) {
        return NextResponse.json({ ok: true, top, items: [] });
      }
      throw error;
    }

    return NextResponse.json({
      ok: true,
      top,
      items: (data ?? []).map((r) => ({
        playerId: r.player_id,
        bestScore: r.best_score,
        updatedAt: r.updated_at,
      })),
    });
  } catch (err) {
    console.error("[piggy/leaderboard]", err);
    return NextResponse.json({ ok: false, error: "Server Error" }, { status: 500 });
  }
}
