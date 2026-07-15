/** 기상청 공공데이터포털(data.go.kr) — WthrWrnInfoService · FcstZoneInfoService */

export const KMA_DATA_GO_KR_BASE = "https://apis.data.go.kr/1360000";

export const WTHR_WRN_SERVICE = `${KMA_DATA_GO_KR_BASE}/WthrWrnInfoService`;

/** @see https://www.data.go.kr/data/15000415/openapi.do */
export const WTHR_WRN_OPS = {
  /** 특보현황 — 현재 발효 중 (MVP 1순위) */
  pwnStatus: `${WTHR_WRN_SERVICE}/getPwnStatus`,
  /** 특보코드 — 종류·등급 한글명 (1회 캐시) */
  pwnCd: `${WTHR_WRN_SERVICE}/getPwnCd`,
  /** 기상특보통보문 */
  wrnMsg: `${WTHR_WRN_SERVICE}/getWthrWrnMsg`,
  wrnList: `${WTHR_WRN_SERVICE}/getWthrWrnList`,
} as const;

/** @see https://www.data.go.kr/data/15057111/openapi.do — 특보구역 REG_ID 빌드용 (자동승인) */
export const FCST_ZONE_SERVICE = `${KMA_DATA_GO_KR_BASE}/FcstZoneInfoService`;
export const FCST_ZONE_OPS = {
  zoneCd: `${FCST_ZONE_SERVICE}/getFcstZoneCd`,
} as const;

/** 특보종류 코드 → 한글 (getPwnCd / DB 기준) */
export const WRN_TYPE_LABEL: Record<string, string> = {
  W: "강풍",
  R: "호우",
  C: "한파",
  D: "건조",
  O: "폭풍해일",
  N: "지진해일",
  V: "풍랑",
  T: "태풍",
  S: "대설",
  Y: "황사",
  H: "폭염",
  F: "안개",
};

/** lvl: 1=주의보, 2=경보 */
export const WRN_LEVEL_LABEL: Record<string, string> = {
  "1": "주의보",
  "2": "경보",
};

export const DATA_GO_KR_APPLY_URLS = {
  wthrWrnInfo: "https://www.data.go.kr/data/15000415/openapi.do",
  fcstZoneInfo: "https://www.data.go.kr/data/15057111/openapi.do",
} as const;
