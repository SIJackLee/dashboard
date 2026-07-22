import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// 공개 경로(미인증 허용)
const PUBLIC_PATHS = ["/login", "/auth"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 쿠키 신뢰 금지 → 항상 getUser() 로 검증
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();
  let user = authUser;

  if (authError?.code === "refresh_token_not_found") {
    await supabase.auth.signOut();
    user = null;
  }

  const { pathname } = request.nextUrl;

  if (pathname === "/admin/ops") {
    const legacyTab = request.nextUrl.searchParams.get("tab");
    if (legacyTab === "display") {
      const url = request.nextUrl.clone();
      url.searchParams.delete("tab");
      return NextResponse.redirect(url);
    }
    if (
      legacyTab === "users" ||
      legacyTab === "farms" ||
      legacyTab === "commands"
    ) {
      const url = request.nextUrl.clone();
      url.pathname = `/admin/ops/${legacyTab}`;
      url.searchParams.delete("tab");
      return NextResponse.redirect(url);
    }
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 이미 로그인된 사용자가 /login 접근 시 대시보드로
  if (user && pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    url.pathname = "/farm";
    url.searchParams.delete("view");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
