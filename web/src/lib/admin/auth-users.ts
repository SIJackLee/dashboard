import "server-only";

import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 200;

/** Auth 사용자 전체 조회 (페이지네이션) */
export async function listAllAuthUsers(): Promise<User[]> {
  const admin = createAdminClient();
  const all: User[] = [];
  let page = 1;

  while (true) {
    const {
      data: { users },
      error,
    } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) throw error;
    all.push(...users);
    if (users.length < PAGE_SIZE) break;
    page += 1;
  }

  return all;
}

/** 이메일로 Auth 사용자 검색 */
export async function findAuthUserByEmail(
  email: string
): Promise<User | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const admin = createAdminClient();
  let page = 1;

  while (true) {
    const {
      data: { users },
      error,
    } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) throw error;

    const hit = users.find((u) => u.email?.toLowerCase() === normalized);
    if (hit) return hit;

    if (users.length < PAGE_SIZE) return null;
    page += 1;
  }
}
