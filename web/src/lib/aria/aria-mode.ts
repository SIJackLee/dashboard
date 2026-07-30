/**
 * DELIN — Data-driven Environmental & Livestock Intelligence Navigator
 * 델린 · 데이터 기반 축사 환경·가축 지능형 안내자
 * (구 표기 ARIA — Agricultural Reporting & Intelligent Assistant)
 */
export const DELIN_NAME = "DELIN";
/** UI 탭·한국어 안내 */
export const DELIN_NAME_KO = "델린";
export const DELIN_FULL_NAME =
  "Data-driven Environmental & Livestock Intelligence Navigator";
export const DELIN_FULL_NAME_KO =
  "데이터 기반 축사 환경·가축 지능형 안내자";
/** 브랜드 한 줄 */
export const DELIN_TAGLINE = "축사를 이해하고, 농장을 지키는 AI — DELIN";

/** @deprecated 표시명은 DELIN_* 사용. 호환용 alias */
export const ARIA_NAME = DELIN_NAME;
/** @deprecated */
export const ARIA_FULL_NAME = DELIN_FULL_NAME;

export type VoiceReportStatus =
  | "idle"
  | "recording"
  | "uploading"
  | "analyzing"
  | "speaking"
  | "error";

/** DELIN 오브 시각 모드 */
export type AriaOrbMode = "idle" | "listen" | "think" | "speak" | "error";

export function voiceStatusToAriaMode(
  status: VoiceReportStatus,
  opts?: { micTesting?: boolean },
): AriaOrbMode {
  if (opts?.micTesting) return "listen";
  switch (status) {
    case "recording":
      return "listen";
    case "uploading":
    case "analyzing":
      return "think";
    case "speaking":
      return "speak";
    case "error":
      return "error";
    default:
      return "idle";
  }
}

export const ARIA_ORB_MODE_LABEL: Record<AriaOrbMode, string> = {
  idle: "대기",
  listen: "듣는 중",
  think: "분석 중",
  speak: "읽는 중",
  error: "오류",
};
