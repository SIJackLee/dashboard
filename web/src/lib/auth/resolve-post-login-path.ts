import type { createClient } from "@/lib/supabase/server";

export type PostLoginPath = "/farm" | "/pending";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/** 로그인(이메일·OAuth) 직후 이동 경로 — admin 또는 can_read 있으면 /farm, 없으면 /pending */
export async function resolvePostLoginPath(
  supabase: SupabaseServer,
): Promise<{ nextPath: PostLoginPath; isAdmin: boolean }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { nextPath: "/farm", isAdmin: false };

  const [{ data: profile }, { data: accesses }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("user_access").select("can_read").eq("user_id", user.id),
  ]);

  const isAdmin = profile?.role === "admin";
  const hasAccess =
    isAdmin || (accesses ?? []).some((row) => row.can_read === true);

  return {
    nextPath: hasAccess ? "/farm" : "/pending",
    isAdmin,
  };
}
