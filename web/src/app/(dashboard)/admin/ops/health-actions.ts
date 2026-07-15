"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { adminOpsPath } from "@/lib/admin/ops-tabs";
import { HEALTH_SNAPSHOT_CACHE_TAG } from "@/lib/admin/health/fetch-snapshot";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_OPS_SYSTEM_PATH = adminOpsPath("system");

export async function acknowledgeCommandHealthCheckpoint(
  commandId: string,
  note?: string
): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentUser();
  if (!me?.isAdmin) {
    redirect(`${ADMIN_OPS_SYSTEM_PATH}?error=forbidden`);
  }

  const trimmed = commandId?.trim();
  if (!trimmed) {
    return { ok: false, error: "command_id required" };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("health_command_checkpoint").upsert(
    {
      command_id: trimmed,
      acknowledged_by: me.id,
      acknowledged_at: new Date().toISOString(),
      note: note?.trim() || null,
    },
    { onConflict: "command_id" }
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateTag(HEALTH_SNAPSHOT_CACHE_TAG, "max");
  revalidatePath(ADMIN_OPS_SYSTEM_PATH);
  return { ok: true };
}
