"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { findAuthUserByEmail } from "@/lib/admin/auth-users";
import type { Role } from "@/lib/auth/get-current-user";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import type { FarmKey } from "@/lib/data/farm-key";
import { DEFAULT_FARM } from "@/lib/data/farm-key";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_USERS_PATH = "/admin/users";
const ROLES: Role[] = ["admin", "operator", "viewer"];

async function requireAdminAction() {
  const me = await getCurrentUser();
  if (!me?.isAdmin) {
    redirect(`${ADMIN_USERS_PATH}?error=forbidden`);
  }
  return me;
}

async function ensureProfile(userId: string) {
  const admin = createAdminClient();
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("user_id, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (!existingProfile) {
    await admin.from("profiles").insert({ user_id: userId, role: "viewer" });
  }
}

async function upsertFarmAccess(
  userId: string,
  farmKey: FarmKey,
  canCommand: boolean
) {
  const admin = createAdminClient();
  const { data: dup } = await admin
    .from("user_access")
    .select("id")
    .eq("user_id", userId)
    .eq("scope_type", "farm")
    .eq("lsind_regist_no", farmKey.lsindRegistNo)
    .eq("item_code", farmKey.itemCode)
    .maybeSingle();

  if (dup) {
    await admin
      .from("user_access")
      .update({ can_read: true, can_command: canCommand })
      .eq("id", dup.id);
    return;
  }

  await admin.from("user_access").insert({
    user_id: userId,
    scope_type: "farm",
    lsind_regist_no: farmKey.lsindRegistNo,
    item_code: farmKey.itemCode,
    can_read: true,
    can_command: canCommand,
  });
}

function parseFarmKey(raw: unknown): FarmKey | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const lsindRegistNo = String(o.lsindRegistNo ?? "").trim();
  const itemCode = String(o.itemCode ?? "").trim();
  if (!lsindRegistNo || !itemCode) return null;
  return { lsindRegistNo, itemCode };
}

export async function grantFarmAccess(formData: FormData) {
  await requireAdminAction();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const lsindRegistNo = String(
    formData.get("lsind_regist_no") ?? DEFAULT_FARM.lsindRegistNo
  ).trim();
  const itemCode = String(
    formData.get("item_code") ?? DEFAULT_FARM.itemCode
  ).trim();
  const canCommand = formData.get("can_command") === "on";

  if (!email || !lsindRegistNo || !itemCode) {
    redirect(`${ADMIN_USERS_PATH}?error=invalid`);
  }

  const target = await findAuthUserByEmail(email);
  if (!target) {
    redirect(`${ADMIN_USERS_PATH}?error=notfound`);
  }

  await ensureProfile(target.id);
  await upsertFarmAccess(
    target.id,
    { lsindRegistNo, itemCode },
    canCommand
  );

  revalidatePath(ADMIN_USERS_PATH);
  redirect(`${ADMIN_USERS_PATH}?ok=granted`);
}

export async function grantBulkFarmAccess(formData: FormData) {
  await requireAdminAction();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const canCommand = formData.get("can_command") === "on";
  const farmsRaw = String(formData.get("farms_json") ?? "[]");

  let parsed: unknown;
  try {
    parsed = JSON.parse(farmsRaw);
  } catch {
    redirect(`${ADMIN_USERS_PATH}?error=invalid`);
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    redirect(`${ADMIN_USERS_PATH}?error=invalid`);
  }

  const farms = parsed.map(parseFarmKey).filter((f): f is FarmKey => f != null);
  if (!email || farms.length === 0) {
    redirect(`${ADMIN_USERS_PATH}?error=invalid`);
  }

  const target = await findAuthUserByEmail(email);
  if (!target) {
    redirect(`${ADMIN_USERS_PATH}?error=notfound`);
  }

  await ensureProfile(target.id);
  for (const farmKey of farms) {
    await upsertFarmAccess(target.id, farmKey, canCommand);
  }

  revalidatePath(ADMIN_USERS_PATH);
  redirect(
    `${ADMIN_USERS_PATH}?ok=bulk_granted&count=${encodeURIComponent(String(farms.length))}`
  );
}

export async function revokeAccess(formData: FormData) {
  await requireAdminAction();

  const accessId = Number(formData.get("access_id"));
  if (!Number.isInteger(accessId)) {
    redirect(`${ADMIN_USERS_PATH}?error=invalid`);
  }

  const admin = createAdminClient();
  await admin.from("user_access").delete().eq("id", accessId);

  revalidatePath(ADMIN_USERS_PATH);
  redirect(`${ADMIN_USERS_PATH}?ok=revoked`);
}

export async function updateUserRole(formData: FormData) {
  const me = await requireAdminAction();

  const userId = String(formData.get("user_id") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim() as Role;

  if (!userId || !ROLES.includes(role)) {
    redirect(`${ADMIN_USERS_PATH}?error=invalid`);
  }

  if (userId === me.id && role !== "admin") {
    redirect(`${ADMIN_USERS_PATH}?error=self_demote`);
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await admin.from("profiles").update({ role }).eq("user_id", userId);
  } else {
    await admin.from("profiles").insert({ user_id: userId, role });
  }

  revalidatePath(ADMIN_USERS_PATH);
  redirect(`${ADMIN_USERS_PATH}?ok=role_updated`);
}
