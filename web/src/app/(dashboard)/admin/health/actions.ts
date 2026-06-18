"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createAdminClient } from "@/lib/supabase/admin";

const HEALTH_PATH = "/admin/health";

export async function acknowledgeCommandHealthCheckpoint(
  commandId: string,
  note?: string
): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentUser();
  if (!me?.isAdmin) {
    redirect(`${HEALTH_PATH}?error=forbidden`);
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

  revalidatePath(HEALTH_PATH);
  revalidatePath(`${HEALTH_PATH}/collector-c`);
  revalidatePath(`${HEALTH_PATH}/collector`);
  return { ok: true };
}
