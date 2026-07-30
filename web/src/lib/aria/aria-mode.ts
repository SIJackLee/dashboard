/** ARIA — Agricultural Reporting & Intelligent Assistant */
export const ARIA_NAME = "ARIA";
export const ARIA_FULL_NAME =
  "Agricultural Reporting & Intelligent Assistant";

export type VoiceReportStatus =
  | "idle"
  | "recording"
  | "uploading"
  | "analyzing"
  | "speaking"
  | "error";

/** ARIA 오브 시각 모드 (P1) */
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
