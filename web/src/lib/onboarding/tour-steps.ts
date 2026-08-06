/**
 * 스포트라이트 투어 — 스텝 선언(데이터 전용).
 * 서버 액션·클라이언트 엔진 양쪽에서 import 하므로 "use client"/"server-only" 금지.
 *
 * 스코프:
 *   field(현장) — 헤더 → 농장 → 그리드/목록 카드·패널
 *   chart(차트) — 통합 추이·레이어·기간·구간
 *   aria(델린) — 스테이지·음성 입력
 *
 * 큰 컨테이너(map-grid·list-body)는 hole로 쓰지 않음 — 개별 카드/패널만 스포트라이트.
 * 모바일: mobileSelector·mobileBody·mobileScrollPolicy로 시트 UI에 맞춤.
 */

import {
  appendFarmKeyParams,
  type FarmKey,
} from "@/lib/data/farm-key";
import {
  buildFarmPath,
  type FarmHubView,
} from "@/lib/farm/farm-view-url";
import type { TourGridAction } from "@/lib/onboarding/tour-grid-actions";

export type { TourGridAction };

/** 투어 개편 시 +1 — 저장된 완료 버전보다 크면 재노출. */
export const TOUR_VERSION = 18;

export type TourScrollPolicy =
  | "none"
  | "fit-between"
  | "anchor-top"
  | "anchor-card-top";

/** 자동 시작 전 DOM 준비 — 보기 탭 + 축사 카드 + 히트맵. */
export const TOUR_READY_SELECTOR = '[data-tour-id="barn-card"]';
export const TOUR_READY_VIEW_TOGGLE_SELECTOR = '[data-tour-id="view-toggle"]';
/** stall trend 반영 후 히트맵이 떠야 카드 높이가 안정. */
export const TOUR_READY_HEATMAP_SELECTOR = '[data-tour-id="heatmap"]';
/** 콘텐츠 ready로 인정할 최소 축사 카드 수. */
export const TOUR_READY_MIN_CARDS = 1;
export const TOUR_READY_CHART_SELECTOR = '[data-tour-id="farm-chart-view"]';
export const TOUR_READY_ARIA_SELECTOR = '[data-tour-id="farm-aria-view"]';

/** 단일 농장 스코프 URL — admin 허브에서 투어 재시작 시 사용. */
export function buildFarmTourPath(farmKey: FarmKey): string {
  return buildFarmPath(appendFarmKeyParams(new URLSearchParams(), farmKey));
}

/** 그리드(FarmMapCanvas)에 보내는 투어 액션 이벤트. */
export const FARM_TOUR_ACTION_EVENT = "farm-tour-action";
/** 그리드 expand/collapse·목록 모드 전환 안착 완료. */
export const FARM_TOUR_ACTION_DONE_EVENT = "farm-tour-action-done";
/** 투어 활성 — staggerMount 등 UI 완화용. */
export const FARM_TOUR_ACTIVE_EVENT = "farm-tour-active";
/** 헤더 ? — 현재 탭 스코프 투어 수동 재시작. */
export const FARM_TOUR_RESTART_EVENT = "farm-tour-restart";
/** 페이지 이동 후 재시작 — sessionStorage 플래그 키. */
export const FARM_TOUR_RESTART_FLAG = "farm-tour-restart";
/** 재시작 스코프 — sessionStorage 키. */
export const FARM_TOUR_RESTART_SCOPE_KEY = "farm-tour-restart-scope";

/** 현장(그리드·목록) · 차트 · 델린 */
export type TourScope = "field" | "chart" | "aria";

/** 스텝 진입 시 전환할 허브 탭. */
export type TourView = FarmHubView;

export function tourScopeFromHubView(view: FarmHubView): TourScope {
  if (view === "chart") return "chart";
  if (view === "aria") return "aria";
  return "field";
}

export function parseTourScope(raw: string | null | undefined): TourScope {
  if (raw === "chart" || raw === "aria" || raw === "field") return raw;
  return "field";
}

export type TourStepDef = {
  id: string;
  /** 현장 / 차트 / 델린 */
  scope: TourScope;
  /** 스포트라이트 대상 — document.querySelector 첫 매치. */
  selector: string;
  /** 모바일 전용 스포트라이트(작·안정 타깃). */
  mobileSelector?: string;
  /** 모바일 스크롤 anchor — 스포트라이트와 다를 때. */
  mobileScrollSelector?: string;
  /** 보조 강조(펄스 링) 대상 — 예: 드래그 손잡이. */
  accentSelector?: string;
  /** 스텝 진입 시 필요한 뷰. */
  view: TourView;
  title: string;
  /** 한 줄 요약. */
  body: string;
  /** 모바일 전용 요약(시트·스택 UI). */
  mobileBody?: string;
  /** 컴포넌트 내부 안내 — hole은 유지하고 툴팁에서만 나열. */
  bullets?: string[];
  /** 모바일 전용 불릿. */
  mobileBullets?: string[];
  /** 스텝 진입 시 그리드/목록 액션. */
  gridAction?: TourGridAction;
  /** 툴팁 하단 확장 콘텐츠. */
  extra?: "anatomy" | "pills" | "header-icons" | "list-mode-icons";
  /** 대상이 없으면 즉시 건너뜀. */
  skipIfMissing?: boolean;
  /** 데스크톱·공통 스크롤 정책. */
  scrollPolicy?: TourScrollPolicy;
  /** 모바일 스크롤 정책(시트 내부 정렬 등). */
  mobileScrollPolicy?: TourScrollPolicy;
};

export const TOUR_STEPS: TourStepDef[] = [
  {
    id: "header",
    scope: "field",
    selector: '[data-tour-id="header-tools-panel"]',
    accentSelector: '[data-tour-id="header-tools"]',
    view: "map",
    scrollPolicy: "none",
    gridAction: "open-header-tools",
    title: "상단 헤더 · 도구",
    body: "오른쪽 상단에 이상상황·리포트·테마·화면 미리보기 아이콘이 바로 보입니다.",
    mobileBody: "오른쪽 상단에 이상상황·리포트·테마 아이콘이 바로 보입니다.",
    bullets: [
      "이상상황 · 운영(관리자) · 오늘의 리포트",
      "라이트/다크 · PC/모바일 미리보기(넓은 화면)",
      "물음표 — 지금 보는 탭의 기능 안내",
      "계정 — 오른쪽 프로필 메뉴",
    ],
    mobileBullets: [
      "이상상황 배지 · 리포트 · 테마 — 바로 탭",
      "물음표 — 이 화면 기능 안내",
      "계정 — 최근 활동 · 농장 주소",
    ],
    extra: "header-icons",
  },
  {
    id: "farm-switcher",
    scope: "field",
    selector: '[data-tour-id="farm-switcher"]',
    view: "map",
    scrollPolicy: "none",
    title: "농장 선택",
    body: "모니터링할 농장을 바꿉니다. 관리자는 전체 농장 허브로도 이동할 수 있습니다.",
    skipIfMissing: true,
  },
  {
    id: "map-command-bar",
    scope: "field",
    selector: '[data-tour-id="farm-command-bar"]',
    view: "map",
    scrollPolicy: "anchor-top",
    title: "그리드 도구",
    body: "그리드 상단에서 일괄 설정과 히트맵 기간을 다룹니다.",
    mobileBody: "그리드 상단에서 일괄적용과 히트맵 기간을 다룹니다.",
    skipIfMissing: true,
    bullets: [
      "일괄적용 — 여러 축사 유형에 온도·알람을 한 번에",
      "기간(24시간→7일→30일 순환) — 축사 카드 히트맵 구간",
    ],
  },
  {
    id: "map-barn-card",
    scope: "field",
    selector: '[data-tour-id="barn-card"]',
    accentSelector: '[data-tour-id="barn-drag"]',
    view: "map",
    scrollPolicy: "anchor-top",
    title: "축사 카드",
    body: "현장의 기본 단위입니다. 대표 카드 하나를 기준으로 봅니다.",
    mobileBody: "현장의 기본 단위입니다. 카드를 탭하면 상세·필터가 열립니다.",
    bullets: [
      "테두리 색 — 정상·주의·경고",
      "온도계·물방울 아이콘 — 현재 온도·습도",
      "좌측 현황 — 축사 선택·전체보기",
      "손잡이(⠿) — 있는 경우 드래그로 배치",
    ],
    mobileBullets: [
      "테두리 색 — 정상·주의·경고",
      "온도계·물방울 — 현재 온도·습도",
      "카드 탭 — 상세·필터",
    ],
  },
  {
    id: "detail-panel",
    scope: "field",
    selector: '[data-tour-id="detail-panel-header"]',
    view: "map",
    gridAction: "expand-first",
    scrollPolicy: "anchor-top",
    title: "확대 상세 — 컨트롤러",
    body: "축사를 열면 컨트롤러별 현재값과 허용 범위가 나옵니다.",
    bullets: [
      "컨트롤러 번호·온도·습도·채널",
      "게이지 — 현재값과 알람·설정 구간",
    ],
    /** 현장 병합·목록 중심 UI에서는 상세 패널이 없을 수 있음 */
    skipIfMissing: true,
  },
  {
    id: "detail-charts",
    scope: "field",
    selector: '[data-tour-id="detail-panel-chart-first"]',
    mobileSelector: '[data-tour-id="detail-panel-charts"]',
    view: "map",
    scrollPolicy: "fit-between",
    title: "확대 상세 — 그래프",
    body: "선택한 지표를 한 차트에 컨트롤러별 선으로 겹쳐 비교합니다. 점선은 알람 상·하한입니다.",
    mobileBody:
      "선택한 지표를 한 차트에 컨트롤러별 선으로 겹쳐 비교합니다. 점선은 알람 상·하한입니다.",
    bullets: [
      "컨트롤러별 색·범례",
      "아래 칩 — 컨트롤러 선택·현재값",
      "기간 버튼 — 24시간→7일→30일 순환",
    ],
    skipIfMissing: true,
  },
  {
    id: "view-toggle",
    scope: "field",
    selector: '[data-tour-id="view-toggle"]',
    /** 맵에 남긴 채 탭만 강조 — list 전환은 다음 스텝에서(동시 collapse+list 방지). */
    view: "map",
    gridAction: "collapse",
    /** 5·6에서 상세로 내려간 뒤 탭이 화면 밖으로 남지 않게 상단 정렬. */
    scrollPolicy: "anchor-top",
    title: "현장 · 차트 · 델린",
    body: "상단 탭으로 현장·차트·델린을 바꿉니다. 물음표는 지금 켠 탭 안내만 엽니다.",
    bullets: [
      "현장 — 배치·컨트롤러·그래프·설정",
      "차트 — 농장 통합 추이",
      "델린 — 음성·텍스트 질의",
    ],
  },
  {
    id: "list-command-bar",
    scope: "field",
    selector: '[data-tour-id="farm-command-bar"]',
    view: "list",
    scrollPolicy: "anchor-top",
    title: "목록 도구",
    body: "목록 상단에서 일괄적용과 보기 모드(아이콘)를 고릅니다.",
    mobileBody:
      "목록 상단에서 보기 전환과(권한 있으면) 일괄적용을 다룹니다. 그래프·설정은 카드를 탭하면 하단 시트로 엽니다.",
    skipIfMissing: true,
    bullets: [
      "일괄적용 — 여러 컨트롤러에 설정 일괄 반영",
      "칩·톱니·차트 아이콘 — 컨트롤러 / 그래프 / 설정 모드",
      "격자·목록 아이콘 — 그룹별 보기 전환",
    ],
    mobileBullets: [
      "일반·그룹 보기 전환",
      "일괄적용 — 권한 있을 때 상단 바",
      "카드 탭 — 그래프·설정 하단 시트",
    ],
    extra: "list-mode-icons",
  },
  {
    id: "list-controller",
    scope: "field",
    selector: '[data-tour-id="controller-card"]',
    mobileSelector: '[data-tour-id="controller-gauge-metrics"]',
    mobileScrollSelector: '[data-tour-id="panel-pills"]',
    view: "list",
    gridAction: "list-mode-controller",
    scrollPolicy: "anchor-top",
    title: "컨트롤러 카드",
    body: "목록의 기본 단위입니다. 게이지에서 현재값·범위를 읽습니다.",
    mobileBody: "목록의 기본 단위입니다. 게이지에서 현재값·범위를 읽고, 탭하면 상세 시트가 열립니다.",
    extra: "anatomy",
  },
  {
    id: "list-graph",
    scope: "field",
    selector: '[data-tour-id="list-graph-panel"]',
    /** 모바일 툴바 시트 page0 — 채널 추이 영역. */
    mobileSelector:
      '[data-audit-region="controller-mobile-sheet-channel-trend"]',
    mobileScrollSelector:
      '[data-audit-region="controller-mobile-sheet-channel-trend"]',
    view: "list",
    gridAction: "list-mode-graph",
    scrollPolicy: "fit-between",
    mobileScrollPolicy: "fit-between",
    title: "목록 · 그래프",
    body: "그래프 모드(차트 아이콘)에서 카드 아래(또는 패널)에 추이가 펼쳐집니다.",
    mobileBody:
      "그래프 모드에서 하단 시트가 열리고, 채널 추이를 확인할 수 있습니다.",
    bullets: [
      "컨트롤러별 온도·습도·채널 추이",
      "기간은 패널·상단에서 변경",
    ],
    mobileBullets: [
      "상단 피커 — 컨트롤러 선택",
      "채널 A/B/C 추이",
      "컨트롤러·설정 탭으로 전환",
    ],
    extra: "pills",
  },
  {
    id: "list-settings",
    scope: "field",
    selector: '[data-tour-id="list-settings-panel"]',
    mobileSelector: '[data-tour-id="list-settings-panel"]',
    mobileScrollSelector: '[data-tour-id="list-settings-panel"]',
    view: "list",
    gridAction: "list-mode-settings",
    scrollPolicy: "fit-between",
    mobileScrollPolicy: "fit-between",
    title: "목록 · 설정",
    body: "설정 모드(톱니 아이콘)에서 알람·설정온도·환기 범위를 카드에서 조정합니다.",
    mobileBody:
      "설정 모드에서 하단 시트의 설정 탭에 알람·설정온도·환기 범위가 있습니다.",
    bullets: [
      "알람 상·하한, 설정온도·편차, 환기 범위",
      "투어는 여기까지 — 헤더 물음표로 다시 보기",
    ],
    mobileBullets: [
      "설정 탭 — 알람·온도·환기",
      "투어는 여기까지 — 헤더 물음표로 다시 보기",
    ],
  },

  // —— 차트 ——
  {
    id: "chart-overview",
    scope: "chart",
    selector: '[data-tour-id="farm-chart-view"]',
    view: "chart",
    scrollPolicy: "anchor-top",
    title: "차트",
    body: "농장 전체 추이를 한 화면에서 봅니다. 축사·컨트롤러 범위를 좁힐 수 있습니다.",
    bullets: [
      "통합 추이 — 온도·습도·채널 등",
      "왼쪽·상단 — 범위(축사·컨트롤러) 선택",
    ],
  },
  {
    id: "chart-layers",
    scope: "chart",
    selector: '[data-tour-id="unified-trend-layer-toolbar"]',
    view: "chart",
    scrollPolicy: "anchor-top",
    title: "표시 레이어",
    body: "보고 싶은 지표 레이어를 켜고 끕니다.",
    skipIfMissing: true,
    bullets: [
      "온도·습도·분포·채널 등 레이어 토글",
      "설정 가이드선은 설정 모드와 별개로 표시",
    ],
  },
  {
    id: "chart-period",
    scope: "chart",
    selector: '[data-tour-id="unified-trend-period-brush"]',
    view: "chart",
    scrollPolicy: "fit-between",
    title: "기간 · 구간",
    body: "기간 버튼으로 24시간→7일→30일을 순환하고, 브러시로 구간을 좁힙니다.",
    skipIfMissing: true,
    bullets: [
      "기간 버튼 — 한 번씩 눌러 순환",
      "평균 배지 — 선택한 구간의 평균",
      "브러시 — 드래그로 관심 구간",
    ],
  },
  {
    id: "chart-scope-handle",
    scope: "chart",
    selector: '[data-tour-id="farm-chart-scope-handle"]',
    view: "chart",
    scrollPolicy: "anchor-top",
    title: "범위 패널",
    body: "범위 손잡이로 축사·컨트롤러 선택 패널을 여닫습니다.",
    skipIfMissing: true,
    bullets: [
      "투어는 여기까지 — 헤더 물음표로 다시 보기",
    ],
  },

  // —— 델린 ——
  {
    id: "delin-stage",
    scope: "aria",
    selector: '[data-tour-id="farm-aria-view"]',
    view: "aria",
    scrollPolicy: "none",
    title: "델린",
    body: "음성이나 글으로 농장 상태를 물으면, 측정값 기준으로 답합니다.",
    bullets: [
      "가운데 오브 — 듣는 중·생각 중·말하는 중 표시",
      "답변 후 — 근거 수치·차트 연결을 확인할 수 있습니다",
    ],
  },
  {
    id: "delin-voice",
    scope: "aria",
    selector: '[data-tour-id="delin-voice-fab"]',
    view: "aria",
    scrollPolicy: "anchor-top",
    title: "말하기 · 입력",
    body: "아래 버튼으로 음성을 보내거나 글 질문을 엽니다.",
    skipIfMissing: true,
    bullets: [
      "길게 말하기 · 짧게 탭으로 입력 패널",
      "추천 문구 칩 — 자주 쓰는 질문",
      "투어는 여기까지 — 헤더 물음표로 다시 보기",
    ],
  },
];

export function getTourStepsForScope(scope: TourScope): TourStepDef[] {
  return TOUR_STEPS.filter((s) => s.scope === scope);
}
