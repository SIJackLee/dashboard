import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/** unstable_cache 내부용 — cookies() 없이 JWT로 RLS 클라이언트 생성 */
export function createRlsClient(accessToken: string) {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    },
  );
}

export async function getAccessTokenOrNull(): Promise<string | null> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
