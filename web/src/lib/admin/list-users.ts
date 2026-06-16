import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { listAllAuthUsers } from "@/lib/admin/auth-users";



export type FarmAccess = {

  id: number;

  lsindRegistNo: string;

  itemCode: string;

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

  const users = await listAllAuthUsers();



  const ids = users.map((u) => u.id);

  if (ids.length === 0) return [];



  const [{ data: profiles }, { data: accesses }] = await Promise.all([

    admin.from("profiles").select("user_id, role, display_name").in("user_id", ids),

    admin

      .from("user_access")

      .select("id, user_id, lsind_regist_no, item_code, can_read, can_command")

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

      lsindRegistNo: a.lsind_regist_no as string,

      itemCode: a.item_code as string,

      can_read: a.can_read as boolean,

      can_command: a.can_command as boolean,

    });

    accessMap.set(a.user_id as string, list);

  }



  return users

    .map((u) => {

      const p = profileMap.get(u.id);

      return {

        id: u.id,

        email: u.email ?? null,

        createdAt: u.created_at,

        role: (p?.role as string | undefined) ?? null,

        displayName: (p?.display_name as string | null) ?? null,

        farmAccess: accessMap.get(u.id) ?? [],

      };

    })

    .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));

}


