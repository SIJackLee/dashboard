import { NextResponse } from "next/server";
import { resolvePostLoginPath } from "@/lib/auth/resolve-post-login-path";
import { createClient } from "@/lib/supabase/server";

function redirectBase(request: Request): string {
  const { origin } = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocal = process.env.NODE_ENV === "development";

  if (isLocal) return origin;
  if (forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${forwardedHost}`;
  }
  return origin;
}

/** OAuth 리디렉션 후 code → 세션 교환, 권한에 따라 /farm | /pending */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const base = redirectBase(request);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { nextPath } = await resolvePostLoginPath(supabase);
      return NextResponse.redirect(`${base}${nextPath}`);
    }
  }

  return NextResponse.redirect(`${base}/login?error=auth`);
}
