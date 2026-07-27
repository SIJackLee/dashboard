import { NextResponse } from "next/server";
import { resolvePostLoginPath } from "@/lib/auth/resolve-post-login-path";
import { createClient } from "@/lib/supabase/server";

/** Admin hub cold TTFB — 로그인 직후 overview 캐시를 미리 채운다. */
async function warmAdminHubOverviewCache(): Promise<void> {
  try {
    const { fetchFarmOverviewRows } = await import(
      "@/lib/data/iot-live-fetch"
    );
    await fetchFarmOverviewRows();
  } catch {
    /* best-effort */
  }
}

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
      const { nextPath, isAdmin } = await resolvePostLoginPath(supabase);
      if (
        nextPath === "/farm" &&
        isAdmin &&
        process.env.SKIP_ADMIN_HUB_WARM !== "1"
      ) {
        await warmAdminHubOverviewCache();
      }
      const enterUrl = new URL("/auth/enter", base);
      enterUrl.searchParams.set("next", nextPath);
      return NextResponse.redirect(enterUrl);
    }
  }

  return NextResponse.redirect(`${base}/login?error=auth`);
}
