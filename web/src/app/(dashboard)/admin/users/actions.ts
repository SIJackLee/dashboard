"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { findAuthUserByEmail } from "@/lib/admin/auth-users";
import type { Role } from "@/lib/auth/get-current-user";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_FARM } from "@/lib/data/farm-key";

const ADMIN_USERS_PATH = "/admin/users";
const ROLES: Role[] = ["admin", "operator", "viewer"];

async function requireAdminAction() {
  const me = await getCurrentUser();
  if (!me?.isAdmin) {
    redirect(`${ADMIN_USERS_PATH}?error=forbidden`);
  }
  return me;
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

  const admin = createAdminClient();

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("user_id, role")
    .eq("user_id", target.id)
    .maybeSingle();
  if (!existingProfile) {
    await admin.from("profiles").insert({ user_id: target.id, role: "viewer" });
  }

  const { data: dup } = await admin
    .from("user_access")
    .select("id")
    .eq("user_id", target.id)
    .eq("scope_type", "farm")
    .eq("lsind_regist_no", lsindRegistNo)
    .eq("item_code", itemCode)
    .maybeSingle();

  if (dup) {
    await admin
      .from("user_access")
      .update({ can_read: true, can_command: canCommand })
      .eq("id", dup.id);
  } else {
    await admin.from("user_access").insert({
      user_id: target.id,
      scope_type: "farm",
      lsind_regist_no: lsindRegistNo,
      item_code: itemCode,
      can_read: true,
      can_command: canCommand,
    });
  }

  revalidatePath(ADMIN_USERS_PATH);
  redirect(`${ADMIN_USERS_PATH}?ok=granted`);
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
