export type ProfilePinToolId = "alarm" | "pdf" | "theme";

export const PROFILE_PINNED_TOOLS_STORAGE_KEY = "profile-pinned-tools";

/** 「헤더로 모두 되돌리기」 — 빈 배열과 프로필 기본 배치 구분 */
export const PROFILE_PIN_HEADER_MODE_KEY = "profile-pinned-tools-header-mode";

export const PROFILE_PIN_DRAG_MIME = "application/x-profile-pin-tool";

export const PROFILE_PIN_MAX = 3;

export const PROFILE_PINNABLE_TOOLS: ProfilePinToolId[] = [
  "alarm",
  "pdf",
  "theme",
];

/** localStorage 미설정 시 — 헤더 대신 프로필 허브에 배치 */
export const DEFAULT_PROFILE_PINNED_TOOLS: ProfilePinToolId[] = [
  ...PROFILE_PINNABLE_TOOLS,
];

export const PROFILE_PIN_TOOL_META: Record<
  ProfilePinToolId,
  { label: string; shortLabel: string }
> = {
  alarm: { label: "이상상황", shortLabel: "알람" },
  pdf: { label: "오늘의 리포트", shortLabel: "PDF" },
  theme: { label: "테마", shortLabel: "테마" },
};

export function isProfilePinToolId(value: string): value is ProfilePinToolId {
  return (
    value === "alarm" || value === "pdf" || value === "theme"
  );
}

export function parseProfilePinnedTools(
  raw: string | null,
): ProfilePinToolId[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: ProfilePinToolId[] = [];
    for (const item of parsed) {
      if (typeof item !== "string" || !isProfilePinToolId(item)) continue;
      if (out.includes(item)) continue;
      out.push(item);
      if (out.length >= PROFILE_PIN_MAX) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function isProfilePinHeaderMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(PROFILE_PIN_HEADER_MODE_KEY) === "1";
}

export function setProfilePinHeaderMode(on: boolean): void {
  if (typeof window === "undefined") return;
  if (on) {
    localStorage.setItem(PROFILE_PIN_HEADER_MODE_KEY, "1");
  } else {
    localStorage.removeItem(PROFILE_PIN_HEADER_MODE_KEY);
  }
}

/** 프로필 기본 — 빈·레거시 []·테마 누락 시 DEFAULT로 보정 */
export function normalizeProfilePinnedTools(
  parsed: ProfilePinToolId[],
): ProfilePinToolId[] {
  if (isProfilePinHeaderMode()) return [];
  if (parsed.length === 0) return [...DEFAULT_PROFILE_PINNED_TOOLS];

  const out = [...parsed];
  for (const id of DEFAULT_PROFILE_PINNED_TOOLS) {
    if (out.length >= PROFILE_PIN_MAX) break;
    if (!out.includes(id)) out.push(id);
  }
  return out.slice(0, PROFILE_PIN_MAX);
}

export function readProfilePinnedToolsFromStorage(): ProfilePinToolId[] {
  if (typeof window === "undefined") return DEFAULT_PROFILE_PINNED_TOOLS;
  if (isProfilePinHeaderMode()) return [];

  const raw = localStorage.getItem(PROFILE_PINNED_TOOLS_STORAGE_KEY);
  if (raw === null) return DEFAULT_PROFILE_PINNED_TOOLS;

  const parsed = parseProfilePinnedTools(raw);
  const normalized = normalizeProfilePinnedTools(parsed);
  if (
    normalized.length !== parsed.length ||
    normalized.some((id, i) => id !== parsed[i])
  ) {
    writeProfilePinnedToolsToStorage(normalized);
  }
  return normalized;
}

export function writeProfilePinnedToolsToStorage(
  pinned: ProfilePinToolId[],
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      PROFILE_PINNED_TOOLS_STORAGE_KEY,
      JSON.stringify(pinned.slice(0, PROFILE_PIN_MAX)),
    );
  } catch {
    /* quota */
  }
}

export function isProfilePinToolPinned(
  pinned: ProfilePinToolId[],
  id: ProfilePinToolId,
): boolean {
  return pinned.includes(id);
}
