/**
 * 스포트라이트 투어 — 스텝 선언(데이터 전용).
 * 서버 액션·클라이언트 엔진 양쪽에서 import 하므로 "use client"/"server-only" 금지.
 */

import {
  appendFarmKeyParams,
  type FarmKey,
} from "@/lib/data/farm-key";
import { buildFarmPath } from "@/lib/farm/farm-view-url";

/** 투어 개편 시 +1 — 저장된 완료 버전보다 크면 재노출. */
export const TOUR_VERSION = 1;

/** 자동 시작 전 DOM 준비 확인 — 첫 축사 카드. */
export const TOUR_READY_SELECTOR = '[data-tour-id="barn-card"]';

/** 단일 농장 스코프 URL — admin 허브에서 투어 재시작 시 사용. */
export function buildFarmTourPath(farmKey: FarmKey): string {
  return buildFarmPath(appendFarmKeyParams(new URLSearchParams(), farmKey));
}

/** 그리드(FarmMapCanvas)에 보내는 투어 액션 이벤트. */
export const FARM_TOUR_ACTION_EVENT = "farm-tour-action";
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
  /** 보조 강조(펄스 링) 대상 — 예: 드래그 손잡이. */
  accentSelector?: string;
  /** 스텝 진입 시 필요한 뷰. */
  view: TourView;
  title: string;
  body: string;
  /** 스텝 진입 시 그리드에 보낼 액션(확대 상세 열기/닫기). */
  gridAction?: "expand-first" | "collapse";
  /** 툴팁 하단 확장 콘텐츠. */
  extra?: "anatomy" | "pills";
  /** 대상이 없으면(Admin 전국 KPI 등) 즉시 건너뜀. */
  skipIfMissing?: boolean;
  /** 모바일 스크롤 — 긴 패널은 상단 고정, 작은 요소는 툴팁 위 fit. */
  scrollAlign?: "anchor-top" | "fit-between";
  /** 모바일 스크롤 정책 — scrollAlign보다 우선. */
  scrollPolicy?: "none" | "fit-between" | "anchor-top" | "anchor-card-top";
};

export const TOUR_STEPS: TourStepDef[] = [
  {
    id: "view-toggle",
    selector: '[data-tour-id="view-toggle"]',
    view: "map",
    scrollPolicy: "none",
    title: "그리드 · 목록 전환",
    body:
      "농장을 보는 두 가지 방식입니다. 그리드는 축사 배치와 이상 징후를 한눈에, 목록은 컨트롤러별 상세 값과 설정을 보여줍니다.",
  },
  {
    id: "period-select",
    selector: '[data-tour-id="period-select"]',
    view: "map",
    scrollPolicy: "anchor-top",
    title: "기간 선택",
    body:
      "히트맵이 보여줄 기간을 고릅니다. 24시간·7일·30일 중 선택하면 모든 축사 카드의 그래프가 함께 바뀝니다.",
  },
  {
    id: "barn-card",
    selector: '[data-tour-id="barn-card"]',
    accentSelector: '[data-tour-id="barn-drag"]',
    view: "map",
    scrollPolicy: "anchor-top",
    title: "축사 카드",
    body:
      "축사 하나의 현재 온도·습도와 상태(테두리 색)를 보여줍니다. 카드 왼쪽 위 손잡이(⠿)를 끌면 카드를 원하는 위치로 옮길 수 있고, 배치는 자동 저장됩니다.",
  },
  {
    id: "heatmap",
    selector: '[data-tour-id="heatmap"]',
    view: "map",
    title: "심각도 히트맵",
    body:
      "세로는 온도·습도·A·B·C 채널, 가로는 시간입니다. 초록은 정상, 주황은 주의, 빨강은 경고 — 색이 진한 구간을 클릭하면 상세 그래프가 열립니다.",
  },
  {
    id: "detail-panel",
    selector: '[data-tour-id="detail-panel"]',
    mobileSelector: '[data-tour-id="detail-panel-charts"]',
    view: "map",
    gridAction: "expand-first",
    scrollPolicy: "fit-between",
    title: "확대 상세 — 컨트롤러별 그래프",
    body:
      "선택한 지표를 컨트롤러별 작은 그래프로 나란히 보여줍니다. 그래프의 점선은 알람 상한·하한이며, 선이 점선을 벗어나면 주의·경고 색으로 표시됩니다. 컨트롤러를 클릭하면 아래에 해당 컨트롤러 카드가 열립니다.",
  },
  {
    id: "bulk-apply",
    selector: '[data-tour-id="bulk-apply"]',
    view: "map",
    gridAction: "collapse",
    scrollPolicy: "anchor-top",
    title: "일괄적용",
    body:
      "여러 축사 유형을 선택해 설정온도·알람 범위를 한 번에 적용합니다. 토글을 켜면 카드가 선택 모드로 바뀝니다.",
  },
  {
    id: "controller-row",
    selector: "[data-controller-card-key]",
    mobileSelector: '[data-tour-id="controller-card"]',
    view: "list",
    scrollPolicy: "fit-between",
    title: "컨트롤러 카드 — 게이지 읽는 법",
    body:
      "목록 뷰의 기본 단위입니다. 게이지 바에서 현재값과 허용범위·설정값을 함께 읽을 수 있습니다.",
    extra: "anatomy",
  },
  {
    id: "panel-pills",
    selector: "[data-controller-card-key]",
    mobileSelector: '[data-tour-id="panel-pills"]',
    accentSelector: '[data-tour-id="panel-pills"]',
    view: "list",
    scrollPolicy: "none",
    title: "그래프 · 설정 · 모터 패널",
    body:
      "카드 오른쪽 버튼으로 상세 패널을 펼칩니다. 각 버튼의 역할은 아래와 같습니다.",
    extra: "pills",
  },
  {
    id: "header-stats",
    selector: '[data-tour-id="header-stats"]',
    view: "list",
    skipIfMissing: true,
    title: "상단 현황 배지",
    body:
      "농장·컨트롤러 수와 오프라인·알람 건수를 항상 보여줍니다. 숫자가 붉게 표시되면 즉시 확인이 필요한 상태입니다. 투어는 여기까지입니다 — 계정 메뉴에서 언제든 다시 볼 수 있습니다.",
  },
];
