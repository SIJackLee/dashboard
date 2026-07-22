"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SignInErrorCode = "missing" | "credentials" | "auth";

export type SignInResult =
  | { ok: true; nextPath: "/farm" | "/pending" }
  | { ok: false; error: SignInErrorCode };

async function resolveNextPathAfterSignIn(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ nextPath: "/farm" | "/pending"; isAdmin: boolean }> {
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
    supabase
      .from("user_access")
      .select("can_read")
      .eq("user_id", user.id),
  ]);

  const isAdmin = profile?.role === "admin";
  const hasAccess =
    isAdmin || (accesses ?? []).some((row) => row.can_read === true);
  return {
    nextPath: hasAccess ? "/farm" : "/pending",
    isAdmin,
  };
}

/** Admin hub cold TTFB — 로그인 직후 overview 캐시를 미리 채운다. */
async function warmAdminHubOverviewCache(): Promise<void> {
  try {
    const { fetchFarmOverviewRows } = await import(
      "@/lib/data/iot-live-fetch"
    );
    await fetchFarmOverviewRows();
  } catch {
    /* best-effort — /farm이 다시 조회 */
  }
}

export async function signInWithEmail(formData: FormData): Promise<SignInResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, error: "missing" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false, error: "credentials" };
  }

  const { nextPath, isAdmin } = await resolveNextPathAfterSignIn(supabase);
  if (
    nextPath === "/farm" &&
    isAdmin &&
    process.env.SKIP_ADMIN_HUB_WARM !== "1"
  ) {
    await warmAdminHubOverviewCache();
  }
  return { ok: true, nextPath };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
