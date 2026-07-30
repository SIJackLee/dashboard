import {

  clampDepth,

  emptyAriaSession,

  type AriaDepth,

  type AriaRoute,

  type AriaSession,

} from "@/lib/aria/protocol/types";



const DEEP_RE =

  /자세히|전부|진단\s*까지|진단해|상세|디테일|건별|하나씩|딥\s*다|끝까지/;

const MORE_RE = /더\s*(알려|말|설명|자세히)|이어서|계속|다음|좀\s*더/;

const CTRL_LIST_RE = /어느\s*컨트롤러|누가|컨트롤러\s*(가|는|좀)|장비/;

const ALARM_RE =

  /뭐가\s*문제|이상상황|경고|위험|알람|무슨\s*일|왜\s*그래|왜\s*이래/;

const STATUS_RE = /상황|농장\s*상태|요약|전체|브리핑|현황|리포트/;

const FARM_STATUS_RE =

  /(농장|축사|이상|알람|컨트롤러).{0,8}(어때|괜찮)|^(오늘\s*)?(상황|상태)\s*어때/;

const CTRL_ROUTE_RE =

  /설정\s*추천|추천\s*설정|대응|조치|어떻게\s*하면|어떻게\s*할까|추천해|환기\s*어떻게|어떻게\s*대응/;

const WEATHER_RE = /날씨|기상|비\s*올|비\s*와|기온/;

const WELLBEING_RE =

  /^(괜찮니|괜찮아|괜찮아요|괜찮습니까|잘\s*지내|너는\s*괜찮|ARIA\s*괜찮)/i;

/** 안부/현황 애매 — CHAT으로 한 번 갈라줌 */

const AMBIG_HOW_RE = /^(지금\s*)?어때\??$/;

const CHAT_RE =

  /^(안녕|안녕하세요|하이|헬로|고마워|감사|뭐야|누구|소개|잘\s*자|바이)/i;

const BARE_RECOMMEND_RE = /^(추천해\s*줘|추천해줘|추천)$/;

const CRITICAL_ONLY_RE = /위험\s*만|크리티컬\s*만/;

/** 알람 임계·설정값 변경 요청 — CTRL로 보내 거절 */
const THRESHOLD_EDIT_RE =
  /임계|알람\s*(상한|하한|설정)|상한\s*(을\s*)?(낮|줄)|하한\s*(을\s*)?(올|높)/;

/** 말끝 미완 — 바로 본론보다 한 번 확인 */
const FRAGMENT_RE = /^(컨트롤러가|컨트롤러는|지금\s*농장|장비|축사)$/;

const WHO_CONTROLLER_RE = /누가/;



export function isDeepQuestion(question: string): boolean {

  return DEEP_RE.test(question.trim());

}



export function isMoreQuestion(question: string): boolean {

  return MORE_RE.test(question.trim());

}



export function isBareRecommend(question: string): boolean {

  return BARE_RECOMMEND_RE.test(question.trim());

}



export function wantsCriticalOnly(question: string): boolean {

  return CRITICAL_ONLY_RE.test(question.trim());

}



export function wantsThresholdEdit(question: string): boolean {

  return THRESHOLD_EDIT_RE.test(question.trim());

}



export function isFragmentQuestion(question: string): boolean {

  return FRAGMENT_RE.test(question.trim());

}



export function isWhoControllerQuestion(question: string): boolean {

  return WHO_CONTROLLER_RE.test(question.trim());

}



/** 규칙 기반 라우팅 (애매하면 FARM) */

export function routeByRules(question: string): AriaRoute {

  const q = question.trim();

  if (!q) return "FARM";



  if (WEATHER_RE.test(q)) return "CHAT";

  if (WELLBEING_RE.test(q)) return "CHAT";

  if (AMBIG_HOW_RE.test(q)) return "CHAT";

  if (CHAT_RE.test(q) && !ALARM_RE.test(q) && !FARM_STATUS_RE.test(q)) {

    return "CHAT";

  }

  if (
    CTRL_ROUTE_RE.test(q) ||
    BARE_RECOMMEND_RE.test(q) ||
    THRESHOLD_EDIT_RE.test(q)
  ) {
    return "CTRL";
  }

  return "FARM";

}



/**

 * 혼합 턴 C: 세션 depth + 질문 힌트 → 목표 DEPTH.

 * 「자세히」류 → 4.

 * 「더 알려줘」+ 직전 FARM → session.depth+1 (이미 4면 4 유지).

 */

export function resolveDepthReq(

  question: string,

  session: AriaSession | null | undefined,

): AriaDepth {

  const q = question.trim();

  const prev = session?.depth ?? 0;

  const farmSession = Boolean(session && session.lastRoute === "FARM");



  if (DEEP_RE.test(q)) return 4;



  if (MORE_RE.test(q) && farmSession) {

    if (prev >= 4) return 4;

    return clampDepth(prev + 1);

  }



  let hintMin: AriaDepth = 1;

  if (CTRL_LIST_RE.test(q)) hintMin = 3;

  else if (ALARM_RE.test(q) || CRITICAL_ONLY_RE.test(q)) hintMin = 2;

  else if (STATUS_RE.test(q) || FARM_STATUS_RE.test(q)) hintMin = 1;

  else if (MORE_RE.test(q)) hintMin = 2;



  if (!farmSession) {

    return hintMin;

  }



  const stepped = clampDepth(prev + 1);

  return clampDepth(Math.max(hintMin, stepped));

}



export function parseAriaSession(raw: unknown): AriaSession {

  if (!raw || typeof raw !== "object") return emptyAriaSession();

  const o = raw as Record<string, unknown>;

  const depth = clampDepth(Number(o.depth) || 1);

  return {

    depth,

    focusStallType:

      typeof o.focusStallType === "string" ? o.focusStallType : null,

    focusStallNo: typeof o.focusStallNo === "string" ? o.focusStallNo : null,

    lastRoute:

      o.lastRoute === "CHAT" ||

      o.lastRoute === "FARM" ||

      o.lastRoute === "CTRL"

        ? o.lastRoute

        : null,

  };

}



export function ariaProtocolV1Enabled(): boolean {

  const v = process.env.ARIA_PROTOCOL_V1?.trim().toLowerCase();

  if (v === "0" || v === "false" || v === "off") return false;

  return true;

}



/** intent + 발화 — 짧은 유사 문장 충돌을 줄이기 위한 seed */

export function phraseSeed(intent: string, question: string): string {

  return `${intent.trim()}|${question.trim()}`;

}



/** 동일 의도라도 질문 문구에 따라 템플릿 인덱스 고정 선택 */

export function phraseIndex(seed: string, modulo: number): number {

  if (modulo <= 0) return 0;

  let h = 2166136261;

  for (let i = 0; i < seed.length; i++) {

    h ^= seed.charCodeAt(i);

    h = Math.imul(h, 16777619);

  }

  h ^= seed.length * 0x9e3779b9;

  h ^= seed.split(/\s+/).filter(Boolean).length << 11;

  if (seed.length > 0) {

    h ^= seed.charCodeAt(0) << 7;

    h ^= seed.charCodeAt(seed.length - 1) << 3;

  }

  return Math.abs(h) % modulo;

}


