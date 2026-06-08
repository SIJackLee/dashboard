import "server-only";
import { createClient } from "@supabase/supabase-js";

// service_role 클라이언트: RLS 우회. 서버 코드(관리자 액션/로더)에서만 사용.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY (또는 URL)가 설정되지 않았습니다.");
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
