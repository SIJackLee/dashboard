"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SignInErrorCode = "missing" | "credentials" | "auth";

export type SignInResult =
  | { ok: true; nextPath: "/farm" | "/pending" }
  | { ok: false; error: SignInErrorCode };

async function resolveNextPathAfterSignIn(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<"/farm" | "/pending"> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "/farm";

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
  return hasAccess ? "/farm" : "/pending";
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

  const nextPath = await resolveNextPathAfterSignIn(supabase);
  return { ok: true, nextPath };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
