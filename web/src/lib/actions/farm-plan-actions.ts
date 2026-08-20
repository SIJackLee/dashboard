"use server";

import { lookupCadastralBoundary } from "@/lib/geo/cadastral-parcel";
import { isValidMapCoord } from "@/lib/geo/map-coords";
import type { BarnPlanLot } from "@/lib/farm/barn-plan-boundary";

export async function getKakaoJsKeyAction(): Promise<string | null> {
  const key =
    process.env.KAKAO_JS_KEY?.trim() ||
    process.env.NEXT_PUBLIC_KAKAO_JS_KEY?.trim() ||
    "";
  return key || null;
}

export async function lookupCadastralBoundaryAction(input: {
  lat: number;
  lng: number;
}): Promise<
  | { ok: true; lots: BarnPlanLot[] }
  | { ok: false; error: "parcel_unavailable" | "parcel_not_found" }
> {
  if (!isValidMapCoord(input.lat, input.lng)) {
    return { ok: false, error: "parcel_not_found" };
  }
  return lookupCadastralBoundary(input.lat, input.lng);
}
