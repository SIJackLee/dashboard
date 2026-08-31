import "server-only";

import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

function rlsClientOptions(accessToken: string) {
  return {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  };
}

/** unstable_cache 내부용 — cookies() 없이 JWT로 RLS 클라이언트 생성 (untyped) */
export function createRlsClient(accessToken: string) {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    rlsClientOptions(accessToken),
  );
}

/**
 * RPC 호출 전용 — Database 계약으로 함수 이름·인자를 타입 검증한다.
 * (`.from()` 사용처는 untyped `createRlsClient` 유지)
 */
export function createRlsRpcClient(
  accessToken: string,
): SupabaseClient<Database> {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    rlsClientOptions(accessToken),
  );
}

/**
 * RLS LIVE/overview fetch용 access token.
 * middleware와 동일하게 getUser()로 검증 후 session token 사용 (getSession-only SSR desync 방지).
 */
export async function getAccessTokenOrNull(): Promise<string | null> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token ?? null;
  if (!token && process.env.NODE_ENV === "development") {
    console.error(
      "[auth] getUser succeeded but access_token missing for user",
      user.id,
    );
  }
  return token;
}
