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

/**
 * unstable_cache 내부용 — cookies() 없이 JWT로 RLS 클라이언트 생성.
 * Database 계약으로 `.from()`·`.rpc()` 모두 타입 검증된다.
 */
export function createRlsClient(
  accessToken: string,
): SupabaseClient<Database> {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    rlsClientOptions(accessToken),
  );
}

/**
 * RPC 호출 전용 별칭 — createRlsClient가 타입화되어 동작이 동일하다.
 * (호출부 호환용으로 유지)
 */
export const createRlsRpcClient = createRlsClient;

/**
 * Legacy untyped RLS 클라이언트 — 생성 스키마 밖 뷰 별칭
 * (`v_iot_decoded_latest`·`v_iot_farm_overview`)을 캐스트로 조회하는
 * iot-live-fetch 전용. 그 외 소비처는 타입드 createRlsClient를 쓴다.
 */
export function createRlsClientUntyped(accessToken: string) {
  return createSupabaseClient(
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
