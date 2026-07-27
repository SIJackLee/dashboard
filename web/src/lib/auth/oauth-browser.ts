/** Google이 차단하는 IDE/임베디드 브라우저 — 카카오는 보통 가능 */
export function isGoogleOAuthBlockedBrowser(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }

  const ua = navigator.userAgent;
  if (/Cursor/i.test(ua)) return true;
  /* VS Code / Cursor Simple Browser (Electron) */
  if (/\bElectron\b/i.test(ua)) return true;
  if (/VSCode|Code\/\d/i.test(ua) && !/Edg\//i.test(ua)) return true;
  return false;
}

/** @deprecated use isGoogleOAuthBlockedBrowser */
export function isRestrictedOAuthBrowser(): boolean {
  return isGoogleOAuthBlockedBrowser();
}
