/**
 * 스포트라이트 투어 — 스텝 선언(데이터 전용).
 * 서버 액션·클라이언트 엔진 양쪽에서 import 하므로 "use client"/"server-only" 금지.
 *
 * 1회차 루트 (컴포넌트 단위 · 위→아래):
 *   A1 헤더 → A2 보기 툴바 → A3 축사 카드(+히트맵 bullet)
 *   → C1 컨트롤러 카드 → C2 카드 액션
 * 상세·일괄적용(B)은 1회차에서 제외.
 *
 * 모바일 scrollPolicy (md 미만):
 * | 정책            | 용도                                      | 스텝   |
 * |-----------------|-------------------------------------------|--------|
 * | none            | 스크롤 없음 (헤더·짧은 UI)                | A1,A2  |
 * | anchor-top      | 타깃 상단을 헤더 clearance에 고정         | A3,C1,C2|
 * | fit-between     | (레거시) 상세 패널 등 — 1회차 미사용      | —      |
 * | anchor-card-top | (레거시) 카드 상단 anchor — 미사용        | —      |
 */

import {
  appendFarmKeyParams,
  type FarmKey,
} from "@/lib/data/farm-key";
import { buildFarmPath } from "@/lib/farm/farm-view-url";
import type { TourGridAction } from "@/lib/onboarding/tour-grid-actions";

export type { TourGridAction };

/** 투어 개편 시 +1 — 저장된 완료 버전보다 크면 재노출. */
export const TOUR_VERSION = 6;

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
/** 그리드 expand/collapse 레이아웃 안착 완료. */
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
  /** 컴포넌트 내부 안내 — hole은 유지하고 툴팁에서만 나열. */
  bullets?: string[];
  /** 스텝 진입 시 그리드에 보낼 액션(확대 상세 열기/닫기). 1회차 미사용. */
  gridAction?: TourGridAction;
  /** 툴팁 하단 확장 콘텐츠. */
  extra?: "anatomy" | "pills" | "header-icons";
  /** 대상이 없으면(Admin 전국 KPI 등) 즉시 건너뜀. */
  skipIfMissing?: boolean;
  /** 모바일 스크롤 정책. */
  scrollPolicy?: "none" | "fit-between" | "anchor-top" | "anchor-card-top";
};

export const TOUR_STEPS: TourStepDef[] = [
  {
    id: "header-actions",
    selector: '[data-tour-id="header-actions"]',
    view: "map",
    scrollPolicy: "none",
    title: "상단 헤더",
    body: "화면 공통 도구입니다. 오른쪽 아이콘으로 테마·연결·알림·계정에 접근합니다.",
    extra: "header-icons",
  },
  {
    id: "view-toggle",
    selector: '[data-tour-id="view-toggle"]',
    view: "map",
    scrollPolicy: "none",
    title: "그리드 · 목록",
    body: "농장을 보는 두 가지 방식입니다.",
    bullets: [
      "그리드 — 축사 배치와 이상 징후를 한눈에",
      "목록 — 컨트롤러별 상세 값과 설정",
      "기간(24시간·7일·30일) — 그리드에서 히트맵 기간을 바꿉니다",
    ],
  },
  {
    id: "barn-card",
    selector: '[data-tour-id="barn-card"]',
    accentSelector: '[data-tour-id="barn-drag"]',
    view: "map",
    scrollPolicy: "anchor-top",
    title: "축사 카드",
    body: "축사 하나의 요약입니다. 카드 안의 요소를 함께 보세요.",
    bullets: [
      "테두리 색 — 정상·주의·경고 상태",
      "현재 온도·습도 — 지금 측정값",
      "왼쪽 위 손잡이(⠿) — 드래그로 배치, 자동 저장",
      "히트맵 — 세로=채널, 가로=시간 / 초록·주황·빨강",
      "히트맵·카드 탭 — 확대 상세 그래프",
    ],
  },
  {
    id: "controller-row",
    selector: "[data-controller-card-key]",
    mobileSelector: '[data-tour-id="controller-gauge-metrics"]',
    mobileScrollSelector: '[data-tour-id="panel-pills"]',
    view: "list",
    scrollPolicy: "anchor-top",
    title: "컨트롤러 카드",
    body: "목록 뷰의 기본 단위입니다. 게이지에서 현재값·허용범위·설정값을 함께 읽습니다.",
    extra: "anatomy",
  },
  {
    id: "panel-pills",
    selector: "[data-controller-card-key]",
    mobileSelector: '[data-tour-id="panel-pills"]',
    accentSelector: '[data-tour-id="panel-pills"]',
    view: "list",
    scrollPolicy: "anchor-top",
    title: "그래프 · 설정",
    body: "카드 오른쪽 버튼으로 상세를 엽니다. PC에서는 카드 아래 패널이 펼쳐집니다.",
    extra: "pills",
    bullets: [
      "투어는 여기까지입니다. 계정 메뉴 → 「기능 안내 다시 보기」로 언제든 다시 볼 수 있습니다.",
    ],
  },
];
