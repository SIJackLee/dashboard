"use server";

import { getCurrentUser } from "@/lib/auth/get-current-user";
import type { FarmKey } from "@/lib/data/farm-key";
import {
  buildFarmFacts,
  canReadFarm,
} from "@/lib/voice-report/build-farm-facts";
import type { VoiceFarmFacts } from "@/lib/voice-report/types";

export type AriaMetricsSnapshot = VoiceFarmFacts;

export async function fetchAriaFarmMetricsAction(
  farmKey: FarmKey,
): Promise<
  | { ok: true; facts: AriaMetricsSnapshot }
  | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthorized" };
  if (!user.hasAccess) return { ok: false, error: "no_access" };
  if (!canReadFarm(user, farmKey)) return { ok: false, error: "farm_denied" };

  try {
    const facts = await buildFarmFacts(farmKey);
    return { ok: true, facts };
  } catch (e) {
    const message = e instanceof Error ? e.message : "facts_failed";
    return { ok: false, error: message };
  }
}
