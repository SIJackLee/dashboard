/** Google OAuth를 막는 임베디드/제한 브라우저 여부 */
export function isRestrictedOAuthBrowser(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }

  const ua = navigator.userAgent;
  if (/Cursor/i.test(ua)) return true;
  /* VS Code / Cursor Simple Browser (Electron) — Google OAuth 차단 */
  if (/\bElectron\b/i.test(ua)) return true;
  if (/VSCode|Code\/\d/i.test(ua) && !/Edg\//i.test(ua)) return true;
  return false;
}
