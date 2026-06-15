import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// OAuth 리디렉션 후 code → 세션 교환
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/farm";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      let target = next;
      if (next === "/farm" || next.startsWith("/farm?")) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
          .maybeSingle();
        if (profile?.role === "admin") {
          target = "/farm";
        }
      }
      return NextResponse.redirect(`${origin}${target}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
