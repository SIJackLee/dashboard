import type { Band } from "@/lib/farm/severity-score";

/**
 * 추이 차트 데이터 계약(순수 타입). 렌더링(`components/trends/trend-chart.tsx`)과
 * 시리즈 빌더(`lib/farm/*`)가 공유한다. lib→components 역의존을 없애기 위해 이 모듈에 둔다.
 * (컴포넌트는 하위 호환을 위해 이 타입들을 re-export)
 */

export type TrendAxis = "left" | "right";

export type TrendSeries = {
  name: string;
  data: (number | null)[];
  /** Hex color for line/bar/legend. */
  color: string;
  axis?: TrendAxis;
  /**
   * 알람/환기 한계 — 점선 + 주의·경고 마커.
   */
  band?: Band | null;
  /** line 모드 stroke-dasharray (예: "5 3"). 없으면 실선. */
  strokeDasharray?: string;
  /**
   * 호버 보조값(정규화 n 옆 원단위 등). data와 동일 길이.
   */
  hoverSecondary?: (number | null)[];
  hoverSecondaryUnit?: string;
  /** 호버 카드 알람 트랙용 (원단위 lo–hi). 차트 Y와 무관. */
  hoverAlarmBand?: { lo: number; hi: number; unit: string };
  /** 산포 상·하단 기여자 (임계 초과 시 tip 표시). */
  hoverSpreadExtremes?: TrendSpreadExtremes;
};

/** 산포 min/max를 만든 구역·장비 (호버 카드용). */
export type TrendSpreadContributor = {
  zoneLabel: string;
  equipmentLabel: string;
  value: number;
  /** 해당 시점 임계 상한/하한 접촉·초과 */
  breached?: boolean;
  /** 스코프 이동용 — tip 문구에 노출하지 않음 */
  stallTyCode?: string;
  stallNo?: string;
  controllerKey?: string;
};

/** 한계 이탈 tip → 컨트롤러 차트 이동 대상 */
export type TrendBreachNavTarget = {
  stallTyCode: string;
  stallNo: string;
  controllerKey: string;
  zoneLabel: string;
  equipmentLabel: string;
};

export type TrendSpreadExtremes = {
  high: (TrendSpreadContributor | null)[];
  low: (TrendSpreadContributor | null)[];
};

/** 임계 코리도 — 인덱스 공간(소수 허용) 폴리라인 점 */
export type TrendEnvelopePolyPoint = {
  x: number;
  high: number;
  low: number;
};

/** 두 곡선 사이 면(이목 클라우드·온도 범위 등). */
export type TrendEnvelope = {
  high: (number | null)[];
  low: (number | null)[];
  axis?: TrendAxis;
  fill: string;
  fillOpacity?: number;
  /** 범례 라벨 (없으면 숨김). */
  legendLabel?: string;
  /** 산포 상·하단 기여자 (인덱스 정렬). */
  hoverExtremes?: TrendSpreadExtremes;
  /**
   * 임계 코리도 등 — 교차 보간 포함 연속 면.
   * 있으면 high/low 샘플 배열 대신 이 경로로 채움.
   */
  polys?: TrendEnvelopePolyPoint[][];
};

/** MACD형 편차 막대 / 거래량형 바 — baseline↔value. */
export type TrendHistogram = {
  /** chart domain Y (막대 끝) */
  values: (number | null)[];
  /** chart domain Y (0선 또는 밴드 바닥) */
  baseline: number;
  colorUp: string;
  colorDown: string;
  /**
   * macd: +/− 양방향(기본).
   * volume: 바닥→값, colorUp만 (거래량).
   * overlay: 주패널 위에 얹는 macd(낮은 불투명도).
   */
  style?: "macd" | "volume" | "overlay";
  /** volume 그룹 내 슬롯 (0..groupSize-1) */
  groupIndex?: number;
  groupSize?: number;
  fillOpacity?: number;
  /** 인덱스별 불투명도(있으면 fillOpacity보다 우선) */
  fillOpacityValues?: (number | null)[];
  legendLabel?: string;
  /** 호버 원단위 (예: 편차 ℃ · 모터 %) */
  hoverSecondary?: (number | null)[];
  hoverSecondaryUnit?: string;
  /** midpointDelta: "중점 ±n.n℃" */
  hoverFormat?: "signed" | "percent" | "midpointDelta";
  /** 모터 max 등 — 호버 카드 채널 매트릭스 (레이어에 없어도 tip에 표시) */
  hoverChannels?: {
    label: string;
    color: string;
    values: (number | null)[];
  }[];
};

export type TrendReferenceLine = {
  value: number;
  axis?: TrendAxis;
  color: string;
  label?: string;
  /** true면 끝단 숫자 라벨 숨김(구분선 전용). */
  hideLabel?: boolean;
};

/** 스케일 상하한 라벨 — split Y 등에서 원단위 표기. */
export type TrendScaleEdgeLabel = {
  id: string;
  /** 차트 domain Y */
  value: number;
  axis?: TrendAxis;
  /**
   * left/right = 축 거터 · center = 설정 수치(플롯 중앙)
   * plotStart = (레거시) 설정 명칭 단독 — prefer leadingText
   */
  side?: "left" | "right" | "center" | "plotStart";
  text: string;
  /** center 수치 칩 왼쪽에 붙는 명칭 (설정온도·온도편차 등) */
  leadingText?: string;
  color: string;
  title?: string;
  mark?: "overline" | "underline";
  /** 해당 Y에 점선 가이드 */
  showLine?: boolean;
  /** true면 세로 드래그로 value 조절 (알람 상·하한 등) */
  draggable?: boolean;
  /** 우클릭 숫자 입력용 원단위 값 (없으면 text에서 파싱) */
  editValue?: number;
  /** 가이드 선 굵기 (viewBox strokeWidth). 기본 0.45 */
  lineStrokeWidth?: number;
  /** 미지정=점선, "" 또는 "solid"=실선 */
  lineDasharray?: string;
  /**
   * 우측 라벨 레인 — outer=알람(바깥), inner=제어값(그래프에 가까운 쪽).
   * side=center|plotStart 일 때는 무시.
   */
  labelLane?: "outer" | "inner";
  /** true면 라벨 우측에 적용·되돌리기 아이콘 버튼 */
  showApplyActions?: boolean;
  /** true면 가이드 선만 그리고 박스·수치 라벨은 숨김 (보기 모드 알람 경계 등) */
  hideLabel?: boolean;
};

export type ScaleEdgeDragEvent = {
  id: string;
  /** 차트 domain Y (guide.value와 동일 공간) */
  value: number;
  phase: "start" | "move" | "end" | "cancel";
};

export type ScaleEdgeNumericCommitEvent = {
  id: string;
  /** 사용자가 입력한 원단위 숫자 (℃ 또는 %) */
  value: number;
};
