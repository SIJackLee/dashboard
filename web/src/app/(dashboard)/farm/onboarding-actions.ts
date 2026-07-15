"use server";

import { mergeProfileUiConfig } from "@/lib/data/profile-ui-config";
import { createClient } from "@/lib/supabase/server";
import { TOUR_VERSION } from "@/lib/onboarding/tour-steps";

type OnboardingConfig = {
  tourVersion?: number;
  tourDoneAt?: string;
};

function readOnboarding(uiConfig: unknown): OnboardingConfig {
  if (!uiConfig || typeof uiConfig !== "object") return {};
  const onboarding = (uiConfig as Record<string, unknown>).onboarding;
  if (!onboarding || typeof onboarding !== "object") return {};
  return onboarding as OnboardingConfig;
}

/** 투어 노출 여부 — 미완료이거나 완료 버전이 현재 버전보다 낮으면 true. */
export async function shouldShowOnboardingTourAction(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from("profiles")
    .select("ui_config")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return false;

  const onboarding = readOnboarding(data?.ui_config);
  if (!onboarding.tourDoneAt) return true;
  return (onboarding.tourVersion ?? 0) < TOUR_VERSION;
}

/** 투어 완료(또는 건너뛰기) 기록 — profiles.ui_config.onboarding 병합 저장. */
export async function markOnboardingTourDoneAction(): Promise<{
  ok: boolean;
  error?: string;
}> {
  return mergeProfileUiConfig((prev) => ({
    ...prev,
    onboarding: {
      ...(typeof prev.onboarding === "object" && prev.onboarding
        ? (prev.onboarding as Record<string, unknown>)
        : {}),
      tourVersion: TOUR_VERSION,
      tourDoneAt: new Date().toISOString(),
    },
  }));
}
