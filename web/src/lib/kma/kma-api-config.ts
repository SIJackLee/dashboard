/** 기상청 공공데이터포털(data.go.kr) — WthrWrnInfoService */

export const KMA_DATA_GO_KR_BASE = "https://apis.data.go.kr/1360000";

export const WTHR_WRN_SERVICE = `${KMA_DATA_GO_KR_BASE}/WthrWrnInfoService`;

export const WTHR_WRN_OPS = {
  pwnStatus: `${WTHR_WRN_SERVICE}/getPwnStatus`,
  pwnCd: `${WTHR_WRN_SERVICE}/getPwnCd`,
} as const;

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

export const WRN_LEVEL_LABEL: Record<string, string> = {
  "1": "주의보",
  "2": "경보",
};
