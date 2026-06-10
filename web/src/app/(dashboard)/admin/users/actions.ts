"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_FARM } from "@/lib/data/farm-key";

const ADMIN_USERS_PATH = "/admin/users";

async function assertAdmin() {
  const me = await getCurrentUser();
  if (!me?.isAdmin) {
    throw new Error("forbidden");
  }
}

export async function grantFarmAccess(formData: FormData) {
  await assertAdmin();

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

  const admin = createAdminClient();

  // 이메일 → user_id
  const {
    data: { users },
  } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const target = users.find((u) => u.email?.toLowerCase() === email);
  if (!target) {
    redirect(`${ADMIN_USERS_PATH}?error=notfound`);
  }

  // profiles 행 없으면 viewer 로 생성 (기존 role 은 보존)
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("user_id")
    .eq("user_id", target.id)
    .maybeSingle();
  if (!existingProfile) {
    await admin.from("profiles").insert({ user_id: target.id, role: "viewer" });
  }

  // 동일 farm 권한이 있으면 갱신, 없으면 생성
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
  await assertAdmin();

  const accessId = Number(formData.get("access_id"));
  if (!Number.isInteger(accessId)) {
    redirect(`${ADMIN_USERS_PATH}?error=invalid`);
  }

  const admin = createAdminClient();
  await admin.from("user_access").delete().eq("id", accessId);

  revalidatePath(ADMIN_USERS_PATH);
  redirect(`${ADMIN_USERS_PATH}?ok=revoked`);
}
