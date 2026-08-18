/**
 * 스포트라이트 투어 — 스텝 선언(데이터 전용).
 * 서버 액션·클라이언트 엔진 양쪽에서 import 하므로 "use client"/"server-only" 금지.
 *
 * 스코프:
 *   field(현장) — 병합 UI(좌 현황·우 목록) PC 1차 루트
 *   chart(차트) — 통합 추이 · 레이어 · 설정모드 · 구간/양호도
 *   DELIN 뱃지는 현장·차트 투어에 포함 (전용 탭 없음)
 *
 * 큰 컨테이너는 hole로 쓰지 않음 — 개별 카드/툴바만 스포트라이트.
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
export const TOUR_VERSION = 27;

export type TourScrollPolicy =
  | "none"
  | "fit-between"
  | "anchor-top"
  | "anchor-card-top";

/** 자동 시작 전 DOM 준비 — 보기 탭. */
export const TOUR_READY_VIEW_TOGGLE_SELECTOR = '[data-tour-id="view-toggle"]';
/** 현장 병합 — 좌측 현황. */
export const TOUR_READY_FIELD_STATUS_SELECTOR =
  '[data-tour-id="field-status-grid"]';
/** 현장 모바일 — 맵 카드 그리드. */
export const TOUR_READY_MAP_GRID_SELECTOR = '[data-tour-id="map-grid"]';
/** 현장 — 컨트롤러 카드(우측 목록). */
export const TOUR_READY_CONTROLLER_SELECTOR =
  '[data-tour-id="controller-card"]';
/** @deprecated 레거시 그리드 — 히트맵 있을 때만 보조 ready */
export const TOUR_READY_SELECTOR = '[data-tour-id="barn-card"]';
export const TOUR_READY_HEATMAP_SELECTOR = '[data-tour-id="heatmap"]';
export const TOUR_READY_MIN_CARDS = 1;
export const TOUR_READY_CHART_SELECTOR = '[data-tour-id="farm-chart-view"]';

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

/** 현장(그리드·목록) · 차트 */
export type TourScope = "field" | "chart";

/** 스텝 진입 시 전환할 허브 탭. */
export type TourView = FarmHubView;

export function tourScopeFromHubView(view: FarmHubView): TourScope {
  if (view === "chart") return "chart";
  return "field";
}

export function parseTourScope(raw: string | null | undefined): TourScope {
  if (raw === "chart") return "chart";
  return "field";
}

export type TourStepDef = {
  id: string;
  /** 현장 / 차트 */
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
  /** 모바일(compact) 전용 그리드/시트 액션 — 있으면 PC gridAction 대신 사용. */
  mobileGridAction?: TourGridAction;
  /** 모바일 전용 제목(하단 독·시트 UI). */
  mobileTitle?: string;
  /** 툴팁 하단 확장 콘텐츠. */
  extra?: "anatomy" | "pills" | "header-icons" | "list-mode-icons";
  /** 모바일에서 확장 가이드 숨김(좁은 안내 카드). */
  mobileHideExtra?: boolean;
  /** 대상이 없으면 즉시 건너뜀. */
  skipIfMissing?: boolean;
  /** 데스크톱·공통 스크롤 정책. */
  scrollPolicy?: TourScrollPolicy;
  /** 모바일 스크롤 정책(시트 내부 정렬 등). */
  mobileScrollPolicy?: TourScrollPolicy;
};

export const TOUR_STEPS: TourStepDef[] = [
  // —— 현장 (PC 스플릿 · 모바일 맵+시트) ——
  {
    id: "f-header",
    scope: "field",
    selector: '[data-tour-id="header-actions"]',
    view: "map",
    scrollPolicy: "none",
    title: "상단 도구",
    body: "오른쪽 상단에 이상상황·리포트·테마·미리보기·물음표·계정이 있습니다.",
    mobileTitle: "상단 도구",
    mobileBody: "화면 오른쪽 위에 이상상황·리포트·테마·물음표·계정이 있습니다.",
    bullets: [
      "이상상황 · 오늘의 리포트 · (관리자) 운영",
      "라이트/다크 · PC/모바일 미리보기",
      "물음표 — 지금 보는 탭의 기능 안내",
      "계정 — 농장 선택·최근 활동",
    ],
    mobileBullets: [
      "이상상황 · 리포트 · 테마",
      "물음표 — 이 화면 기능 안내",
      "계정 — 농장·최근 활동",
    ],
    extra: "header-icons",
    mobileHideExtra: true,
  },
  {
    id: "f-tabs",
    scope: "field",
    selector: '[data-tour-id="view-toggle"]',
    view: "map",
    scrollPolicy: "none",
    mobileScrollPolicy: "none",
    title: "보기 탭",
    body: "현장·차트·모델을 바꿉니다. 물음표는 지금 켠 탭 안내만 엽니다.",
    mobileTitle: "하단 보기 탭",
    mobileBody: "화면 아래에서 현장·차트·모델을 바꿉니다. 물음표는 지금 켠 탭만 안내합니다.",
    bullets: [
      "현장 — 현황과 컨트롤러",
      "차트 — 농장 통합 추이",
      "모델 — 축사 3D",
    ],
    mobileBullets: [
      "현장 — 축사 카드와 컨트롤러 시트",
      "차트 — 농장 통합 추이",
      "모델 — 축사 3D",
    ],
  },
  {
    id: "f-status",
    scope: "field",
    selector: '[data-tour-id="field-status-grid"]',
    mobileSelector: '[data-tour-id="map-grid"]',
    view: "map",
    scrollPolicy: "anchor-top",
    mobileScrollPolicy: "anchor-top",
    title: "좌측 현황",
    body: "축사별 상태와 온도·습도를 한눈에 봅니다.",
    mobileTitle: "축사 현황",
    mobileBody: "축사 카드에서 상태와 온도·습도를 한눈에 봅니다.",
    bullets: [
      "테두리·면 색 — 정상·주의·경고",
      "온도계·물방울 — 현재 온도·습도",
      "접기 아이콘 — 현황 열을 좁은 레일로",
      "전체보기 — 오른쪽 목록을 전체 축사로",
    ],
    mobileBullets: [
      "테두리·면 색 — 정상·주의·경고",
      "온도·습도 숫자 — 현재 측정값",
      "카드를 누르면 컨트롤러 시트가 열립니다",
    ],
    skipIfMissing: true,
  },
  {
    id: "f-status-card",
    scope: "field",
    selector:
      '[data-tour-id="field-status-grid"] [data-tour-id="barn-card"]',
    mobileSelector: '[data-tour-id="map-grid"] [data-tour-id="barn-card"]',
    view: "map",
    scrollPolicy: "anchor-top",
    mobileScrollPolicy: "anchor-card-top",
    title: "축사 고르기",
    body: "현황 카드를 누르면 오른쪽 목록이 그 축사 컨트롤러만 보여 줍니다.",
    mobileTitle: "축사 카드",
    mobileBody: "축사 카드를 누르면 아래에서 컨트롤러 시트가 올라옵니다.",
    bullets: [
      "같은 카드 다시 탭 — 필터 해제",
      "전체보기 — 모든 축사로 복귀",
    ],
    mobileBullets: [
      "탭 — 해당 축사 컨트롤러 시트",
      "시트를 닫으면 목록으로 돌아갑니다",
    ],
    skipIfMissing: true,
  },
  {
    id: "f-toolbar",
    scope: "field",
    selector: '[data-tour-id="farm-command-bar"]',
    mobileSelector: '[data-tour-id="bulk-apply"]',
    view: "map",
    scrollPolicy: "anchor-top",
    mobileScrollPolicy: "anchor-top",
    title: "목록 도구",
    body: "오른쪽 목록 상단에서 일괄적용과 보기 모드를 고릅니다.",
    mobileTitle: "일괄적용",
    mobileBody: "권한이 있으면 목록 위에서 여러 컨트롤러에 설정을 한꺼번에 반영할 수 있습니다.",
    bullets: [
      "일괄적용 — 권한이 있을 때 여러 컨트롤러에 설정 반영",
      "그룹별 보기 — 축사 유형별 묶음 / 평면 목록",
      "컨트롤러 · 그래프 · 설정 — 아이콘으로 목록 모드 전환",
    ],
    mobileBullets: [
      "일괄적용 — 여러 축사유형에 설정 반영",
      "권한이 없으면 이 단계는 건너뜁니다",
    ],
    extra: "list-mode-icons",
    mobileHideExtra: true,
    skipIfMissing: true,
  },
  {
    id: "f-controller",
    scope: "field",
    selector: '[data-tour-id="controller-card"]',
    mobileSelector: '[data-tour-id="controller-gauge-metrics"]',
    view: "map",
    mobileGridAction: "field-mobile-sheet-controller",
    scrollPolicy: "anchor-top",
    mobileScrollPolicy: "fit-between",
    title: "컨트롤러 카드",
    body: "목록의 기본 단위입니다. 게이지에서 현재값과 허용 범위를 읽습니다.",
    mobileTitle: "컨트롤러 시트",
    mobileBody: "시트에서 온도·습도 게이지와 채널 출력을 확인합니다.",
    bullets: [
      "온도·습도 게이지 — 현재값과 알람·설정 구간",
      "채널 A·B·C — 출력 비율",
      "카드 우측 아이콘 — 컨트롤러 → 그래프 → 설정 순환(다시 누르면 접기)",
    ],
    mobileBullets: [
      "온도·습도 게이지 — 현재값과 허용 범위",
      "채널 A·B·C — 출력 비율",
      "아래로 스크롤하면 추이, 설정 탭에서 설정을 엽니다",
    ],
    extra: "anatomy",
    mobileHideExtra: true,
    skipIfMissing: true,
  },
  {
    id: "f-graph",
    scope: "field",
    selector: '[data-tour-id="list-graph-panel"]',
    mobileSelector:
      '[data-audit-region="controller-mobile-sheet-channel-trend"]',
    mobileScrollSelector:
      '[data-audit-region="controller-mobile-sheet-channel-trend"]',
    view: "map",
    gridAction: "list-mode-graph",
    mobileGridAction: "field-mobile-sheet-graph",
    scrollPolicy: "fit-between",
    mobileScrollPolicy: "fit-between",
    title: "그래프 모드",
    body: "상단 그래프 아이콘을 켜면 카드 아래에 추이가 펼쳐집니다.",
    mobileTitle: "추이",
    mobileBody: "시트 아래쪽 추이에서 온도·습도·채널 변화를 봅니다.",
    bullets: [
      "온도·습도·채널 추이",
      "기간은 패널에서 24시간→7일→30일 순환",
    ],
    mobileBullets: [
      "컨트롤러 시트와 같은 화면 하단",
      "기간 버튼 — 24시간 → 7일 → 30일",
    ],
    extra: "pills",
    mobileHideExtra: true,
    skipIfMissing: true,
  },
  {
    id: "f-settings",
    scope: "field",
    selector: '[data-tour-id="list-settings-tour-target"]',
    mobileSelector: '[data-tour-id="controller-mobile-sheet-panel"]',
    mobileScrollSelector:
      '[data-audit-region="controller-mobile-sheet-settings"]',
    accentSelector: '[data-tour-id="list-mode-settings"]',
    view: "map",
    gridAction: "list-mode-settings",
    mobileGridAction: "field-mobile-sheet-settings",
    scrollPolicy: "anchor-top",
    mobileScrollPolicy: "fit-between",
    title: "설정 모드",
    body: "상단 설정(톱니) 아이콘을 켜면 알람·설정온도·환기 범위를 조정합니다.",
    mobileTitle: "설정",
    mobileBody: "시트 상단의 설정 탭에서 알람·설정온도·환기 범위를 조정합니다.",
    bullets: [
      "알람 상·하한, 설정온도·편차, 환기 범위",
      "값을 바꾼 뒤 적용은 화면의 적용 버튼으로",
    ],
    mobileBullets: [
      "알람 상·하한 · 설정온도·편차 · 환기 범위",
      "변경 후 적용 버튼으로 반영합니다",
    ],
    skipIfMissing: true,
  },
  {
    id: "f-delin",
    scope: "field",
    selector: '[data-tour-id="delin-env-badge"]',
    view: "map",
    scrollPolicy: "none",
    skipIfMissing: true,
    title: "DELIN",
    body: "보고 있는 축사유형의 권장 온·습도를 알려 줍니다.",
    bullets: [
      "우측 하단 뱃지 · 말풍선",
      "현장·차트·모델에서 동일합니다",
    ],
  },
  {
    id: "f-end",
    scope: "field",
    selector: '[data-tour-id="header-feature-tour"]',
    view: "map",
    mobileGridAction: "field-mobile-sheet-close",
    scrollPolicy: "none",
    title: "다시 보기",
    body: "기능 안내는 헤더 물음표로 언제든 다시 열 수 있습니다.",
    mobileBody: "안내가 끝나면 위쪽 물음표로 언제든 다시 볼 수 있습니다.",
    bullets: [
      "차트 안내는 차트 탭에서 물음표를 누르세요",
      "DELIN은 우측 하단 뱃지입니다",
      "현장 안내는 여기까지입니다",
    ],
    mobileBullets: [
      "차트는 해당 탭에서 물음표를 누르세요",
      "DELIN은 우측 하단 뱃지입니다",
      "현장 안내는 여기까지입니다",
    ],
  },

  // —— 차트 ——
  {
    id: "c-overview",
    scope: "chart",
    selector: '[data-tour-id="farm-chart-unified-trend"]',
    view: "chart",
    scrollPolicy: "anchor-top",
    title: "통합 추이",
    body: "농장 전체의 온도·습도·모터 추이를 한 화면에서 봅니다.",
    bullets: [
      "오른쪽 집계 범위에서 축사·컨트롤러로 좁힐 수 있습니다",
      "아래 구간 바로 기간과 관심 구간을 고릅니다",
    ],
  },
  {
    id: "c-layers",
    scope: "chart",
    selector: '[data-tour-id="unified-trend-layer-toolbar"]',
    view: "chart",
    scrollPolicy: "anchor-top",
    title: "표시 레이어",
    body: "온도·습도·모터 아이콘으로 보고 싶은 지표를 켭니다.",
    skipIfMissing: true,
    bullets: [
      "클릭할 때마다 기본보기(본선·산포) → 끔 순으로 바뀝니다",
      "지표를 하나만 켜면 축 눈금이 해당 단위로 맞춰집니다",
    ],
  },
  {
    id: "c-control",
    scope: "chart",
    selector:
      '[data-tour-id="chart-control-plot"][data-chart-mode="control"]',
    accentSelector: '[data-tour-id="chart-control-mode"]',
    view: "chart",
    gridAction: "chart-enter-control",
    scrollPolicy: "fit-between",
    title: "설정모드",
    body: "톱니 설정모드를 켜면 차트에서 알람·설정온도·환기 가이드를 조정합니다.",
    skipIfMissing: true,
    bullets: [
      "설정모드에서만 알람·제어 가이드선을 드래그해 값을 바꿉니다",
      "선·칩의 적용으로 반영합니다(권한이 있을 때)",
      "종료는 설정모드 버튼을 다시 누르거나 빈 플롯을 우클릭합니다",
    ],
  },
  {
    id: "c-brush",
    scope: "chart",
    selector: '[data-tour-id="unified-trend-period-brush"]',
    view: "chart",
    gridAction: "chart-exit-control",
    scrollPolicy: "fit-between",
    title: "기간 · 구간 · 양호도",
    body: "아래 30일 바에서 드래그하면 그 구간이 차트에 그대로 열립니다. 탭은 지금 폭을 유지한 채 위치를 옮기고, 우클릭하면 30일 전체로 돌아갑니다. 옅은 점선은 양호도 75점 기준입니다.",
    skipIfMissing: true,
    bullets: [
      "드래그 — 보고 싶은 구간을 직접 고름 (24/7/30으로 접지 않음)",
      "탭 — 같은 폭으로 위치만 이동",
      "우클릭 — 30일 전체",
      "옅은 점선 — 양호도 75점 기준. 숫자는 호버 카드",
    ],
  },
  {
    id: "c-delin",
    scope: "chart",
    selector: '[data-tour-id="delin-env-badge"]',
    view: "chart",
    scrollPolicy: "none",
    skipIfMissing: true,
    title: "DELIN",
    body: "지금 집계 중인 축사유형의 권장 온·습도를 알려 줍니다.",
    bullets: [
      "우측 하단 뱃지 · 말풍선",
      "유형을 바꾸면 권장도 따라갑니다",
    ],
  },
];

export function getTourStepsForScope(scope: TourScope): TourStepDef[] {
  return TOUR_STEPS.filter((s) => s.scope === scope);
}
