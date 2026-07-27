/**
 * 스포트라이트 투어 — 스텝 선언(데이터 전용).
 * 서버 액션·클라이언트 엔진 양쪽에서 import 하므로 "use client"/"server-only" 금지.
 *
 * 1회차 루트 (위→아래 · 그리드 후 목록):
 *   헤더 → 농장 선택 → 커맨드바 → 축사 카드(개별) → 상세 헤더 → 상세 차트
 *   → 보기 탭(맵 유지) → 목록 커맨드바 → 컨트롤러 카드 → 그래프 패널 → 설정 패널
 *
 * 큰 컨테이너(map-grid·list-body)는 hole로 쓰지 않음 — 개별 카드/패널만 스포트라이트.
 * view-toggle은 map에서 collapse만 하고, 목록 전환은 list-command-bar에서 수행.
 * 모바일: mobileSelector·mobileBody·mobileScrollPolicy로 시트 UI에 맞춤.
 */

import {
  appendFarmKeyParams,
  type FarmKey,
} from "@/lib/data/farm-key";
import { buildFarmPath } from "@/lib/farm/farm-view-url";
import type { TourGridAction } from "@/lib/onboarding/tour-grid-actions";

export type { TourGridAction };

/** 투어 개편 시 +1 — 저장된 완료 버전보다 크면 재노출. */
export const TOUR_VERSION = 10;

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
/** 계정 메뉴 '기능 안내 다시 보기' → 런처 재시작 이벤트. */
export const FARM_TOUR_RESTART_EVENT = "farm-tour-restart";
/** 페이지 이동 후 재시작 — sessionStorage 플래그 키. */
export const FARM_TOUR_RESTART_FLAG = "farm-tour-restart";

export type TourView = "map" | "list";

export type TourStepDef = {
  id: string;
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
  extra?: "anatomy" | "pills" | "header-icons";
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
    selector: '[data-tour-id="app-header"]',
    view: "map",
    scrollPolicy: "none",
    title: "상단 헤더",
    body: "화면 공통 도구입니다.",
    bullets: [
      "로고 — 모니터링 홈",
      "레이아웃·테마 — PC/모바일 미리보기, 라이트/다크",
      "운영·일보·연결·알림·계정",
    ],
    mobileBullets: [
      "로고 — 모니터링 홈",
      "테마·알림·계정",
      "운영·일보·연결",
    ],
    extra: "header-icons",
  },
  {
    id: "farm-switcher",
    selector: '[data-tour-id="farm-switcher"]',
    view: "map",
    scrollPolicy: "none",
    title: "농장 선택",
    body: "모니터링할 농장을 바꿉니다. 관리자는 전체 농장 허브로도 이동할 수 있습니다.",
    skipIfMissing: true,
  },
  {
    id: "map-command-bar",
    selector: '[data-tour-id="farm-command-bar"]',
    view: "map",
    scrollPolicy: "anchor-top",
    title: "그리드 도구",
    body: "그리드 상단에서 일괄 설정과 히트맵 기간을 다룹니다.",
    mobileBody: "그리드 상단에서 일괄적용과 히트맵 기간을 다룹니다.",
    skipIfMissing: true,
    bullets: [
      "일괄적용 — 여러 축사 유형에 온도·알람을 한 번에",
      "기간(24시간·7일·30일) — 축사 카드 히트맵 구간",
    ],
  },
  {
    id: "map-barn-card",
    selector: '[data-tour-id="barn-card"]',
    accentSelector: '[data-tour-id="barn-drag"]',
    view: "map",
    scrollPolicy: "anchor-top",
    title: "축사 카드",
    body: "그리드의 기본 단위입니다. 대표 카드 하나를 기준으로 봅니다.",
    mobileBody: "목록형 그리드의 기본 단위입니다. 카드를 탭하면 확대 상세가 열립니다.",
    bullets: [
      "테두리 색 — 정상·주의·경고",
      "온도·습도 — 현재 측정값",
      "히트맵 — 채널×시간, 초록·주황·빨강",
      "손잡이(⠿) — 드래그로 배치, 자동 저장",
      "카드·히트맵 탭 — 확대 상세",
    ],
    mobileBullets: [
      "테두리 색 — 정상·주의·경고",
      "온도·습도 — 현재 측정값",
      "히트맵 — 채널×시간",
      "카드 탭 — 확대 상세",
    ],
  },
  {
    id: "detail-panel",
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
  },
  {
    id: "detail-charts",
    selector: '[data-tour-id="detail-panel-chart-first"]',
    mobileSelector: '[data-tour-id="detail-panel-charts"]',
    view: "map",
    scrollPolicy: "fit-between",
    title: "확대 상세 — 그래프",
    body: "컨트롤러 단위 추이입니다. 점선은 알람 상·하한입니다.",
    mobileBody: "컨트롤러별 추이 그래프입니다. 점선은 알람 상·하한입니다.",
    bullets: [
      "온도·습도·채널 그래프",
      "기간 토글 — 24시간·7일·30일",
    ],
  },
  {
    id: "view-toggle",
    selector: '[data-tour-id="view-toggle"]',
    /** 맵에 남긴 채 탭만 강조 — list 전환은 다음 스텝에서(동시 collapse+list 방지). */
    view: "map",
    gridAction: "collapse",
    scrollPolicy: "none",
    title: "그리드 · 목록",
    body: "목록으로 전환하면 컨트롤러 중심으로 조회·설정합니다.",
    bullets: [
      "그리드 — 배치·이상 징후",
      "목록 — 컨트롤러 상세·그래프·설정",
    ],
  },
  {
    id: "list-command-bar",
    selector: '[data-tour-id="farm-command-bar"]',
    view: "list",
    scrollPolicy: "anchor-top",
    title: "목록 도구",
    body: "목록 상단에서 일괄적용과 보기 모드를 고릅니다.",
    mobileBody:
      "목록 상단에서 보기 전환과(권한 있으면) 일괄적용을 다룹니다. 그래프·설정은 카드를 탭하면 하단 시트로 엽니다.",
    skipIfMissing: true,
    bullets: [
      "일괄적용 — 여러 컨트롤러에 설정 일괄 반영",
      "컨트롤러 / 그래프 / 설정 — 목록 전체 보기 모드",
    ],
    mobileBullets: [
      "일반·그룹 보기 전환",
      "일괄적용 — 권한 있을 때 상단 바",
      "카드 탭 — 그래프·설정 하단 시트",
    ],
  },
  {
    id: "list-controller",
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
    body: "그래프 모드에서 카드 아래(또는 패널)에 추이가 펼쳐집니다.",
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
  },
  {
    id: "list-settings",
    selector: '[data-tour-id="list-settings-panel"]',
    mobileSelector: '[data-tour-id="list-settings-panel"]',
    mobileScrollSelector: '[data-tour-id="list-settings-panel"]',
    view: "list",
    gridAction: "list-mode-settings",
    scrollPolicy: "fit-between",
    mobileScrollPolicy: "fit-between",
    title: "목록 · 설정",
    body: "설정 모드에서 알람·설정온도·환기 범위를 카드에서 조정합니다.",
    mobileBody:
      "설정 모드에서 하단 시트의 설정 탭에 알람·설정온도·환기 범위가 있습니다.",
    bullets: [
      "알람 상·하한, 설정온도·편차, 환기 범위",
      "투어는 여기까지 — 계정 메뉴 → 「기능 안내 다시 보기」",
    ],
    mobileBullets: [
      "설정 탭 — 알람·온도·환기",
      "투어는 여기까지 — 계정 메뉴 → 「기능 안내 다시 보기」",
    ],
  },
];
