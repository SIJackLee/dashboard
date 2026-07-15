"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { findAuthUserByEmail } from "@/lib/admin/auth-users";
import { MANAGED_USERS_CACHE_TAG } from "@/lib/admin/list-users";
import type { Role } from "@/lib/auth/get-current-user";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import type { FarmKey } from "@/lib/data/farm-key";
import { DEFAULT_FARM } from "@/lib/data/farm-key";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminOpsPath } from "@/lib/admin/ops-tabs";

const ADMIN_USERS_PATH = adminOpsPath("users");
const ROLES: Role[] = ["admin", "operator", "viewer"];

function revalidateAdminUsers() {
  revalidateTag(MANAGED_USERS_CACHE_TAG, "max");
  revalidatePath(ADMIN_USERS_PATH);
}

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

async function findFarmAccessRow(userId: string, farmKey: FarmKey) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_access")
    .select("id, can_read, can_command")
    .eq("user_id", userId)
    .eq("scope_type", "farm")
    .eq("lsind_regist_no", farmKey.lsindRegistNo)
    .eq("item_code", farmKey.itemCode)
    .maybeSingle();
  return data;
}

async function upsertFarmAccess(
  userId: string,
  farmKey: FarmKey,
  canCommand: boolean
) {
  const admin = createAdminClient();
  const dup = await findFarmAccessRow(userId, farmKey);

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

async function deleteAllFarmAccess(userId: string, farmKey: FarmKey) {
  const admin = createAdminClient();
  await admin
    .from("user_access")
    .delete()
    .eq("user_id", userId)
    .eq("lsind_regist_no", farmKey.lsindRegistNo)
    .eq("item_code", farmKey.itemCode);
}

/** module/ctrl 잔여 스코프 제거 — farm 스코프가 단일 진실원 */
async function deleteOrphanFarmScopes(userId: string, farmKey: FarmKey) {
  const admin = createAdminClient();
  await admin
    .from("user_access")
    .delete()
    .eq("user_id", userId)
    .eq("lsind_regist_no", farmKey.lsindRegistNo)
    .eq("item_code", farmKey.itemCode)
    .neq("scope_type", "farm");
}

function parseFarmKey(raw: unknown): FarmKey | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const lsindRegistNo = String(o.lsindRegistNo ?? "").trim();
  const itemCode = String(o.itemCode ?? "").trim();
  if (!lsindRegistNo || !itemCode) return null;
  return { lsindRegistNo, itemCode };
}

export type GrantFarmAccessResult =
  | { ok: true }
  | { ok: false; error: "forbidden" | "invalid" | "notfound" };

async function grantFarmAccessCore(
  email: string,
  farmKey: FarmKey,
  canCommand: boolean
): Promise<GrantFarmAccessResult> {
  const me = await getCurrentUser();
  if (!me?.isAdmin) {
    return { ok: false, error: "forbidden" };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !farmKey.lsindRegistNo || !farmKey.itemCode) {
    return { ok: false, error: "invalid" };
  }

  const target = await findAuthUserByEmail(normalizedEmail);
  if (!target) {
    return { ok: false, error: "notfound" };
  }

  await ensureProfile(target.id);
  await upsertFarmAccess(target.id, farmKey, canCommand);
  revalidateAdminUsers();
  return { ok: true };
}

/** 행별 부여 — 페이지 이동 없이 결과 반환 */
export async function grantFarmAccessInline(input: {
  email: string;
  farmKey: FarmKey;
  canCommand: boolean;
}): Promise<GrantFarmAccessResult> {
  return grantFarmAccessCore(input.email, input.farmKey, input.canCommand);
}

async function resolveTargetUserId(
  email: string
): Promise<{ ok: true; userId: string } | { ok: false; error: "forbidden" | "invalid" | "notfound" }> {
  const me = await getCurrentUser();
  if (!me?.isAdmin) {
    return { ok: false, error: "forbidden" };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return { ok: false, error: "invalid" };
  }

  const target = await findAuthUserByEmail(normalizedEmail);
  if (!target) {
    return { ok: false, error: "notfound" };
  }

  return { ok: true, userId: target.id };
}

/** 조회 권한 ON/OFF — OFF 시 해당 농장 접근 전체 삭제 */
export async function toggleFarmReadInline(input: {
  email: string;
  farmKey: FarmKey;
  enabled: boolean;
}): Promise<GrantFarmAccessResult> {
  const resolved = await resolveTargetUserId(input.email);
  if (!resolved.ok) return resolved;

  if (!input.farmKey.lsindRegistNo || !input.farmKey.itemCode) {
    return { ok: false, error: "invalid" };
  }

  if (input.enabled) {
    const existing = await findFarmAccessRow(resolved.userId, input.farmKey);
    await ensureProfile(resolved.userId);
    const admin = createAdminClient();
    await deleteOrphanFarmScopes(resolved.userId, input.farmKey);
    if (existing) {
      await admin
        .from("user_access")
        .update({
          can_read: true,
          can_command: existing.can_command as boolean,
        })
        .eq("id", existing.id);
    } else {
      await admin.from("user_access").insert({
        user_id: resolved.userId,
        scope_type: "farm",
        lsind_regist_no: input.farmKey.lsindRegistNo,
        item_code: input.farmKey.itemCode,
        can_read: true,
        can_command: false,
      });
    }
  } else {
    await deleteAllFarmAccess(resolved.userId, input.farmKey);
  }

  revalidateAdminUsers();
  return { ok: true };
}

/** 명령 권한 ON/OFF — OFF 시 조회만 유지 */
export async function toggleFarmCommandInline(input: {
  email: string;
  farmKey: FarmKey;
  enabled: boolean;
}): Promise<GrantFarmAccessResult> {
  const resolved = await resolveTargetUserId(input.email);
  if (!resolved.ok) return resolved;

  if (!input.farmKey.lsindRegistNo || !input.farmKey.itemCode) {
    return { ok: false, error: "invalid" };
  }

  if (input.enabled) {
    await ensureProfile(resolved.userId);
    await upsertFarmAccess(resolved.userId, input.farmKey, true);
  } else {
    const existing = await findFarmAccessRow(resolved.userId, input.farmKey);
    if (!existing) {
      return { ok: false, error: "invalid" };
    }
    const admin = createAdminClient();
    await admin
      .from("user_access")
      .update({ can_read: true, can_command: false })
      .eq("id", existing.id);
  }

  revalidateAdminUsers();
  return { ok: true };
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

  const result = await grantFarmAccessCore(
    email,
    { lsindRegistNo, itemCode },
    canCommand
  );

  if (!result.ok) {
    redirect(`${ADMIN_USERS_PATH}?error=${result.error}`);
  }

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

  revalidateAdminUsers();
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
  const { data: row } = await admin
    .from("user_access")
    .select("user_id, lsind_regist_no, item_code")
    .eq("id", accessId)
    .maybeSingle();

  if (!row) {
    redirect(`${ADMIN_USERS_PATH}?error=invalid`);
  }

  await admin
    .from("user_access")
    .delete()
    .eq("user_id", row.user_id)
    .eq("lsind_regist_no", row.lsind_regist_no)
    .eq("item_code", row.item_code);

  revalidateAdminUsers();
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

  revalidateAdminUsers();
  redirect(`${ADMIN_USERS_PATH}?ok=role_updated`);
}
