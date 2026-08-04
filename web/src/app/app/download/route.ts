import { NextResponse } from "next/server";
import {
  getAppApkBucket,
  getAppApkObjectPath,
  isInstallUnlocked,
} from "@/lib/app-install/gate";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const SIGNED_URL_TTL_SEC = 120;

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const back = new URL("/app", origin);

  if (!(await isInstallUnlocked())) {
    back.searchParams.set("error", "auth");
    return NextResponse.redirect(back);
  }

  try {
    const admin = createAdminClient();
    const bucket = getAppApkBucket();
    const path = getAppApkObjectPath();
    const { data, error } = await admin.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_TTL_SEC);

    if (error || !data?.signedUrl) {
      console.error("[app/download] signed URL failed", error?.message);
      back.searchParams.set("error", "missing");
      return NextResponse.redirect(back);
    }

    return NextResponse.redirect(data.signedUrl);
  } catch (err) {
    console.error("[app/download]", err);
    back.searchParams.set("error", "missing");
    return NextResponse.redirect(back);
  }
}
