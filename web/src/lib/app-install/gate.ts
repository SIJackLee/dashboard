import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const APP_INSTALL_COOKIE = "si_app_install";

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7일

function passwordConfigured(): string | null {
  const pw = process.env.APP_INSTALL_PASSWORD?.trim();
  return pw && pw.length > 0 ? pw : null;
}

export function isAppInstallConfigured(): boolean {
  return passwordConfigured() != null;
}

export function getAppApkVersionLabel(): string {
  return process.env.APP_APK_VERSION?.trim() || "latest";
}

export function getAppApkBucket(): string {
  return process.env.APP_APK_BUCKET?.trim() || "app-releases";
}

/** 버킷 내 객체 경로 */
export function getAppApkObjectPath(): string {
  return process.env.APP_APK_OBJECT_PATH?.trim() || "sungil-iot.apk";
}

function cookieToken(password: string): string {
  const pepper = process.env.APP_INSTALL_COOKIE_SECRET?.trim() || password;
  return createHmac("sha256", pepper).update(`app-install:${password}`).digest("hex");
}

export function verifyInstallPassword(input: string): boolean {
  const expected = passwordConfigured();
  if (!expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function isInstallUnlocked(): Promise<boolean> {
  const expectedPw = passwordConfigured();
  if (!expectedPw) return false;
  const jar = await cookies();
  const raw = jar.get(APP_INSTALL_COOKIE)?.value;
  if (!raw) return false;
  const expected = cookieToken(expectedPw);
  const a = Buffer.from(raw);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function setInstallUnlockCookie(): Promise<void> {
  const expectedPw = passwordConfigured();
  if (!expectedPw) return;
  const jar = await cookies();
  jar.set(APP_INSTALL_COOKIE, cookieToken(expectedPw), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/app",
    maxAge: COOKIE_MAX_AGE_SEC,
  });
}
