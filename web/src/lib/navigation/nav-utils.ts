export const NAV_MIN_DISPLAY_MS = 200;
/** brand(로그인 스플래시) — 로고 페이드인(2s)이 완주되도록 하는 최소 표시 시간 */
export const NAV_BRAND_MIN_DISPLAY_MS = 2_100;
/** brand 스플래시 페이드아웃 시간(globals.css login-splash-fade-out과 동기) */
export const NAV_BRAND_FADE_OUT_MS = 150;
/** router.push 미완료 시 pending 고정 방지 */
export const NAV_MAX_WAIT_MS = 8_000;

type HrefLike =
  | string
  | URL
  | {
      pathname?: string | null;
      query?: Record<string, string | string[] | undefined> | null;
      hash?: string | null;
    };

export function hrefToString(href: HrefLike): string {
  if (typeof href === "string") return href;
  if (href instanceof URL) return `${href.pathname}${href.search}${href.hash}`;

  const pathname = href.pathname ?? "";
  let search = "";
  if (href.query && typeof href.query === "object") {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(href.query)) {
      if (value == null) continue;
      if (Array.isArray(value)) {
        for (const v of value) params.append(key, v);
      } else {
        params.set(key, value);
      }
    }
    const q = params.toString();
    if (q) search = `?${q}`;
  }
  const hash = href.hash ? (href.hash.startsWith("#") ? href.hash : `#${href.hash}`) : "";
  return `${pathname}${search}${hash}`;
}

/** 페이지 라우트(pathname)가 바뀔 때만 전역 오버레이 */
export function shouldUseGlobalNav(href: string, pathname: string): boolean {
  try {
    const url = new URL(href, "http://nav.local");
    return url.pathname !== pathname;
  } catch {
    return href.split("?")[0] !== pathname;
  }
}

export function sublabelFromHref(href: string): string | undefined {
  try {
    const url = new URL(href, "http://nav.local");
    const lsind = url.searchParams.get("lsind");
    const item = url.searchParams.get("item");
    if (lsind && item) return `${lsind} · ${item}`;
    return undefined;
  } catch {
    return undefined;
  }
}
