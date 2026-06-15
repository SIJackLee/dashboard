/**
 * 축사유형코드(Stall Type Code) — 축평원 「스마트축산 정보연계 인터페이스」 §3.3
 * @see STM_Ethernet/2. 「스마트축산 정보연계 인터페이스」 개정(안) 전문.pdf
 */
export const STALL_TYPE_NAMES: Record<string, string> = {
  // 양돈 (SP)
  SP01: "후보돈사",
  SP02: "임신사",
  SP03: "분만사",
  SP04: "베이비하우스",
  SP05: "자돈사",
  SP06: "육성사",
  SP07: "비육사",
  SP08: "검정사",
  SP09: "종부사",
  SP10: "퇴비장(분뇨처리장)",
  // 한우 (SW)
  SW01: "우사",
  SW02: "착유장",
  SW03: "퇴비장(분뇨처리장)",
  // 낙농 (SD)
  SD01: "우사",
  SD02: "착유장",
  SD03: "퇴비장(분뇨처리장)",
  // 양계 (SH)
  SH01: "산란육성계사",
  SH02: "산란계사",
  SH03: "종계육성계사",
  SH04: "종계사",
  SH05: "육계사",
  SH06: "선별장",
  SH07: "계사(공통)",
  SH08: "퇴비장(분뇨처리장)",
  // 오리 (ST)
  ST01: "종오리사",
  ST02: "육용오리사",
  // 사슴 (SR)
  SR01: "사육장",
  // 곤충 (SI)
  SI01: "곤충사육사",
  // 양봉 (SB)
  SB01: "양봉장",
};

const STALL_PREFIX_ORDER: Record<string, number> = {
  SW: 10,
  SD: 20,
  SP: 30,
  SH: 40,
  ST: 50,
  SR: 60,
  SI: 70,
  SB: 80,
};

export function normalizeStallTyCode(code: string | null | undefined): string {
  const c = (code ?? "").trim().toUpperCase();
  return c || "UNK";
}

export function stallTyCodeSortKey(code: string): number {
  const normalized = normalizeStallTyCode(code);
  const prefix = normalized.slice(0, 2);
  const prefixOrder = STALL_PREFIX_ORDER[prefix] ?? 900;
  const num = Number(normalized.slice(2));
  return prefixOrder * 100 + (Number.isFinite(num) ? num : 0);
}

export function getStallTypeName(code: string | null | undefined): string {
  const key = normalizeStallTyCode(code);
  return STALL_TYPE_NAMES[key] ?? key;
}

/** UI 표시용 — SP 코드 없이 축사유형명만 (예: 후보돈사) */
export function formatStallTypeLabel(code: string | null | undefined): string {
  const key = normalizeStallTyCode(code);
  return getStallTypeName(key);
}

/** itemCode 접두(WDPHTRIB)와 stallTyCode 접두(SW/SD/SP/…) 정합성 */
export function isStallTyValidForItemCode(
  stallTyCode: string | null | undefined,
  itemCode: string | null | undefined
): boolean {
  const ty = normalizeStallTyCode(stallTyCode);
  if (ty === "UNK") return true;
  const item = (itemCode ?? "").trim().toUpperCase();
  if (!item) return true;
  const expectedPrefix: Record<string, string> = {
    W: "SW",
    D: "SD",
    P: "SP",
    H: "SH",
    T: "ST",
    R: "SR",
    I: "SI",
    B: "SB",
  };
  const prefix = expectedPrefix[item.charAt(0)] ?? "SP";
  return ty.startsWith(prefix);
}
