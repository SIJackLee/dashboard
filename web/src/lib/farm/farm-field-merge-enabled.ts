/**
 * /farm 그리드·목록 → «현장» 통합 (P0).
 * - 기본 on. false|0|off 이면 현행 4탭.
 * - NEXT_PUBLIC_FARM_FIELD_MERGE_V1 로 강제.
 */
export function farmFieldMergeEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_FARM_FIELD_MERGE_V1?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") return false;
  if (raw === "1" || raw === "true" || raw === "on") return true;
  return true;
}
