"use server";

import { redirect } from "next/navigation";
import {
  setInstallUnlockCookie,
  verifyInstallPassword,
} from "@/lib/app-install/gate";

export async function unlockAppInstall(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (!verifyInstallPassword(password)) {
    redirect("/app?error=password");
  }
  await setInstallUnlockCookie();
  redirect("/app");
}
