import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type FarmAccess = {
  id: number;
  farm_uid: number;
  can_read: boolean;
  can_command: boolean;
};

export type ManagedUser = {
  id: string;
  email: string | null;
  createdAt: string;
  role: string | null;
  displayName: string | null;
  farmAccess: FarmAccess[];
};

// Admin API(이메일) + profiles(role) + user_access(farm 권한) 병합
export async function listManagedUsers(): Promise<ManagedUser[]> {
  const admin = createAdminClient();

  const {
    data: { users },
    error,
  } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;

  const ids = users.map((u) => u.id);
  if (ids.length === 0) return [];

  const [{ data: profiles }, { data: accesses }] = await Promise.all([
    admin.from("profiles").select("user_id, role, display_name").in("user_id", ids),
    admin
      .from("user_access")
      .select("id, user_id, farm_uid, can_read, can_command")
      .eq("scope_type", "farm")
      .in("user_id", ids),
  ]);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.user_id as string, p])
  );
  const accessMap = new Map<string, FarmAccess[]>();
  for (const a of accesses ?? []) {
    const list = accessMap.get(a.user_id as string) ?? [];
    list.push({
      id: a.id as number,
      farm_uid: a.farm_uid as number,
      can_read: a.can_read as boolean,
      can_command: a.can_command as boolean,
    });
    accessMap.set(a.user_id as string, list);
  }

  return users.map((u) => {
    const p = profileMap.get(u.id);
    return {
      id: u.id,
      email: u.email ?? null,
      createdAt: u.created_at,
      role: (p?.role as string | undefined) ?? null,
      displayName: (p?.display_name as string | null) ?? null,
      farmAccess: accessMap.get(u.id) ?? [],
    };
  });
}
