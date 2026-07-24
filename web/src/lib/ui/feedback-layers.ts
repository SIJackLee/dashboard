/**
 * 화면 피드백 레이어 z-index (낮 → 높).
 * - overlay: 적용 중 전체 화면 (로딩·결과)
 * - live-banner: 일괄 LIVE 대기 진행
 * - toast: 일회성 상태(채널 미매칭·성공 요약 등) — 항상 최상단 문구
 */
export const FEEDBACK_Z = {
  overlay: 70,
  liveBanner: 80,
  toast: 90,
} as const;
