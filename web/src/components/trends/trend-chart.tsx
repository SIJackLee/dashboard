"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  useRef,
  useLayoutEffect,
  useId,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Check, GripHorizontal, RotateCcw, X } from "lucide-react";
import {
  ControllerNoMark,
  StallUnitNoMark,
} from "@/components/farm/controller-no-marks";
import { cn } from "@/lib/utils";
import type { TrendPeriodId } from "@/lib/data/farm-trend-types";
import {
  buildTrendAxisMarks,
  formatTrendAxisTickParts,
  parseCategoryTimelineMs,
  trendChartTickTargetForWidth,
} from "@/lib/farm/trend-display-buckets";
import {
  type Band,
  SEV_COLOR,
  sevOfScore,
  severityScore,
} from "@/lib/farm/severity-score";
import type { UplinkCoverageBand } from "@/lib/farm/trend-uplink-coverage";
import { motionClass } from "@/lib/ui/motion-classes";
import { motionStaggerStepMs } from "@/lib/ui/motion-tokens";
import {
  useClipPresence,
  type ClipPhase,
} from "@/lib/ui/use-clip-presence";

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

type TrendChartProps = {
  mode: "line" | "bar";
  categories: string[];
  series: TrendSeries[];
  height?: number;
  leftUnit?: string;
  rightUnit?: string;
  /** Force axis domains; otherwise auto-fit with padding. */
  leftDomain?: [number, number];
  rightDomain?: [number, number];
  /**
   * 좌측 원단위 Y 눈금.
   * full=5단(기본) · ends=상·하한만 (현장 카드 미니차트)
   */
  yAxisTicks?: "full" | "ends";
  referenceLines?: TrendReferenceLine[];
  /** 우측/좌측 스케일 상하한(원단위 텍스트). */
  scaleEdgeLabels?: TrendScaleEdgeLabel[];
  /** line 모드 — 시리즈 아래 면 채우기(클라우드·밴드). */
  envelopes?: TrendEnvelope[];
  /** line 모드 — MACD형 히스토그램 막대. */
  histograms?: TrendHistogram[];
  emptyLabel?: string;
  /** Show every Nth category tick (auto if omitted). */
  tickEvery?: number;
  /** 있으면 X축 tick 축약 (categories·툴팁은 풀 라벨 유지). 7d/30d는 월 경계=`N월`, 나머지=일. */
  period?: TrendPeriodId;
  /** false면 시리즈 범례 행 숨김 (sheet compact 등). */
  showLegend?: boolean;
  /** 범례 행 우측(구간 줌 칩 등). showLegend=false여도 단독 표시 가능. */
  legendTrailing?: ReactNode;
  /**
   * full: 전 시리즈·산포·편차
   * core: 모바일용 — 온도·습도·모터만 (EMA/산포/편차는 호버)
   */
  legendDensity?: "full" | "core";
  /** 설정모드 스케일 가이드 세로 hit(px). 기본 10 · 모바일 권장 22 */
  scaleEdgeHitPx?: number;
  /**
   * 모바일 — 플롯을 왼쪽으로 좁히고 우측에 스케일 라벨 거터.
   * viewBox 기준 우측 여백 ~20.
   */
  labelGutter?: boolean;
  /**
   * bar 모드 — 바 1개의 최대 너비(차트 폭 % 단위, 0~100).
   * 카테고리 수가 적을 때 통짜 바가 되지 않게 상한을 두고 슬롯 중앙에 정렬한다.
   * (viewBox가 non-uniform 스케일이라 px 대신 % 단위를 사용)
   */
  barWidthCapPct?: number;
  /** line 모드 데이터 점 표시. 기본 true. */
  showMarkers?: boolean;
  /**
   * 마커 밀도 — all=전점, sparse≈8점/시리즈(+호버 강조점).
   * 차트 탭 반응성용 sparse 권장.
   */
  markerDensity?: "all" | "sparse";
  /** 화면 기준 점 반지름(px). preserveAspectRatio=none 보정에 사용. */
  markerRadiusPx?: number;
  /**
   * 차트 탭 enter motion — 마운트·기간·레이어 밴드 변경 시 reveal.
   */
  animate?: boolean;
  /** @deprecated 밴드 Y 보간 사용. 전달해도 plot reflow CSS 미적용 */
  layoutKey?: string;
  /** 시리즈·히스토그램 추가/삭제 개별 클립 와이프 (기본 animate와 동일) */
  layerClipWipe?: boolean;
  /**
   * split-Y 밴드 경계 가이드 (차트 domain Y, 예: motorHi·humHi).
   * 레이어 on/off 재배치 시 fade-in.
   */
  splitBandGuides?: number[];
  /**
   * line 모드 — 전 시리즈가 null인 연속 구간을 세로 음영(결측)으로 표시.
   */
  showNullGaps?: boolean;
  /**
   * 추이 차트 — 희소/통신두절/없음 구간. 있으면 showNullGaps 일반 결측 음영은 쓰지 않음.
   */
  coverageBands?: UplinkCoverageBand[];
  /**
   * P1/P2 X스코프 — 드래그로 시간 구간(+Y밴드) 선택.
   * y*Ratio: plot 상단=0 · 하단=1
   */
  xScopeSelect?: boolean;
  onXScopeCommit?: (range: {
    start: number;
    end: number;
    yStartRatio: number;
    yEndRatio: number;
  }) => void;
  /**
   * DELIN 등 — 실제 X스코프 UI와 동일 경로로 클릭→드래그→커밋 시연.
   * token 증가 시 재생. CSS 오버레이가 아님.
   */
  guidedXScopeGesture?: {
    token: number;
    startRatio: number;
    endRatio: number;
    /** 카테고리 절대 인덱스 — 있으면 커밋 시 비율 재변환 생략 */
    startIndex?: number;
    endIndex?: number;
    yRatio?: number;
    yStartRatio?: number;
    yEndRatio?: number;
    durationMs?: number;
  } | null;
  onGuidedXScopeComplete?: () => void;
  /** 우클릭 — 줌 한 단계 뒤로 (스택 pop). 있으면 컨텍스트 메뉴 억제 */
  onXScopeBack?: () => void;
  /** 스코프 스택 변경 시 줌 인/아웃 모션 키 */
  scopeMotionKey?: number;
  scopeMotionDir?: "in" | "out";
  /** 빈 플롯 더블클릭 — 설정모드 진입 등 */
  onPlotDoubleClick?: () => void;
  /**
   * 빈 플롯 우클릭 (스케일 라벨 hit 아님).
   * 설정모드 종료 등 — onXScopeBack과 동시에 쓰지 말 것(호출측에서 모드별 분리).
   */
  onPlotBackgroundContextMenu?: () => void;
  /**
   * 한계 이탈 데이터 카드가 떠 있을 때만 우클릭 → 해당 장비 차트.
   * 스코프 줌 뒤로가기(onXScopeBack)보다 우선, 카드 없으면 호출되지 않음.
   */
  onBreachEquipmentNavigate?: (target: TrendBreachNavTarget) => void;
  /**
   * draggable scaleEdgeLabels — 세로 드래그로 domain Y 조절.
   * X스코프와 충돌 시 가이드 hit이 우선.
   */
  onScaleEdgeDrag?: (event: ScaleEdgeDragEvent) => void;
  /** 우클릭 숫자 입력 확정 */
  onScaleEdgeNumericCommit?: (event: ScaleEdgeNumericCommitEvent) => void;
  /** showApplyActions 라벨 — 적용 */
  onScaleEdgeApply?: () => void;
  /** showApplyActions 라벨 — 되돌리기 */
  onScaleEdgeRevert?: () => void;
  scaleEdgeApplyBusy?: boolean;
  scaleEdgeApplyDisabled?: boolean;
  /** 플롯 CSS 너비(px). 차트 탭 다운샘플 밀도용 */
  onPlotWidthChange?: (widthPx: number) => void;
};

const PAD_X = 6;
const PAD_TOP = 6;
/** 모터 0%를 회색 시간축에 붙임 — 하단 여백 없음 */
const PAD_BOTTOM = 0;
/** 측정 전 fallback · 패딩 비율 기준 */
const VIEW_W_NORM = 100;
const X_SCOPE_DRAG_PX = 8;
const X_SCOPE_MIN_SPAN = 3;
/** 알람 가이드선 hit (화면 px) */
const SCALE_EDGE_HIT_PX = 10;
/** 라벨에서 드래그 시작까지 이동량 — 클릭과 구분 */
const SCALE_EDGE_LABEL_DRAG_PX = 4;

function parseScaleEdgeEditSeed(
  guide: Pick<TrendScaleEdgeLabel, "editValue" | "text">,
): string {
  if (guide.editValue != null && Number.isFinite(guide.editValue)) {
    return String(guide.editValue);
  }
  const m = guide.text.match(/-?\d+(?:\.\d+)?/);
  return m?.[0] ?? "";
}

/** `28.5℃` / `+5℃` / `100%` → 단위 접미 (`℃`, `%`) */
function parseScaleEdgeValueUnit(text: string): string {
  const m = text.match(/-?\d+(?:\.\d+)?(.*)$/);
  return (m?.[1] ?? "").trim();
}

export type HoverMetricGroup = "temp" | "hum" | "motor";

/** 시리즈/히스토그램 라벨 → 호버 카드 그룹 */
export function inferHoverMetricGroup(label: string): HoverMetricGroup {
  if (/습도/.test(label)) return "hum";
  if (/모터|채널|입기|배기|송풍|^[ABC]$/.test(label)) return "motor";
  return "temp";
}

function contributorToNav(
  c: TrendSpreadContributor,
): TrendBreachNavTarget | null {
  const stallTyCode = c.stallTyCode?.trim();
  const stallNo = c.stallNo?.trim();
  const controllerKey = c.controllerKey?.trim();
  if (!stallTyCode || !stallNo || !controllerKey) return null;
  return {
    stallTyCode,
    stallNo,
    controllerKey,
    zoneLabel: c.zoneLabel,
    equipmentLabel: c.equipmentLabel,
  };
}

/**
 * 한계 이탈 데이터 카드가 보이는 조건과 동일할 때만 이동 대상 반환.
 * 상·하단 장비가 다르면 상한(상단) 우선.
 */
export function resolveBreachNavTarget(opts: {
  series: TrendSeries[];
  envelopes: TrendEnvelope[];
  hoverIdx: number;
  hoverSeriesName: string | null;
}): TrendBreachNavTarget | null {
  const { series, envelopes, hoverIdx, hoverSeriesName } = opts;
  if (hoverIdx < 0 || hoverSeriesName == null) return null;
  const group = inferHoverMetricGroup(hoverSeriesName);
  if (group !== "temp" && group !== "hum") return null;

  const tipSeries = series.filter(
    (s) => inferHoverMetricGroup(s.name) === group,
  );
  const extremes =
    tipSeries.find((s) => s.hoverSpreadExtremes)?.hoverSpreadExtremes ??
    envelopes.find(
      (e) =>
        e.hoverExtremes &&
        e.legendLabel === (group === "temp" ? "온도 산포" : "습도 산포"),
    )?.hoverExtremes;
  if (!extremes) return null;

  const hi = extremes.high[hoverIdx] ?? null;
  const lo = extremes.low[hoverIdx] ?? null;
  if (!hi?.breached && !lo?.breached) return null;

  if (hi?.breached) {
    const nav = contributorToNav(hi);
    if (nav) return nav;
  }
  if (lo?.breached) return contributorToNav(lo);
  return null;
}

const HOVER_GROUP_LABEL: Record<HoverMetricGroup, string> = {
  temp: "온도",
  hum: "습도",
  motor: "모터",
};

/** "분만사 01번 축사" → { prefix: "분만사", stallNo: "01" } */
function splitSpreadZoneLabel(zoneLabel: string): {
  prefix: string;
  stallNo: string | null;
} {
  const m = zoneLabel.match(/^(.*?)\s*(\S+)\s*번\s*축사\s*$/);
  if (m) return { prefix: (m[1] ?? "").trim(), stallNo: m[2] ?? null };
  return { prefix: zoneLabel, stallNo: null };
}

/** "컨트롤러 06" → "06" */
function spreadControllerNo(equipmentLabel: string): string | null {
  const m = equipmentLabel.match(/컨트롤러\s*(\S+)\s*$/);
  return m ? (m[1] ?? null) : null;
}

function MiniSpark({
  values,
  color,
  variant = "line",
}: {
  values: (number | null)[];
  color: string;
  variant?: "line" | "bars";
}) {
  const finite = values
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => x.v != null && Number.isFinite(x.v));
  if (finite.length < 2) return null;
  const ys = finite.map((x) => x.v);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;
  const w = 56;
  const h = 16;
  if (variant === "bars") {
    const barW = Math.max(2.5, (w - (finite.length - 1) * 1.5) / finite.length);
    return (
      <svg
        width={w}
        height={h}
        className="shrink-0 opacity-90"
        aria-hidden
      >
        {finite.map(({ v }, idx) => {
          const bh = Math.max(2, ((v - min) / span) * (h - 2));
          const x = idx * (barW + 1.5);
          return (
            <rect
              key={idx}
              x={x}
              y={h - bh}
              width={barW}
              height={bh}
              fill={color}
              opacity={0.35 + (idx / Math.max(1, finite.length - 1)) * 0.55}
              rx={0.5}
            />
          );
        })}
      </svg>
    );
  }
  const pts = finite
    .map(({ v }, idx) => {
      const x = (idx / (finite.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width={w}
      height={h}
      className="shrink-0 opacity-90"
      aria-hidden
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function formatHistHoverDisplay(
  h: TrendHistogram,
  hoverIdx: number,
): string {
  const sec = h.hoverSecondary?.[hoverIdx];
  if (sec == null || !Number.isFinite(sec) || !h.hoverSecondaryUnit) return "–";
  if (h.hoverFormat === "midpointDelta") {
    return `중점 ${sec > 0 ? "+" : ""}${sec.toFixed(1)}${h.hoverSecondaryUnit}`;
  }
  if (
    h.hoverFormat === "percent" ||
    h.style === "volume" ||
    h.hoverSecondaryUnit === "%"
  ) {
    return `${Math.round(sec)}${h.hoverSecondaryUnit}`;
  }
  return `${sec > 0 ? "+" : ""}${sec.toFixed(1)}${h.hoverSecondaryUnit}`;
}

function AlarmTrack({
  lo,
  hi,
  value,
  unit,
  color,
}: {
  lo: number;
  hi: number;
  value: number | null;
  unit: string;
  color: string;
}) {
  const span = hi - lo;
  const outside =
    value != null && Number.isFinite(value) && (value < lo || value > hi);
  const breachSide =
    value != null && Number.isFinite(value)
      ? value > hi
        ? ("high" as const)
        : value < lo
          ? ("low" as const)
          : null
      : null;
  const breachDelta =
    value != null && Number.isFinite(value) && breachSide === "high"
      ? value - hi
      : value != null && Number.isFinite(value) && breachSide === "low"
        ? lo - value
        : null;
  const breachDeltaText =
    breachDelta != null && breachSide != null
      ? formatLimitBreachDelta(breachDelta, unit, breachSide)
      : null;
  const thresholdEdge =
    breachSide === "high" ? hi : breachSide === "low" ? lo : null;

  /** 구간 안: 위치 핀. 이탈: 해당 한계 끝단에 고정 */
  const pct =
    value != null && Number.isFinite(value) && span > 0
      ? outside
        ? breachSide === "high"
          ? 100
          : 0
        : Math.max(0, Math.min(100, ((value - lo) / span) * 100))
      : null;

  return (
    <div className="mt-1.5 border-t border-border/60 pt-1.5">
      <div className="mb-0.5 flex items-center justify-between gap-2 farm-chart-fs-axis text-muted-foreground">
        {outside && thresholdEdge != null && breachDeltaText ? (
          <>
            <span className="tabular-nums" title="임계값">
              {formatTrendBandEdge(thresholdEdge, unit)}
            </span>
            <span className="font-medium text-amber-600 dark:text-amber-400">
              한계 이탈
            </span>
            <span
              className="tabular-nums font-medium text-amber-600 dark:text-amber-400"
              title="이탈량"
            >
              {breachDeltaText}
            </span>
          </>
        ) : (
          <>
            <span className="tabular-nums">
              {formatTrendBandEdge(lo, unit)}
            </span>
            <span>알람 구간</span>
            <span className="tabular-nums">
              {formatTrendBandEdge(hi, unit)}
            </span>
          </>
        )}
      </div>
      <div className="relative h-1.5 rounded-sm bg-muted/80">
        {pct != null ? (
          <span
            className={cn(
              "absolute top-1/2 h-2.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
              motionClass.farmChartAlarmPin,
            )}
            style={{ left: `${pct}%`, backgroundColor: color }}
          />
        ) : null}
      </div>
    </div>
  );
}

function MotorChannelMatrix({
  channels,
  hoverIdx,
}: {
  channels: NonNullable<TrendHistogram["hoverChannels"]>;
  hoverIdx: number;
}) {
  return (
    <div className="mt-1.5 space-y-1">
      {channels.map((ch) => {
        const raw = ch.values[hoverIdx];
        const pct =
          raw != null && Number.isFinite(raw)
            ? Math.max(0, Math.min(100, raw))
            : null;
        /** 데이터 카드 — 「채널 A」→「A」 (범례·정식명은 유지) */
        const tipLabel = ch.label.replace(/^채널\s*/, "") || ch.label;
        return (
          <div
            key={ch.label}
            className="flex items-center gap-1.5 farm-chart-fs-legend"
          >
            <span className="w-3 shrink-0 font-medium tabular-nums text-muted-foreground">
              {tipLabel}
            </span>
            <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-sm bg-muted/80">
              <div
                className={cn(
                  "h-full rounded-sm",
                  motionClass.farmChartChannelBar,
                )}
                style={{
                  width: pct != null ? `${pct}%` : "0%",
                  backgroundColor: ch.color,
                  opacity: 0.75,
                }}
              />
            </div>
            <span className="w-7 shrink-0 text-right font-medium tabular-nums">
              {pct != null ? Math.round(pct) : "–"}
            </span>
          </div>
        );
      })}
    </div>
  );
}


const MAX_PINNED_TIPS = 5;
const PIN_CLICK_SLOP_PX = 10;
/** 모바일 — 설정값 라벨 더블탭 → 숫자 입력 */
const SCALE_EDGE_DOUBLE_TAP_MS = 320;
const SCALE_EDGE_DOUBLE_TAP_SLOP_PX = 28;
const SCALE_EDGE_TAP_SLOP_PX = 12;

type ScaleEdgeTapRecord = {
  id: string;
  t: number;
  x: number;
  y: number;
};

function handleScaleEdgeDoubleTap(
  e: ReactPointerEvent<HTMLDivElement>,
  labelArm: { id: string; x: number; y: number; pointerType: string },
  scaleEdgeTapRef: { current: ScaleEdgeTapRecord | null },
  beginScaleEdgeEdit: (id: string) => void,
): void {
  const dist = Math.hypot(e.clientX - labelArm.x, e.clientY - labelArm.y);
  const isTouchLike =
    labelArm.pointerType === "touch" || labelArm.pointerType === "pen";
  if (dist > SCALE_EDGE_TAP_SLOP_PX || !isTouchLike) return;

  const now = e.timeStamp;
  const prev = scaleEdgeTapRef.current;
  if (
    prev &&
    prev.id === labelArm.id &&
    now - prev.t <= SCALE_EDGE_DOUBLE_TAP_MS &&
    Math.hypot(e.clientX - prev.x, e.clientY - prev.y) <=
      SCALE_EDGE_DOUBLE_TAP_SLOP_PX
  ) {
    scaleEdgeTapRef.current = null;
    beginScaleEdgeEdit(labelArm.id);
    return;
  }

  scaleEdgeTapRef.current = {
    id: labelArm.id,
    t: now,
    x: e.clientX,
    y: e.clientY,
  };
}

type PinnedTip = {
  id: string;
  idx: number;
  seriesKey: string;
  /** plot 상대 좌표 0~1 (ellipse 앵커) */
  nx: number;
  ny: number;
  /** 기본 배치 대비 사용자 드래그 오프셋(px) */
  ox: number;
  oy: number;
};

function tipPinId(idx: number, seriesKey: string): string {
  const g = inferHoverMetricGroup(seriesKey);
  return `${idx}::${g}`;
}

/** 앵커 기준 카드 left/top (px) — 플롯 안·포인터 가리지 않게 */
function computeTipPlacement(
  anchorX: number,
  anchorY: number,
  plotW: number,
  plotH: number,
  tipW = 168,
  tipH = 88,
): { left: number; top: number } {
  const gap = 14;
  const pad = 4;
  const spaceRight = plotW - anchorX - pad;
  const spaceLeft = anchorX - pad;
  const preferRight = spaceRight >= tipW + gap || spaceRight >= spaceLeft;
  let left = preferRight ? anchorX + gap : anchorX - tipW - gap;
  left = Math.min(Math.max(pad, left), Math.max(pad, plotW - tipW - pad));
  const preferAbove = anchorY - pad >= tipH + gap;
  let top = preferAbove ? anchorY - tipH - gap : anchorY + gap;
  top = Math.min(Math.max(pad, top), Math.max(pad, plotH - tipH - pad));
  return { left: Math.round(left), top: Math.round(top) };
}

function clipWipeClass(phase: ClipPhase): string | undefined {
  if (phase === "enter") return motionClass.farmChartClipWipeIn;
  if (phase === "exit") return motionClass.farmChartClipWipeOut;
  return undefined;
}

/** 호버 툴팁 — 온도·습도 소수 1자리, 모터(%) 정수. */
export function formatTrendHoverValue(
  value: number,
  unit: string,
  seriesName: string,
): string {
  if (!Number.isFinite(value)) return "–";
  const motorLike =
    unit === "%" &&
    (seriesName.startsWith("채널") ||
      seriesName === "A" ||
      seriesName === "B" ||
      seriesName === "C" ||
      /입기|배기|송풍|모터/.test(seriesName));
  if (motorLike) return `${Math.round(value)}${unit}`;
  if (unit === "n") {
    return `n=${Number.isInteger(value) ? String(value) : value.toFixed(0)}`;
  }
  if (unit === "℃" || unit === "%") return `${value.toFixed(1)}${unit}`;
  return `${Number.isInteger(value) ? String(value) : value.toFixed(1)}${unit}`;
}

/** 한계 끝단 라벨 — 정수면 그대로, 아니면 소수 1자리. */
export function formatTrendBandEdge(value: number, unit: string): string {
  if (!Number.isFinite(value)) return "–";
  const rounded =
    Math.abs(value - Math.round(value)) < 1e-6
      ? String(Math.round(value))
      : value.toFixed(1);
  return `${rounded}${unit}`;
}

/** 임계 대비 이탈량 — 상한 +n / 하한 −n */
export function formatLimitBreachDelta(
  absDelta: number,
  unit: string,
  side: "high" | "low",
): string {
  if (!Number.isFinite(absDelta) || absDelta < 0) return "";
  const mag =
    Math.abs(absDelta - Math.round(absDelta)) < 1e-6
      ? String(Math.round(absDelta))
      : absDelta.toFixed(1);
  return side === "high" ? `+${mag}${unit}` : `−${mag}${unit}`;
}

type EdgeBandLabel = {
  id: string;
  side: "left" | "right" | "center" | "plotStart";
  /** 0~100, 차트 영역 기준 top % */
  topPct: number;
  text: string;
  leadingText?: string;
  color: string;
  title: string;
  /** 상한=숫자 위 선, 하한=숫자 아래 선 */
  mark?: "overline" | "underline";
  draggable?: boolean;
  editValue?: number;
  labelLane?: "outer" | "inner";
  showApplyActions?: boolean;
};

/** 같은 끝단에서 가까운 라벨을 위·아래로 살짝 밀어 겹침을 줄인다. */
function nudgeEdgeLabelTops(labels: EdgeBandLabel[], minGapPct: number): EdgeBandLabel[] {
  const bySide: Record<
    "left" | "right" | "center" | "plotStart",
    EdgeBandLabel[]
  > = {
    left: [],
    right: [],
    center: [],
    plotStart: [],
  };
  for (const l of labels) bySide[l.side].push({ ...l });
  for (const side of ["left", "right", "center", "plotStart"] as const) {
    const list = bySide[side].sort((a, b) => a.topPct - b.topPct);
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1]!;
      const cur = list[i]!;
      if (cur.topPct - prev.topPct < minGapPct) {
        cur.topPct = Math.min(96, prev.topPct + minGapPct);
      }
    }
    bySide[side] = list;
  }
  return [
    ...bySide.left,
    ...bySide.right,
    ...bySide.center,
    ...bySide.plotStart,
  ];
}

function finiteValues(series: TrendSeries[], axis: TrendAxis | undefined): number[] {
  const out: number[] = [];
  for (const s of series) {
    if ((s.axis ?? "left") !== (axis ?? "left")) continue;
    for (const v of s.data) {
      if (v != null && Number.isFinite(v)) out.push(v);
    }
  }
  return out;
}

function domainFor(
  values: number[],
  forced: [number, number] | undefined,
): [number, number] {
  if (forced) return forced;
  if (values.length === 0) return [0, 1];
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.12;
  return [min - pad, max + pad];
}


function TrendPointCardBody({
  idx,
  seriesKey,
  categories,
  series,
  envelopes,
  histograms,
  leftUnit,
  rightUnit,
  onBreachEquipmentNavigate: _onBreachEquipmentNavigate,
}: {
  idx: number;
  seriesKey: string | null;
  categories: string[];
  series: TrendSeries[];
  envelopes: TrendEnvelope[];
  histograms: TrendHistogram[];
  leftUnit: string;
  rightUnit: string;
  onBreachEquipmentNavigate?: (target: TrendBreachNavTarget) => void;
}) {

              const group = seriesKey
                ? inferHoverMetricGroup(seriesKey)
                : null;
              const tipSeries = series.filter(
                (s) =>
                  group == null ||
                  inferHoverMetricGroup(s.name) === group,
              );
              const tipHists = histograms.filter((h) => {
                const label = h.legendLabel ?? "편차";
                return (
                  group == null || inferHoverMetricGroup(label) === group
                );
              });
              const sparkSeries =
                tipSeries.find((s) => s.name === seriesKey) ?? tipSeries[0];
              const sparkHist =
                tipHists.find((h) => (h.legendLabel ?? "") === seriesKey) ??
                tipHists[0];
              const sparkColor =
                sparkSeries?.color ??
                sparkHist?.colorUp ??
                "#94a3b8";
              const sparkSrc =
                sparkSeries?.hoverSecondary ??
                sparkSeries?.data ??
                sparkHist?.hoverSecondary ??
                sparkHist?.values ??
                [];
              const sparkSlice = sparkSrc.slice(
                Math.max(0, idx - 7),
                idx + 1,
              );

              const heroSeries =
                tipSeries.find((s) => s.name === seriesKey) ??
                tipSeries.find((s) =>
                  group === "temp"
                    ? s.name === "온도"
                    : group === "hum"
                      ? s.name === "습도"
                      : false,
                ) ??
                (group === "motor" ? undefined : tipSeries[0]);

              const motorChannels: NonNullable<
                TrendHistogram["hoverChannels"]
              > = (() => {
                if (group !== "motor") return [];
                const fromMeta =
                  tipHists.find((h) => h.hoverChannels?.length)?.hoverChannels ??
                  [];
                if (fromMeta.length) return fromMeta;
                return tipHists
                  .filter((h) => {
                    const lab = h.legendLabel ?? "";
                    return (
                      lab === "A" ||
                      lab === "B" ||
                      lab === "C" ||
                      /입기|배기|송풍/.test(lab)
                    );
                  })
                  .map((h) => ({
                    label: h.legendLabel!,
                    color: h.colorUp,
                    values: h.hoverSecondary ?? h.values,
                  }));
              })();
              const showMotorMatrix =
                group === "motor" && motorChannels.length > 0;

              let heroHist =
                tipHists.find((h) => (h.legendLabel ?? "") === seriesKey) ??
                tipHists.find((h) => (h.legendLabel ?? "") === "모터") ??
                (group === "motor" ? tipHists[0] : undefined);
              if (group === "motor") {
                heroHist =
                  tipHists.find((h) => (h.legendLabel ?? "") === "모터") ??
                  tipHists.find((h) => h.hoverChannels?.length) ??
                  tipHists[0];
              }

              let heroLabel = group ? HOVER_GROUP_LABEL[group] : "데이터";
              let heroText = "–";
              let heroUnit = "";
              let heroNum: number | null = null;
              let heroColor = sparkColor;

              if (group === "motor" && showMotorMatrix) {
                const vals = motorChannels
                  .map((ch) => ch.values[idx])
                  .filter((v): v is number => v != null && Number.isFinite(v));
                if (vals.length) {
                  heroNum = Math.max(...vals);
                  heroUnit = "%";
                  heroText = `${Math.round(heroNum)}%`;
                  heroLabel = "모터 max";
                  heroColor =
                    tipHists.find((h) => (h.legendLabel ?? "") === "모터")
                      ?.colorUp ??
                    motorChannels[0]?.color ??
                    sparkColor;
                }
              } else if (heroSeries) {
                const unit =
                  (heroSeries.axis ?? "left") === "right"
                    ? rightUnit
                    : leftUnit;
                const sec = heroSeries.hoverSecondary?.[idx];
                const v = heroSeries.data[idx];
                if (
                  sec != null &&
                  Number.isFinite(sec) &&
                  heroSeries.hoverSecondaryUnit
                ) {
                  heroNum = sec;
                  heroUnit = heroSeries.hoverSecondaryUnit;
                  heroText = formatTrendHoverValue(
                    sec,
                    heroSeries.hoverSecondaryUnit,
                    heroSeries.name,
                  );
                } else if (v != null && Number.isFinite(v)) {
                  heroNum = v;
                  heroUnit = unit;
                  heroText = formatTrendHoverValue(v, unit, heroSeries.name);
                }
                heroLabel = heroSeries.name;
                heroColor = heroSeries.color;
              } else if (heroHist) {
                const sec = heroHist.hoverSecondary?.[idx];
                heroText = formatHistHoverDisplay(heroHist, idx);
                if (sec != null && Number.isFinite(sec)) {
                  heroNum = sec;
                  heroUnit = heroHist.hoverSecondaryUnit ?? "";
                }
                heroLabel =
                  group === "motor" || heroHist.legendLabel === "모터"
                    ? "모터 max"
                    : (heroHist.legendLabel ?? "값");
                heroColor = heroHist.colorUp;
              }

              const heroKey = heroSeries?.name ?? heroHist?.legendLabel ?? "";

              const alarmMeta =
                group === "temp" || group === "hum"
                  ? tipSeries.find((s) => s.hoverAlarmBand)?.hoverAlarmBand
                  : undefined;

              const spreadExtremes =
                group === "temp" || group === "hum"
                  ? (tipSeries.find((s) => s.hoverSpreadExtremes)
                      ?.hoverSpreadExtremes ??
                    envelopes.find(
                      (e) =>
                        e.hoverExtremes &&
                        e.legendLabel ===
                          (group === "temp" ? "온도 산포" : "습도 산포"),
                    )?.hoverExtremes)
                  : undefined;
              const spreadHigh = spreadExtremes?.high[idx] ?? null;
              const spreadLow = spreadExtremes?.low[idx] ?? null;
              const showSpreadHigh = Boolean(spreadHigh?.breached);
              const showSpreadLow = Boolean(spreadLow?.breached);
              const spreadSame =
                showSpreadHigh &&
                showSpreadLow &&
                spreadHigh != null &&
                spreadLow != null &&
                spreadHigh.zoneLabel === spreadLow.zoneLabel &&
                spreadHigh.equipmentLabel === spreadLow.equipmentLabel;
              const spreadUnit = group === "temp" ? "℃" : "%";
              const formatSpreadRow = (
                side: "high" | "low",
                c: NonNullable<typeof spreadHigh>,
              ) => {
                const delta =
                  alarmMeta != null
                    ? side === "high"
                      ? c.value - alarmMeta.hi
                      : alarmMeta.lo - c.value
                    : null;
                const deltaText =
                  delta != null && delta >= -1e-9
                    ? formatLimitBreachDelta(Math.max(0, delta), spreadUnit, side)
                    : null;
                const zone = splitSpreadZoneLabel(c.zoneLabel);
                const ctrlNo = spreadControllerNo(c.equipmentLabel);
                return (
                  <>
                    {zone.stallNo ? (
                      <>
                        {zone.prefix ? <span>{zone.prefix}</span> : null}
                        <StallUnitNoMark stallNo={zone.stallNo} />
                      </>
                    ) : (
                      <span>{c.zoneLabel}</span>
                    )}
                    {ctrlNo ? (
                      <ControllerNoMark eqpmnNo={ctrlNo} />
                    ) : (
                      <span>{c.equipmentLabel}</span>
                    )}
                    <span className="tabular-nums text-muted-foreground">
                      {c.value.toFixed(1)}
                      {spreadUnit}
                    </span>
                    {deltaText ? (
                      <span className="tabular-nums font-medium text-amber-600 dark:text-amber-400">
                        {deltaText}
                      </span>
                    ) : null}
                  </>
                );
              };

              const secondarySeries = tipSeries.filter((s) => s.name !== heroKey);
              const secondaryHists = tipHists.filter((h) => {
                const lab = h.legendLabel ?? "";
                if (lab === heroKey) return false;
                if (showMotorMatrix && (lab === "모터" || /^[ABC]$/.test(lab))) {
                  return false;
                }
                return true;
              });

              const heroMain = heroText.replace(
                new RegExp(`${heroUnit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
                "",
              );

              return (
                <>
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="rounded-sm bg-muted/80 px-1 py-px farm-chart-fs-axis font-semibold tracking-tight text-foreground/90">
                      {group ? HOVER_GROUP_LABEL[group] : "데이터"}
                    </span>
                    <span className="farm-chart-fs-legend text-muted-foreground tabular-nums">
                      {categories[idx]}
                    </span>
                    <div className="ml-auto">
                      <MiniSpark
                        values={sparkSlice}
                        color={sparkColor}
                        variant={group === "motor" ? "bars" : "line"}
                      />
                    </div>
                  </div>

                  <div
                    className={cn(
                      "flex items-baseline gap-0.5",
                      motionClass.farmChartTipHero,
                    )}
                    key={`hero-${heroKey}-${idx}`}
                  >
                    <span
                      className="text-[18px] font-semibold leading-none tabular-nums tracking-tight"
                      style={{ color: heroColor }}
                    >
                      {heroMain || "–"}
                    </span>
                    {heroUnit ? (
                      <span className="farm-chart-fs-legend font-medium text-muted-foreground">
                        {heroUnit}
                        {heroLabel === "모터 max" ? " max" : ""}
                      </span>
                    ) : null}
                  </div>

                  {(secondarySeries.length > 0 || secondaryHists.length > 0) &&
                  !showMotorMatrix ? (
                    <div className="mt-1.5 space-y-0.5">
                      {secondarySeries.map((s) => {
                        const unit =
                          (s.axis ?? "left") === "right"
                            ? rightUnit
                            : leftUnit;
                        const sec = s.hoverSecondary?.[idx];
                        const v = s.data[idx];
                        const mappedPrimary =
                          v == null || !Number.isFinite(v)
                            ? "–"
                            : formatTrendHoverValue(v, unit, s.name);
                        const display =
                          sec != null &&
                          Number.isFinite(sec) &&
                          s.hoverSecondaryUnit
                            ? formatTrendHoverValue(
                                sec,
                                s.hoverSecondaryUnit,
                                s.name,
                              )
                            : mappedPrimary;
                        return (
                          <div
                            key={s.name}
                            className="flex items-center justify-between gap-2 farm-chart-fs-legend"
                          >
                            <span className="inline-flex min-w-0 items-center gap-1">
                              <span
                                className="inline-block h-1.5 w-1.5 shrink-0 rounded-sm"
                                style={{ backgroundColor: s.color }}
                              />
                              <span className="truncate text-muted-foreground">
                                {s.name}
                              </span>
                            </span>
                            <span className="shrink-0 tabular-nums">
                              {display}
                            </span>
                          </div>
                        );
                      })}
                      {secondaryHists.map((h, hi) => {
                        const chartV = h.values[idx];
                        const up =
                          chartV != null && Number.isFinite(chartV)
                            ? chartV >= h.baseline
                            : true;
                        return (
                          <div
                            key={`hist-tip-${hi}`}
                            className="flex items-center justify-between gap-2 farm-chart-fs-legend"
                          >
                            <span className="inline-flex min-w-0 items-center gap-1">
                              <span
                                className="inline-block h-1.5 w-1.5 shrink-0 rounded-sm"
                                style={{
                                  backgroundColor:
                                    h.style === "volume" || up
                                      ? h.colorUp
                                      : h.colorDown,
                                }}
                              />
                              <span className="truncate text-muted-foreground">
                                {h.legendLabel ?? "편차"}
                              </span>
                            </span>
                            <span className="shrink-0 tabular-nums">
                              {formatHistHoverDisplay(h, idx)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {showMotorMatrix ? (
                    <MotorChannelMatrix
                      channels={motorChannels}
                      hoverIdx={idx}
                    />
                  ) : null}

                  {showSpreadHigh || showSpreadLow ? (
                    <div className="mt-1.5 space-y-1 border-t border-border/50 pt-1.5">
                      <div className="farm-chart-fs-axis font-medium text-muted-foreground">
                        임계 초과 구간
                      </div>
                      {spreadSame && spreadHigh ? (
                        <div className="farm-chart-fs-legend flex flex-wrap items-center gap-x-1 leading-snug text-foreground/90">
                          <span className="text-muted-foreground">산포 ·</span>
                          {formatSpreadRow("high", spreadHigh)}
                        </div>
                      ) : (
                        <>
                          {showSpreadHigh && spreadHigh ? (
                            <div className="farm-chart-fs-legend flex flex-wrap items-center gap-x-1 leading-snug text-foreground/90">
                              <span className="text-muted-foreground">
                                상단 ·
                              </span>
                              {formatSpreadRow("high", spreadHigh)}
                            </div>
                          ) : null}
                          {showSpreadLow && spreadLow ? (
                            <div className="farm-chart-fs-legend flex flex-wrap items-center gap-x-1 leading-snug text-foreground/90">
                              <span className="text-muted-foreground">
                                하단 ·
                              </span>
                              {formatSpreadRow("low", spreadLow)}
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : null}

                  {alarmMeta ? (
                    <AlarmTrack
                      lo={alarmMeta.lo}
                      hi={alarmMeta.hi}
                      value={heroNum}
                      unit={alarmMeta.unit}
                      color={heroColor}
                    />
                  ) : null}
                </>
              );
            
}

export function TrendChart({
  mode,
  categories,
  series,
  height = 132,
  leftUnit = "",
  rightUnit = "",
  leftDomain,
  rightDomain,
  yAxisTicks = "full",
  referenceLines = [],
  scaleEdgeLabels = [],
  envelopes = [],
  histograms = [],
  emptyLabel = "데이터 없음",
  tickEvery,
  period,
  barWidthCapPct,
  showLegend = true,
  legendTrailing = null,
  legendDensity = "full",
  scaleEdgeHitPx = SCALE_EDGE_HIT_PX,
  labelGutter = false,
  showMarkers = true,
  markerDensity = "all",
  markerRadiusPx = 3,
  animate = false,
  layoutKey: _layoutKey,
  layerClipWipe,
  splitBandGuides = [],
  showNullGaps = false,
  coverageBands = [],
  xScopeSelect = false,
  onXScopeCommit,
  guidedXScopeGesture = null,
  onGuidedXScopeComplete,
  onXScopeBack,
  scopeMotionKey = 0,
  scopeMotionDir = "in",
  onPlotDoubleClick,
  onPlotBackgroundContextMenu,
  onBreachEquipmentNavigate,
  onScaleEdgeDrag,
  onScaleEdgeNumericCommit,
  onScaleEdgeApply,
  onScaleEdgeRevert,
  scaleEdgeApplyBusy = false,
  scaleEdgeApplyDisabled = false,
  onPlotWidthChange,
}: TrendChartProps) {
  void _layoutKey;
  void tickEvery;
  const clipWipeEnabled = layerClipWipe ?? animate;
  /** 호버 — 인덱스 변경 시에만 setState (mousemove 전량 리렌더 방지) */
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [hoverSeries, setHoverSeries] = useState<string | null>(null);
  /** 클릭으로 고정한 비교용 데이터 카드 (다중) */
  const [pinnedTips, setPinnedTips] = useState<PinnedTip[]>([]);
  const bringPinToFront = (id: string) => {
    setPinnedTips((prev) => {
      const i = prev.findIndex((p) => p.id === id);
      if (i < 0 || i === prev.length - 1) return prev;
      const next = prev.slice();
      const [item] = next.splice(i, 1);
      if (!item) return prev;
      next.push(item);
      return next;
    });
  };
  const [xDraft, setXDraft] = useState<{
    a: number;
    b: number;
    y0: number;
    y: number;
  } | null>(null);
  const [edgeDragId, setEdgeDragId] = useState<string | null>(null);
  const [edgeEdit, setEdgeEdit] = useState<{
    id: string;
    text: string;
  } | null>(null);
  const hoverIdxRef = useRef<number | null>(null);
  const hoverSeriesRef = useRef<string | null>(null);
  const crossVRef = useRef<SVGLineElement | null>(null);
  const crossHRef = useRef<SVGLineElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const lastAnchorRef = useRef({ x: 0, y: 0, w: 1, h: 1 });
  const plotRef = useRef<HTMLDivElement | null>(null);
  const chartRootRef = useRef<HTMLDivElement | null>(null);
  const pinClickArmRef = useRef<{
    x: number;
    y: number;
    pointerId: number;
  } | null>(null);
  const [plotPx, setPlotPx] = useState({ w: 1, h: 1 });
  const plotWidthNotifyRef = useRef(0);
  const glowFilterId = `tc-glow-${useId().replace(/:/g, "")}`;
  /** 기간 변경 시만 plot wipe — 카테고리 trim/X스코프는 remount 금지 */
  const plotEnterKey = animate ? String(period ?? "p") : "static";
  const xScopeOriginRef = useRef<{ x: number; y: number } | null>(null);
  const xScopeDraggingRef = useRef(false);
  const guidedScopeActiveRef = useRef(false);
  const guidedTokenSeenRef = useRef(0);
  const xDraftRef = useRef<{
    a: number;
    b: number;
    y0: number;
    y: number;
  } | null>(null);

  /** Prop sync during render — 스코프 끔 시 드래프트 즉시 폐기 */
  const [prevXScopeSelect, setPrevXScopeSelect] = useState(xScopeSelect);
  if (xScopeSelect !== prevXScopeSelect) {
    setPrevXScopeSelect(xScopeSelect);
    if (!xScopeSelect) setXDraft(null);
  }
  useEffect(() => {
    if (xScopeSelect) return;
    xDraftRef.current = null;
    xScopeOriginRef.current = null;
    xScopeDraggingRef.current = false;
  }, [xScopeSelect]);

  /** 차트 밖 클릭 — 고정 데이터 카드 전부 해제 */
  useEffect(() => {
    const onDocPointerDown = (e: PointerEvent) => {
      const root = chartRootRef.current;
      if (!root) return;
      const t = e.target;
      if (t instanceof Node && root.contains(t)) return;
      setPinnedTips((prev) => (prev.length ? [] : prev));
    };
    document.addEventListener("pointerdown", onDocPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onDocPointerDown, true);
  }, []);

  const edgeDragRef = useRef<{
    id: string;
    axis: TrendAxis;
  } | null>(null);
  const labelDragArmRef = useRef<{
    id: string;
    axis: TrendAxis;
    value: number;
    x: number;
    y: number;
    pointerId: number;
    pointerType: string;
  } | null>(null);
  const scaleEdgeTapRef = useRef<{
    id: string;
    t: number;
    x: number;
    y: number;
  } | null>(null);
  const pinCardDragRef = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    origOx: number;
    origOy: number;
  } | null>(null);

  const seriesPresence = useClipPresence(series, (s) => s.name, {
    enabled: clipWipeEnabled,
  });
  const histPresence = useClipPresence(
    histograms,
    (h) =>
      `${h.legendLabel ?? "hist"}:${h.groupIndex ?? 0}:${h.style ?? "macd"}`,
    { enabled: clipWipeEnabled },
  );
  const envelopePresence = useClipPresence(
    envelopes,
    (e) => e.legendLabel ?? "envelope",
    { enabled: clipWipeEnabled },
  );

  useLayoutEffect(() => {
    const el = plotRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let tid = 0;
    const apply = () => {
      window.clearTimeout(tid);
      tid = window.setTimeout(() => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setPlotPx((prev) =>
            Math.abs(prev.w - rect.width) < 0.5 &&
            Math.abs(prev.h - rect.height) < 0.5
              ? prev
              : { w: rect.width, h: rect.height },
          );
          if (Math.abs(plotWidthNotifyRef.current - rect.width) >= 4) {
            plotWidthNotifyRef.current = rect.width;
            onPlotWidthChange?.(rect.width);
          }
        }
      }, 100);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      window.clearTimeout(tid);
      ro.disconnect();
    };
  }, [height, categories.length, series.length, onPlotWidthChange]);

  const hasAny =
    series.some((s) => s.data?.some((v) => v != null)) ||
    histograms.some((h) => h.values.some((v) => v != null));
  const n = categories.length;
  const timeAxisMs = useMemo(
    () => (mode === "bar" ? null : parseCategoryTimelineMs(categories)),
    [categories, mode],
  );

  /** Prop sync during render — 기간·데이터 바뀌면 고정 카드 초기화 */
  const pinResetKey = `${period ?? ""}|${n}`;
  const [prevPinResetKey, setPrevPinResetKey] = useState(pinResetKey);
  if (pinResetKey !== prevPinResetKey) {
    setPrevPinResetKey(pinResetKey);
    setPinnedTips([]);
  }

  const axisH = 16;
  const chartH = height - axisH;
  /** 원단위 Y축(C2) 또는 모바일 거터 */
  const showNativeLeftAxis = Boolean(leftUnit);
  const viewW = plotPx.w > 32 ? plotPx.w : VIEW_W_NORM;
  const padL0 = showNativeLeftAxis ? PAD_X : labelGutter ? 4 : PAD_X;
  const padR0 = labelGutter ? 20 : PAD_X;
  const padL = (padL0 / VIEW_W_NORM) * viewW;
  const padR = (padR0 / VIEW_W_NORM) * viewW;
  const innerW = viewW - padL - padR;
  const innerH = chartH - PAD_TOP - PAD_BOTTOM;

  /** preserveAspectRatio=none 에서 원이 옆으로 퍼지지 않도록 viewBox rx/ry 보정 */
  const markerRx = (rPx: number) => (rPx * viewW) / Math.max(1, plotPx.w);
  const markerRy = (rPx: number) => (rPx * chartH) / Math.max(1, plotPx.h);

  const usesRight = series.some((s) => s.axis === "right") || referenceLines.some((r) => r.axis === "right");

  const [lMin, lMax] = domainFor(finiteValues(series, "left"), leftDomain);
  const [rMin, rMax] = domainFor(finiteValues(series, "right"), rightDomain);

  const yFor = (value: number, axis: TrendAxis): number => {
    const [mn, mx] = axis === "right" ? [rMin, rMax] : [lMin, lMax];
    if (
      !Number.isFinite(value) ||
      !Number.isFinite(mn) ||
      !Number.isFinite(mx)
    ) {
      return PAD_TOP + innerH;
    }
    const t = (value - mn) / (mx - mn || 1);
    return PAD_TOP + innerH - t * innerH;
  };

  const leftAxisTicks =
    showNativeLeftAxis && Number.isFinite(lMin) && Number.isFinite(lMax) && lMax > lMin
      ? (yAxisTicks === "ends" ? [0, 1] : [0, 1, 2, 3, 4]).map((i, _, steps) => {
          const denom = Math.max(1, steps.length - 1);
          const value = lMin + ((lMax - lMin) * i) / denom;
          const y = yFor(value, "left");
          return {
            id: `left-axis-${i}`,
            topPct: (y / chartH) * 100,
            text: formatTrendBandEdge(value, leftUnit),
          };
        })
      : [];

  const xFor = (i: number): number => {
    if (n <= 1) return padL + innerW / 2;
    if (timeAxisMs && timeAxisMs.length === n) {
      const t0 = timeAxisMs[0]!;
      const ti = timeAxisMs[i];
      const span = timeAxisMs[n - 1]! - t0;
      if (span > 0 && ti != null && Number.isFinite(ti) && Number.isFinite(t0)) {
        const t = (ti - t0) / span;
        return padL + Math.min(1, Math.max(0, t)) * innerW;
      }
    }
    return padL + (i / (n - 1)) * innerW;
  };

  const barGroupW = n > 0 ? innerW / n : innerW;
  const rawBarW =
    series.length > 0 ? (barGroupW * 0.7) / series.length : barGroupW * 0.7;
  const barW =
    barWidthCapPct != null ? Math.min(rawBarW, barWidthCapPct) : rawBarW;
  const barSlotW = barW * Math.max(1, series.length);

  /** 팬 1~4개 — 차트 중앙 기준 클러스터(1=중앙, 2=중앙 좌·우). 5개 이상은 전폭 분산. */
  const barCenterCluster = mode === "bar" && n > 0 && n <= 4;

  const xForBar = (i: number): number => {
    const center = padL + innerW / 2;
    if (n <= 1) return center;
    if (!barCenterCluster) return xFor(i);
    const spacing = Math.min(
      Math.max(barSlotW * 1.25, innerW / (n + 2)),
      n > 1 ? innerW / (n - 1) : innerW,
    );
    const span = (n - 1) * spacing;
    return center - span / 2 + i * spacing;
  };

  const xAtIndex = (i: number): number =>
    mode === "bar" ? xForBar(i) : xFor(i);

  const setCrosshairVisible = (visible: boolean) => {
    const op = visible ? "1" : "0";
    if (crossVRef.current) crossVRef.current.style.opacity = op;
    if (crossHRef.current) crossHRef.current.style.opacity = op;
  };

  const setCrosshairAt = (xView: number, yView: number) => {
    if (crossVRef.current) {
      crossVRef.current.setAttribute("x1", String(xView));
      crossVRef.current.setAttribute("x2", String(xView));
    }
    if (crossHRef.current) {
      crossHRef.current.setAttribute("y1", String(yView));
      crossHRef.current.setAttribute("y2", String(yView));
    }
    setCrosshairVisible(true);
  };

  /** 데이터 점 근처 · 플롯 안 · 포인터/점을 가리지 않게 카드 배치 */
  const placeTipNear = (
    anchorX: number,
    anchorY: number,
    plotW: number,
    plotH: number,
  ) => {
    const el = tipRef.current;
    if (!el) return;
    const tipW = el.offsetWidth || 168;
    const tipH = el.offsetHeight || 72;
    const { left, top } = computeTipPlacement(
      anchorX,
      anchorY,
      plotW,
      plotH,
      tipW,
      tipH,
    );
    el.style.transform = `translate(${left}px, ${top}px)`;
    el.style.opacity = "1";
  };

  /**
   * 표시 데이터 지점(시리즈 샘플 · 막대 · 히스토그램 끝)에만 히트.
   * 빈 플롯 영역 X스냅은 하지 않음.
   */
  const findDataPointHit = (
    xPx: number,
    yPx: number,
    plotW: number,
    plotH: number,
  ): { idx: number; xView: number; yView: number; seriesKey: string } | null => {
    if (n === 0 || plotW <= 0 || plotH <= 0) return null;
    const hitR = Math.max(14, markerRadiusPx * 4.2);
    const hitR2 = hitR * hitR;
    let bestD2 = hitR2;
    let best: {
      idx: number;
      xView: number;
      yView: number;
      seriesKey: string;
    } | null = null;

    const consider = (
      i: number,
      xView: number,
      yView: number,
      seriesKey: string,
    ) => {
      const sx = (xView / viewW) * plotW;
      const sy = (yView / chartH) * plotH;
      const dx = xPx - sx;
      const dy = yPx - sy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= bestD2) {
        bestD2 = d2;
        best = { idx: i, xView, yView, seriesKey };
      }
    };

    if (mode === "bar") {
      for (let si = 0; si < series.length; si++) {
        const s = series[si]!;
        const axis = s.axis ?? "left";
        for (let i = 0; i < n; i++) {
          const v = s.data[i];
          if (v == null || !Number.isFinite(v)) continue;
          const yTop = yFor(v, axis);
          const baseY = PAD_TOP + innerH;
          const gx = xForBar(i) - barSlotW / 2 + si * barW;
          const barWv = Math.max(0.4, barW * 0.92);
          const left = (gx / viewW) * plotW;
          const right = ((gx + barWv) / viewW) * plotW;
          const top = (yTop / chartH) * plotH;
          const bottom = (baseY / chartH) * plotH;
          if (xPx >= left && xPx <= right && yPx >= top && yPx <= bottom) {
            consider(i, gx + barWv / 2, yTop, s.name);
            continue;
          }
          consider(i, gx + barWv / 2, yTop, s.name);
        }
      }
    } else {
      for (const s of series) {
        const axis = s.axis ?? "left";
        for (let i = 0; i < n; i++) {
          const v = s.data[i];
          if (v == null || !Number.isFinite(v)) continue;
          consider(i, xFor(i), yFor(v, axis), s.name);
        }
      }
    }

    for (let hi = 0; hi < histograms.length; hi++) {
      const h = histograms[hi]!;
      const key = h.legendLabel ?? `hist-${hi}`;
      const slot =
        n > 1 ? (innerW) / (n - 1) : innerW;
      const isVolume = h.style === "volume";
      const isOverlay = h.style === "overlay";
      const gs = Math.max(1, h.groupSize ?? 1);
      const gi = h.groupIndex ?? 0;
      const barWHist = Math.max(
        0.22,
        slot *
          (isVolume && gs > 1
            ? 0.62 / gs
            : isVolume
              ? 0.5
              : isOverlay
                ? 0.28
                : 0.55),
      );
      const cluster =
        isVolume && gs > 1
          ? (gi - (gs - 1) / 2) * (barWHist + 0.12)
          : 0;
      const yBase = yFor(h.baseline, "left");

      for (let i = 0; i < n; i++) {
        const v = h.values[i];
        if (v == null || !Number.isFinite(v)) continue;
        const yVal = yFor(v, "left");
        const tipY = yVal;
        const gx = xAtIndex(i) + cluster - barWHist / 2;
        const top = Math.min(yBase, yVal);
        const bottom = Math.max(yBase, yVal);
        const left = (gx / viewW) * plotW;
        const right = ((gx + barWHist) / viewW) * plotW;
        const topPx = (top / chartH) * plotH;
        const bottomPx = (bottom / chartH) * plotH;
        /** 모터/편차 막대 — 바 전체 영역 히트 (끝점만 아님) */
        if (
          xPx >= left - 2 &&
          xPx <= right + 2 &&
          yPx >= Math.min(topPx, bottomPx) - 2 &&
          yPx <= Math.max(topPx, bottomPx) + 2
        ) {
          bestD2 = 0;
          best = { idx: i, xView: gx + barWHist / 2, yView: tipY, seriesKey: key };
          continue;
        }
        /** 바 근처 완화 히트 (모터 밴드에서 잡기 쉽게) */
        const padHit = isVolume ? hitR * 1.35 : hitR;
        const sx = ((gx + barWHist / 2) / viewW) * plotW;
        const sy = (tipY / chartH) * plotH;
        const dx = xPx - sx;
        const dy = yPx - sy;
        const d2 = dx * dx + dy * dy;
        if (d2 <= padHit * padHit && d2 <= bestD2) {
          bestD2 = d2;
          best = {
            idx: i,
            xView: gx + barWHist / 2,
            yView: tipY,
            seriesKey: key,
          };
        }
      }
    }

    return best;
  };

  const clearHover = () => {
    hoverIdxRef.current = null;
    hoverSeriesRef.current = null;
    setHoverIdx(null);
    setHoverSeries(null);
    setCrosshairVisible(false);
  };

  const indexFromXView = (xView: number): number => {
    if (n <= 1) return 0;
    const u = (xView - padL) / innerW;
    return Math.round(Math.min(1, Math.max(0, u)) * (n - 1));
  };

  const xViewFromClient = (
    clientX: number,
    rect: DOMRect,
  ): number => {
    if (rect.width <= 0) return padL;
    const xPx = clientX - rect.left;
    return Math.min(
      viewW - padR,
      Math.max(padL, (xPx / rect.width) * viewW),
    );
  };

  const yViewFromClient = (
    clientY: number,
    rect: DOMRect,
  ): number => {
    if (rect.height <= 0) return PAD_TOP;
    const yPx = clientY - rect.top;
    return Math.min(
      PAD_TOP + innerH,
      Math.max(PAD_TOP, (yPx / rect.height) * chartH),
    );
  };

  const yCenterRatioFromView = (yView: number): number => {
    if (innerH <= 0) return 0.5;
    return Math.min(1, Math.max(0, (yView - PAD_TOP) / innerH));
  };

  const xViewFromRatio = (r: number) =>
    padL + Math.min(1, Math.max(0, r)) * innerW;
  const yViewFromRatio = (r: number) =>
    PAD_TOP + Math.min(1, Math.max(0, r)) * innerH;

  const commitXScopeFromViews = (
    a: number,
    b: number,
    y0: number,
    y1: number,
  ) => {
    if (!onXScopeCommit || n < 2) return;
    let start = indexFromXView(Math.min(a, b));
    let end = indexFromXView(Math.max(a, b));
    if (end - start < X_SCOPE_MIN_SPAN) {
      const mid = Math.round((start + end) / 2);
      start = Math.max(0, mid - Math.floor(X_SCOPE_MIN_SPAN / 2));
      end = Math.min(n - 1, start + X_SCOPE_MIN_SPAN);
      start = Math.max(0, end - X_SCOPE_MIN_SPAN);
    }
    onXScopeCommit({
      start,
      end,
      yStartRatio: yCenterRatioFromView(y0),
      yEndRatio: yCenterRatioFromView(y1),
    });
  };

  /**
   * 실제 X스코프 draft UI로 클릭→드래그→커밋 (DELIN 시연).
   */
  useEffect(() => {
    const g = guidedXScopeGesture;
    if (!g || !onXScopeCommit || n < 2) return;
    if (g.token === guidedTokenSeenRef.current) return;
    guidedTokenSeenRef.current = g.token;

    const hasIdx =
      g.startIndex != null &&
      g.endIndex != null &&
      Number.isFinite(g.startIndex) &&
      Number.isFinite(g.endIndex);
    let commitStart = 0;
    let commitEnd = n - 1;
    let x0: number;
    let x1: number;
    if (hasIdx) {
      commitStart = Math.max(
        0,
        Math.min(n - 1, Math.round(Math.min(g.startIndex!, g.endIndex!))),
      );
      commitEnd = Math.max(
        0,
        Math.min(n - 1, Math.round(Math.max(g.startIndex!, g.endIndex!))),
      );
      if (commitEnd - commitStart < X_SCOPE_MIN_SPAN) {
        /** 최소 폭은 왼쪽(과거)으로만 확장 — 오른쪽 정상 봉 유입 방지 */
        commitStart = Math.max(0, commitEnd - X_SCOPE_MIN_SPAN);
      }
      x0 = xViewFromRatio(n <= 1 ? 0 : commitStart / (n - 1));
      x1 = xViewFromRatio(n <= 1 ? 1 : commitEnd / (n - 1));
    } else {
      x0 = xViewFromRatio(Math.min(g.startRatio, g.endRatio));
      x1 = xViewFromRatio(Math.max(g.startRatio, g.endRatio));
    }

    const yTopR =
      g.yStartRatio ??
      g.yEndRatio ??
      g.yRatio ??
      0.35;
    const yBotR =
      g.yEndRatio ??
      g.yStartRatio ??
      g.yRatio ??
      0.55;
    const y0 = yViewFromRatio(Math.min(yTopR, yBotR));
    const y1 = yViewFromRatio(Math.max(yTopR, yBotR));
    /** 클릭은 좌상단, 드래그는 우하단으로 직사각형 확장 */
    const duration = Math.max(1200, g.durationMs ?? 2800);
    let t0: number | null = null;
    let raf = 0;
    guidedScopeActiveRef.current = true;
    clearHover();

    const easeInOut = (t: number) =>
      t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

    const tick = (now: number) => {
      if (t0 == null) t0 = now;
      const u = Math.min(1, (now - t0) / duration);
      /** 0–12% 클릭 홀드 · 12–82% 대각 드래그 · 82–100% 확정 전 홀드 */
      if (u < 0.12) {
        const next = { a: x0, b: x0, y0, y: y0 };
        xDraftRef.current = next;
        setXDraft(next);
      } else if (u < 0.82) {
        const dragT = easeInOut((u - 0.12) / 0.7);
        const bx = x0 + (x1 - x0) * dragT;
        const by = y0 + (y1 - y0) * dragT;
        const next = { a: x0, b: bx, y0, y: by };
        xDraftRef.current = next;
        setXDraft(next);
      } else {
        const next = { a: x0, b: x1, y0, y: y1 };
        xDraftRef.current = next;
        setXDraft(next);
      }

      if (u < 1) {
        raf = requestAnimationFrame(tick);
        return;
      }

      xDraftRef.current = null;
      setXDraft(null);
      guidedScopeActiveRef.current = false;
      if (hasIdx) {
        onXScopeCommit({
          start: commitStart,
          end: commitEnd,
          yStartRatio: yCenterRatioFromView(y0),
          yEndRatio: yCenterRatioFromView(y1),
        });
      } else {
        commitXScopeFromViews(x0, x1, y0, y1);
      }
      onGuidedXScopeComplete?.();
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      guidedScopeActiveRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- token-driven replay
  }, [guidedXScopeGesture?.token, n, onXScopeCommit]);

  const domainValueFromYView = (yView: number, axis: TrendAxis): number => {
    const [mn, mx] = axis === "right" ? [rMin, rMax] : [lMin, lMax];
    if (innerH <= 0) return (mn + mx) / 2;
    const t = 1 - (yView - PAD_TOP) / innerH;
    return mn + Math.min(1, Math.max(0, t)) * (mx - mn);
  };

  const hitDraggableScaleEdge = (
    clientY: number,
    rect: DOMRect,
  ): { id: string; axis: TrendAxis; value: number } | null => {
    if (!onScaleEdgeDrag || rect.height <= 0) return null;
    const yPx = clientY - rect.top;
    let best: { id: string; axis: TrendAxis; value: number; d: number } | null =
      null;
    for (const guide of scaleEdgeLabels) {
      if (!guide.draggable || !guide.showLine) continue;
      const axis = guide.axis ?? "left";
      const y = yFor(guide.value, axis);
      if (!Number.isFinite(y)) continue;
      const screenY = (y / chartH) * rect.height;
      const d = Math.abs(yPx - screenY);
      if (d > scaleEdgeHitPx) continue;
      if (!best || d < best.d) {
        best = { id: guide.id, axis, value: guide.value, d };
      }
    }
    return best ? { id: best.id, axis: best.axis, value: best.value } : null;
  };

  const emitScaleEdgeDrag = (
    id: string,
    value: number,
    phase: ScaleEdgeDragEvent["phase"],
  ) => {
    onScaleEdgeDrag?.({ id, value, phase });
  };

  const beginScaleEdgeEdit = (guideId: string) => {
    if (!onScaleEdgeNumericCommit) return;
    const guide = scaleEdgeLabels.find((g) => g.id === guideId);
    if (!guide?.draggable) return;
    if (edgeDragRef.current) {
      endScaleEdgeDrag("cancel");
    }
    labelDragArmRef.current = null;
    scaleEdgeTapRef.current = null;
    setEdgeEdit({
      id: guideId,
      text: parseScaleEdgeEditSeed(guide),
    });
    clearHover();
  };

  const cancelScaleEdgeEdit = () => {
    setEdgeEdit(null);
  };

  const commitScaleEdgeEdit = () => {
    if (!edgeEdit || !onScaleEdgeNumericCommit) {
      setEdgeEdit(null);
      return;
    }
    const parsed = Number(edgeEdit.text.trim());
    if (!Number.isFinite(parsed)) {
      setEdgeEdit(null);
      return;
    }
    const id = edgeEdit.id;
    setEdgeEdit(null);
    onScaleEdgeNumericCommit({ id, value: parsed });
  };

  const endScaleEdgeDrag = (phase: "end" | "cancel") => {
    const cur = edgeDragRef.current;
    if (!cur) return;
    const guide = scaleEdgeLabels.find((g) => g.id === cur.id);
    emitScaleEdgeDrag(cur.id, guide?.value ?? 0, phase);
    edgeDragRef.current = null;
    setEdgeDragId(null);
  };

  const onPlotPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (edgeEdit) return;
    pinClickArmRef.current = {
      x: e.clientX,
      y: e.clientY,
      pointerId: e.pointerId,
    };
    /** 플롯 본문은 시간 줌 우선 — 알람선 전체폭 hit로 X스코프를 가로채지 않음.
     *  알람 세로 조절은 우측 숫자 라벨 드래그 / 우클릭 숫자 입력. */
    if (xScopeSelect) onXScopePointerDown(e);
  };

  const onPlotPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pinDrag = pinCardDragRef.current;
    if (pinDrag && pinDrag.pointerId === e.pointerId) {
      const dx = e.clientX - pinDrag.startX;
      const dy = e.clientY - pinDrag.startY;
      setPinnedTips((prev) =>
        prev.map((p) =>
          p.id === pinDrag.id
            ? { ...p, ox: pinDrag.origOx + dx, oy: pinDrag.origOy + dy }
            : p,
        ),
      );
      return;
    }

    const arm = labelDragArmRef.current;
    if (arm && !edgeDragRef.current) {
      const dx = Math.abs(e.clientX - arm.x);
      const dy = Math.abs(e.clientY - arm.y);
      if (dx >= SCALE_EDGE_LABEL_DRAG_PX || dy >= SCALE_EDGE_LABEL_DRAG_PX) {
        scaleEdgeTapRef.current = null;
        labelDragArmRef.current = null;
        pinClickArmRef.current = null;
        edgeDragRef.current = { id: arm.id, axis: arm.axis };
        setEdgeDragId(arm.id);
        clearHover();
        emitScaleEdgeDrag(arm.id, arm.value, "start");
        const rect = e.currentTarget.getBoundingClientRect();
        const yView = yViewFromClient(e.clientY, rect);
        const value = domainValueFromYView(yView, arm.axis);
        emitScaleEdgeDrag(arm.id, value, "move");
      }
      return;
    }
    const cur = edgeDragRef.current;
    if (cur) {
      const rect = e.currentTarget.getBoundingClientRect();
      const yView = yViewFromClient(e.clientY, rect);
      const value = domainValueFromYView(yView, cur.axis);
      emitScaleEdgeDrag(cur.id, value, "move");
      return;
    }
    if (xScopeSelect) onXScopePointerMove(e);
  };

  const onPlotPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (
      pinCardDragRef.current &&
      pinCardDragRef.current.pointerId === e.pointerId
    ) {
      pinCardDragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      return;
    }

    const pinArm = pinClickArmRef.current;
    pinClickArmRef.current = null;

    const labelArm = labelDragArmRef.current;

    if (labelArm && labelArm.pointerId === e.pointerId && !edgeDragRef.current) {
      labelDragArmRef.current = null;
      if (onScaleEdgeNumericCommit) {
        handleScaleEdgeDoubleTap(
          e,
          labelArm,
          scaleEdgeTapRef,
          beginScaleEdgeEdit,
        );
      }
      return;
    }

    if (labelDragArmRef.current) {
      labelDragArmRef.current = null;
      return;
    }
    if (edgeDragRef.current) {
      endScaleEdgeDrag("end");
      return;
    }

    const wasScopeDrag = xScopeDraggingRef.current;
    if (xScopeSelect) onXScopePointerUp(e);

    if (wasScopeDrag) return;
    if (!pinArm || pinArm.pointerId !== e.pointerId) return;
    const dist = Math.hypot(e.clientX - pinArm.x, e.clientY - pinArm.y);
    if (dist > PIN_CLICK_SLOP_PX) return;

    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const hit = findDataPointHit(
      e.clientX - rect.left,
      e.clientY - rect.top,
      rect.width,
      rect.height,
    );
    if (!hit) return;

    const id = tipPinId(hit.idx, hit.seriesKey);
    setPinnedTips((prev) => {
      if (prev.some((p) => p.id === id)) {
        return prev.filter((p) => p.id !== id);
      }
      const next: PinnedTip = {
        id,
        idx: hit.idx,
        seriesKey: hit.seriesKey,
        nx: hit.xView / viewW,
        ny: hit.yView / chartH,
        ox: 0,
        oy: 0,
      };
      return [...prev, next].slice(-MAX_PINNED_TIPS);
    });
  };

  const onPlotPointerCancel = () => {
    pinCardDragRef.current = null;
    pinClickArmRef.current = null;
    scaleEdgeTapRef.current = null;
    labelDragArmRef.current = null;
    if (edgeDragRef.current) {
      endScaleEdgeDrag("cancel");
      return;
    }
    onXScopePointerCancel();
  };

  const onPlotDoubleClickHandler = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!onPlotDoubleClick) return;
    if (edgeEdit || edgeDragRef.current || labelDragArmRef.current) return;
    // 직전 포인터가 줌 드래그였으면 무시
    if (xScopeDraggingRef.current) return;
    e.preventDefault();
    onPlotDoubleClick();
  };

  const onXScopePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (guidedScopeActiveRef.current) return;
    if (!xScopeSelect || !onXScopeCommit || e.button !== 0 || n < 2) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    xScopeOriginRef.current = { x: e.clientX, y: e.clientY };
    xScopeDraggingRef.current = false;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = xViewFromClient(e.clientX, rect);
    const y = yViewFromClient(e.clientY, rect);
    const next = { a: x, b: x, y0: y, y };
    xDraftRef.current = next;
    setXDraft(next);
    clearHover();
  };

  const onXScopePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (guidedScopeActiveRef.current) return;
    if (!xScopeSelect || xDraftRef.current == null || !xScopeOriginRef.current) {
      return;
    }
    const dx = Math.abs(e.clientX - xScopeOriginRef.current.x);
    const dy = Math.abs(e.clientY - xScopeOriginRef.current.y);
    if (!xScopeDraggingRef.current && dx < X_SCOPE_DRAG_PX && dy < X_SCOPE_DRAG_PX) {
      return;
    }
    xScopeDraggingRef.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = xViewFromClient(e.clientX, rect);
    const y = yViewFromClient(e.clientY, rect);
    const next = {
      a: xDraftRef.current.a,
      b: x,
      y0: xDraftRef.current.y0,
      y,
    };
    xDraftRef.current = next;
    setXDraft(next);
  };

  const onXScopePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (guidedScopeActiveRef.current) return;
    if (!xScopeSelect || xDraftRef.current == null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = xViewFromClient(e.clientX, rect);
    const y = yViewFromClient(e.clientY, rect);
    const a = xDraftRef.current.a;
    const y0 = xDraftRef.current.y0;
    xDraftRef.current = null;
    setXDraft(null);
    xScopeOriginRef.current = null;

    if (!xScopeDraggingRef.current) {
      xScopeDraggingRef.current = false;
      return;
    }
    xScopeDraggingRef.current = false;
    if (!onXScopeCommit) return;

    let start = indexFromXView(Math.min(a, x));
    let end = indexFromXView(Math.max(a, x));
    if (end - start < X_SCOPE_MIN_SPAN) {
      const mid = Math.round((start + end) / 2);
      start = Math.max(0, mid - Math.floor(X_SCOPE_MIN_SPAN / 2));
      end = Math.min(n - 1, start + X_SCOPE_MIN_SPAN);
      start = Math.max(0, end - X_SCOPE_MIN_SPAN);
    }
    onXScopeCommit({
      start,
      end,
      yStartRatio: yCenterRatioFromView(y0),
      yEndRatio: yCenterRatioFromView(y),
    });
  };

  const onXScopePointerCancel = () => {
    xDraftRef.current = null;
    setXDraft(null);
    xScopeOriginRef.current = null;
    xScopeDraggingRef.current = false;
  };

  const onXScopeContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!xScopeSelect || !onXScopeBack) return;
    e.preventDefault();
    e.stopPropagation();
    onXScopeBack();
  };

  const onPlotContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if (onScaleEdgeNumericCommit) {
      const rect = e.currentTarget.getBoundingClientRect();
      const hit = hitDraggableScaleEdge(e.clientY, rect);
      if (hit) {
        e.preventDefault();
        e.stopPropagation();
        beginScaleEdgeEdit(hit.id);
        return;
      }
    }
    /**
     * 한계 이탈 데이터 카드가 떠 있을 때만 장비 바로가기.
     * 카드가 없으면 스코프 뒤로가기·설정모드 종료로 통과.
     */
    if (onBreachEquipmentNavigate) {
      const idx = hoverIdxRef.current;
      if (idx != null) {
        const target = resolveBreachNavTarget({
          series,
          envelopes,
          hoverIdx: idx,
          hoverSeriesName: hoverSeriesRef.current,
        });
        if (target) {
          e.preventDefault();
          e.stopPropagation();
          onBreachEquipmentNavigate(target);
          return;
        }
      }
    }
    // 설정모드 종료 등 — 스코프 뒤로가기와 분리 (동시 등록하지 않음)
    if (onPlotBackgroundContextMenu) {
      e.preventDefault();
      e.stopPropagation();
      onPlotBackgroundContextMenu();
      return;
    }
    if (xScopeSelect && onXScopeBack) onXScopeContextMenu(e);
  };

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (
      edgeEdit != null ||
      edgeDragRef.current != null ||
      labelDragArmRef.current != null ||
      xScopeDraggingRef.current ||
      xDraftRef.current != null
    )
      return;
    if (n === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const xPx = e.clientX - rect.left;
    const yPx = e.clientY - rect.top;

    /** 십자선 — 플롯 위에서는 마우스 기준 항상 표시 */
    const xView = Math.min(
      viewW - padR,
      Math.max(padL, (xPx / rect.width) * viewW),
    );
    const yView = Math.min(
      PAD_TOP + innerH,
      Math.max(PAD_TOP, (yPx / rect.height) * chartH),
    );
    setCrosshairAt(xView, yView);

    const hit = findDataPointHit(xPx, yPx, rect.width, rect.height);
    if (!hit) {
      if (hoverIdxRef.current != null || hoverSeriesRef.current != null) {
        hoverIdxRef.current = null;
        hoverSeriesRef.current = null;
        setHoverIdx(null);
        setHoverSeries(null);
      }
      return;
    }
    const anchorX = (hit.xView / viewW) * rect.width;
    const anchorY = (hit.yView / chartH) * rect.height;
    lastAnchorRef.current = {
      x: anchorX,
      y: anchorY,
      w: rect.width,
      h: rect.height,
    };
    placeTipNear(anchorX, anchorY, rect.width, rect.height);
    const same =
      hit.idx === hoverIdxRef.current &&
      hit.seriesKey === hoverSeriesRef.current;
    if (same) return;
    hoverIdxRef.current = hit.idx;
    hoverSeriesRef.current = hit.seriesKey;
    setHoverIdx(hit.idx);
    setHoverSeries(hit.seriesKey);
  };

  useLayoutEffect(() => {
    if (hoverIdx == null) return;
    const a = lastAnchorRef.current;
    placeTipNear(a.x, a.y, a.w, a.h);
  }, [hoverIdx]);

  const markerStride =
    markerDensity === "sparse" ? Math.max(1, Math.ceil(n / 8)) : 1;
  const shouldShowMarker = (i: number) => {
    if (markerDensity === "all") return true;
    if (i === 0 || i === n - 1) return true;
    return i % markerStride === 0;
  };

  const stackedAxis = labelGutter || (plotPx.w > 0 && plotPx.w < 480);
  const tickTarget = trendChartTickTargetForWidth(
    plotPx.w > 32 ? plotPx.w : labelGutter ? 360 : 800,
    { stacked: stackedAxis },
  );
  const axisMarks = useMemo(
    () => buildTrendAxisMarks(categories, tickTarget),
    [categories, tickTarget],
  );
  const axisTicks = axisMarks.majors;

  const axisTickViews = useMemo(() => {
    const last = axisTicks.length - 1;
    return axisTicks.map((mark, tickOrd) => {
      const prevLabel =
        tickOrd > 0 ? (axisTicks[tickOrd - 1]?.fullLabel ?? null) : null;
      const parts = period
        ? formatTrendAxisTickParts(period, mark.fullLabel, {
            endpoint: tickOrd === 0 || tickOrd === last,
            prevLabel,
            stacked: true,
          })
        : { date: null, time: mark.fullLabel };
      const xView = padL + mark.t * innerW;
      return {
        key: `${tickOrd}-${mark.fullLabel}`,
        fullLabel: mark.fullLabel,
        parts,
        leftPct: viewW > 0 ? (xView / viewW) * 100 : 0,
      };
    });
  }, [axisTicks, innerW, padL, period, viewW]);

  /** 알람/한계 점선 — 동일 axis·밴드 1회. */
  const uniqueAlarmBands = useMemo(() => {
    const seen = new Set<string>();
    const out: { band: Band; axis: TrendAxis }[] = [];
    for (const s of series) {
      if (!s.band) continue;
      const axis = s.axis ?? "left";
      const key = `${axis}:${s.band.lo}:${s.band.hi}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ band: s.band, axis });
    }
    return out;
  }, [series]);

  /** referenceLines 중 알람 band 모서리와 중복되는 점선 제거. */
  const dedupedReferenceLines = useMemo(() => {
    if (uniqueAlarmBands.length === 0) return referenceLines;
    return referenceLines.filter((ref) => {
      const axis = ref.axis ?? "left";
      return !uniqueAlarmBands.some(
        ({ band, axis: bandAxis }) =>
          bandAxis === axis &&
          (Math.abs(band.lo - ref.value) < 1e-6 ||
            Math.abs(band.hi - ref.value) < 1e-6),
      );
    });
  }, [referenceLines, uniqueAlarmBands]);

  const unitForAxis = (axis: TrendAxis) =>
    axis === "right" ? rightUnit : leftUnit;

  /**
   * 한계(점선) 끝단 라벨
   * - 단일 Y: 좌끝 / 이중 Y: 축별 좌·우끝 (상한 위선·하한 아래선)
   */
  const edgeBandLabels = useMemo(() => {
    if (mode !== "line") return [] as EdgeBandLabel[];
    const out: EdgeBandLabel[] = [];
    const seriesColorForAxis = (axis: TrendAxis): string | null => {
      const match = series.find((s) => (s.axis ?? "left") === axis);
      return match?.color ?? null;
    };
    const sideForLimit = (axis: TrendAxis): "left" | "right" => {
      if (usesRight) return axis === "right" ? "right" : "left";
      return "left";
    };
    const colorForLimit = (axis: TrendAxis): string => {
      if (usesRight) {
        return seriesColorForAxis(axis) ?? SEV_COLOR.warning;
      }
      return SEV_COLOR.warning;
    };
    uniqueAlarmBands.forEach(({ band, axis }, idx) => {
      const unit = unitForAxis(axis);
      const side = sideForLimit(axis);
      const color = colorForLimit(axis);
      for (const edge of ["hi", "lo"] as const) {
        const value = band[edge];
        const y = yFor(value, axis);
        if (!Number.isFinite(y)) continue;
        out.push({
          id: `alarm-${idx}-${axis}-${edge}-${value}`,
          side,
          topPct: (y / chartH) * 100,
          text: formatTrendBandEdge(value, unit),
          color,
          title: `한계 ${edge === "hi" ? "상한" : "하한"}`,
          mark: edge === "hi" ? "overline" : "underline",
        });
      }
    });
    for (const ref of dedupedReferenceLines) {
      if (ref.hideLabel) continue;
      const axis = ref.axis ?? "left";
      const y = yFor(ref.value, axis);
      if (!Number.isFinite(y)) continue;
      const [mn, mx] = axis === "right" ? [rMin, rMax] : [lMin, lMax];
      const mid = (mn + mx) / 2;
      out.push({
        id: `ref-${axis}-${ref.value}`,
        side: sideForLimit(axis),
        topPct: (y / chartH) * 100,
        text:
          ref.label?.trim() ||
          formatTrendBandEdge(ref.value, unitForAxis(axis)),
        color: usesRight
          ? seriesColorForAxis(axis) ?? ref.color
          : ref.color,
        title: "한계",
        mark: ref.value >= mid ? "overline" : "underline",
      });
    }
    for (const guide of scaleEdgeLabels) {
      if (guide.hideLabel) continue;
      const axis = guide.axis ?? "left";
      const y = yFor(guide.value, axis);
      if (!Number.isFinite(y)) continue;
      out.push({
        id: guide.id,
        side: guide.side ?? "right",
        topPct: (y / chartH) * 100,
        text: guide.text,
        leadingText: guide.leadingText,
        color: guide.color,
        title: guide.title ?? guide.text,
        mark: guide.mark,
        draggable: Boolean(guide.draggable),
        editValue: guide.editValue,
        labelLane: guide.labelLane ?? "outer",
        showApplyActions: Boolean(guide.showApplyActions),
      });
    }
    return nudgeEdgeLabelTops(out, 5.5);
    // yFor/chartH are stable for given domains+height
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yFor closes over domain/size
  }, [
    mode,
    usesRight,
    series,
    uniqueAlarmBands,
    dedupedReferenceLines,
    scaleEdgeLabels,
    leftUnit,
    rightUnit,
    chartH,
    lMin,
    lMax,
    rMin,
    rMax,
    innerH,
  ]);

  const edgeValueMaxCh = edgeBandLabels.reduce(
    (max, label) => Math.max(max, label.text.length),
    1,
  );

  if (!hasAny || n === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground"
        style={{ height }}
      >
        {emptyLabel}
      </div>
    );
  }

  /** Build polyline segments, breaking on null (gap shading). */
  const lineSegments = (s: TrendSeries): string[] => {
    const axis = s.axis ?? "left";
    const segs: string[] = [];
    let cur: string[] = [];
    s.data.forEach((v, i) => {
      if (v == null || !Number.isFinite(v)) {
        if (cur.length > 1) segs.push(cur.join(" "));
        cur = [];
        return;
      }
      cur.push(`${xFor(i).toFixed(2)},${yFor(v, axis).toFixed(2)}`);
    });
    if (cur.length > 1) segs.push(cur.join(" "));
    return segs;
  };

  /** 결측 구간 — 커버리지 밴드가 있으면 희소/통신두절/없음으로 대체. */
  const nullGapRanges: { i0: number; i1: number }[] = [];
  if (
    coverageBands.length === 0 &&
    showNullGaps &&
    mode === "line" &&
    series.length > 0
  ) {
    const ref =
      series.find((s) => s.name === "온도" || s.name.startsWith("온도")) ??
      series[0]!;
    let start: number | null = null;
    const isGapAt = (i: number) => {
      const v = ref.data[i];
      return v == null || !Number.isFinite(v);
    };
    const flush = (end: number) => {
      if (start == null) return;
      if (end - start + 1 >= 2) nullGapRanges.push({ i0: start, i1: end });
      start = null;
    };
    for (let i = 0; i < n; i++) {
      if (isGapAt(i)) {
        if (start == null) start = i;
      } else {
        flush(i - 1);
      }
    }
    flush(n - 1);
  }

  const envelopePaths = (env: TrendEnvelope): string[] => {
    const axis = env.axis ?? "left";
    if (env.polys?.length) {
      const paths: string[] = [];
      for (const run of env.polys) {
        if (run.length < 2) continue;
        const top = run.map(
          (p) =>
            `${xFor(p.x).toFixed(2)},${yFor(p.high, axis).toFixed(2)}`,
        );
        const bot = run.map(
          (p) =>
            `${xFor(p.x).toFixed(2)},${yFor(p.low, axis).toFixed(2)}`,
        );
        paths.push(`M${top.join(" L")} L${[...bot].reverse().join(" L")} Z`);
      }
      return paths;
    }
    const len = Math.min(env.high.length, env.low.length, n);
    if (len < 2) return [];
    const paths: string[] = [];
    let top: string[] = [];
    let bot: string[] = [];
    const flush = () => {
      if (top.length >= 2) {
        paths.push(`M${top.join(" L")} L${[...bot].reverse().join(" L")} Z`);
      }
      top = [];
      bot = [];
    };
    for (let i = 0; i < len; i++) {
      const hi = env.high[i];
      const lo = env.low[i];
      if (
        hi == null ||
        lo == null ||
        !Number.isFinite(hi) ||
        !Number.isFinite(lo)
      ) {
        flush();
        continue;
      }
      top.push(`${xFor(i).toFixed(2)},${yFor(hi, axis).toFixed(2)}`);
      bot.push(`${xFor(i).toFixed(2)},${yFor(lo, axis).toFixed(2)}`);
    }
    flush();
    return paths;
  };

  return (
    <div
      ref={chartRootRef}
      className={showLegend || legendTrailing ? "space-y-1.5" : "space-y-1"}
      data-trend-chart-root=""
    >
      {showLegend || legendTrailing ? (
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1.5"
        data-trend-chart-legend=""
      >
        {showLegend ? (() => {
          type LegendItem = {
            key: string;
            group: HoverMetricGroup;
            label: string;
            node: ReactNode;
          };
          const items: LegendItem[] = [];

          for (const s of series) {
            if (
              legendDensity !== "full" &&
              s.name !== "온도" &&
              s.name !== "습도"
            ) {
              continue;
            }
            items.push({
              key: `s-${s.name}`,
              group: inferHoverMetricGroup(s.name),
              label: s.name,
              node: (
                <span className="inline-flex items-center gap-1 farm-chart-fs-legend text-muted-foreground">
                  <span
                    className="inline-block w-3 border-t-2"
                    style={{
                      borderColor: s.color,
                      borderStyle: s.strokeDasharray
                        ? s.strokeDasharray.startsWith("2")
                          ? "dotted"
                          : "dashed"
                        : "solid",
                    }}
                    aria-hidden
                  />
                  {s.name}
                  {(s.axis ?? "left") === "right" && usesRight ? (
                    <span className="opacity-60">(우)</span>
                  ) : null}
                </span>
              ),
            });
          }

          if (legendDensity === "full") {
            envelopes.forEach((env, idx) => {
              if (!env.legendLabel) return;
              items.push({
                key: `env-${idx}`,
                group: inferHoverMetricGroup(env.legendLabel),
                label: env.legendLabel,
                node: (
                  <span className="inline-flex items-center gap-1 farm-chart-fs-legend text-muted-foreground">
                    <span
                      className="inline-block h-2 w-3 rounded-sm"
                      style={{
                        backgroundColor: env.fill,
                        opacity: Math.min(1, (env.fillOpacity ?? 0.22) * 2),
                      }}
                      aria-hidden
                    />
                    {env.legendLabel}
                  </span>
                ),
              });
            });
          }

          histograms.forEach((h, idx) => {
            if (!h.legendLabel) return;
            if (
              legendDensity !== "full" &&
              h.legendLabel !== "모터"
            ) {
              return;
            }
            items.push({
              key: `hist-${idx}`,
              group: inferHoverMetricGroup(h.legendLabel),
              label: h.legendLabel,
              node: (
                <span className="inline-flex items-center gap-1 farm-chart-fs-legend text-muted-foreground">
                  {h.style === "volume" ? (
                    <span
                      className="inline-block h-2 w-3 rounded-sm"
                      style={{ backgroundColor: h.colorUp, opacity: 0.85 }}
                      aria-hidden
                    />
                  ) : (
                    <span
                      className="inline-flex h-2 w-3 overflow-hidden rounded-sm"
                      aria-hidden
                    >
                      <span
                        className="h-full w-1/2"
                        style={{ backgroundColor: h.colorUp }}
                      />
                      <span
                        className="h-full w-1/2"
                        style={{ backgroundColor: h.colorDown }}
                      />
                    </span>
                  )}
                  {h.legendLabel}
                </span>
              ),
            });
          });

          const GROUP_ORDER: HoverMetricGroup[] = ["temp", "hum", "motor"];
          const GROUP_ARIA: Record<HoverMetricGroup, string> = {
            temp: "온도",
            hum: "습도",
            motor: "모터",
          };
          /** 그룹 안 표시 순서 */
          const LABEL_RANK: Record<HoverMetricGroup, string[]> = {
            temp: [
              "온도",
              "온도 추세",
              "온도 산포",
              "온도 편차",
              "온도 상한 접촉",
              "온도 하한 접촉",
            ],
            hum: [
              "습도",
              "습도 추세",
              "습도 산포",
              "습도 편차",
              "습도 상한 접촉",
              "습도 하한 접촉",
            ],
            motor: ["모터", "채널 A", "채널 B", "채널 C"],
          };
          const rank = (group: HoverMetricGroup, label: string) => {
            const i = LABEL_RANK[group].indexOf(label);
            return i >= 0 ? i : 50;
          };

          const coverageLegend = [
            { kind: "sparse" as const, label: "희소", fill: "var(--status-warn)", opacity: 0.55 },
            { kind: "offline" as const, label: "통신두절", fill: "var(--status-danger)", opacity: 0.55 },
            { kind: "void" as const, label: "없음", fill: "currentColor", opacity: 0.35 },
          ].filter((item) => coverageBands.some((b) => b.kind === item.kind));

          return (
            <>
              {GROUP_ORDER.map((group) => {
            const groupItems = items
              .filter((it) => it.group === group)
              .sort(
                (a, b) =>
                  rank(group, a.label) - rank(group, b.label) ||
                  a.label.localeCompare(b.label, "ko"),
              );
            if (groupItems.length === 0) return null;
            return (
              <div
                key={group}
                role="group"
                aria-label={GROUP_ARIA[group]}
                className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1"
                data-legend-group={group}
              >
                {groupItems.map((it) => (
                  <Fragment key={it.key}>{it.node}</Fragment>
                ))}
              </div>
            );
              })}
              {coverageLegend.length > 0 ? (
                <div
                  role="group"
                  aria-label="수신 상태"
                  className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1"
                >
                  {coverageLegend.map((item) => (
                    <span
                      key={item.kind}
                      className="inline-flex items-center gap-1 farm-chart-fs-legend text-muted-foreground"
                    >
                      <span
                        className="inline-block h-2 w-3 rounded-sm"
                        style={{
                          backgroundColor: item.fill,
                          opacity: item.opacity,
                        }}
                        aria-hidden
                      />
                      {item.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          );
        })() : null}
        {legendTrailing ? (
          <div className="ml-auto min-w-0 shrink-0">{legendTrailing}</div>
        ) : null}
      </div>
      ) : null}

      <div className="min-w-0">
      <div
        ref={plotRef}
        className={cn(
          "relative touch-none",
          edgeDragId
            ? "cursor-ns-resize"
            : xScopeSelect
              ? "cursor-crosshair"
              : "cursor-default",
        )}
        onMouseMove={onMove}
        onMouseLeave={() => {
          if (xDraftRef.current != null || edgeDragRef.current != null) return;
          clearHover();
        }}
        onPointerDown={onPlotPointerDown}
        onPointerMove={onPlotPointerMove}
        onPointerUp={onPlotPointerUp}
        onPointerCancel={onPlotPointerCancel}
        onDoubleClick={onPlotDoubleClickHandler}
        onContextMenu={onPlotContextMenu}
      >
      <svg
        viewBox={`0 0 ${viewW} ${chartH}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: chartH }}
        shapeRendering="geometricPrecision"
        role="img"
        aria-label="추이 차트"
      >
        <defs>
          <filter
            id={glowFilterId}
            x="-40%"
            y="-40%"
            width="180%"
            height="180%"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.35" />
          </filter>
        </defs>
        <g
          key={`${plotEnterKey}:${scopeMotionKey}`}
          className={cn(
            animate && scopeMotionKey === 0
              ? motionClass.farmChartPlotReveal
              : undefined,
            scopeMotionKey > 0
              ? scopeMotionDir === "out"
                ? motionClass.farmChartScopeZoomOut
                : motionClass.farmChartScopeZoomIn
              : undefined,
          )}
        >
        {coverageBands.map((g) => {
          const x0 = xFor(g.i0);
          const x1 = xFor(g.i1);
          const slot = n > 1 ? innerW / (n - 1) : innerW;
          const left = Math.max(padL, x0 - slot / 2);
          const right = Math.min(viewW - padR, x1 + slot / 2);
          const fill =
            g.kind === "sparse"
              ? "var(--status-warn)"
              : g.kind === "offline"
                ? "var(--status-danger)"
                : "currentColor";
          const fillOpacity =
            g.kind === "sparse" ? 0.16 : g.kind === "offline" ? 0.2 : 0.1;
          return (
            <rect
              key={`cov-${g.kind}-${g.i0}-${g.i1}`}
              x={left}
              y={PAD_TOP}
              width={Math.max(0.4, right - left)}
              height={innerH}
              fill={fill}
              fillOpacity={fillOpacity}
              stroke="none"
              className={g.kind === "void" ? "text-muted-foreground" : undefined}
            />
          );
        })}
        {nullGapRanges.map((g) => {
          const x0 = xFor(g.i0);
          const x1 = xFor(g.i1);
          const slot =
            n > 1 ? (innerW) / (n - 1) : innerW;
          const left = Math.max(padL, x0 - slot / 2);
          const right = Math.min(viewW - padR, x1 + slot / 2);
          return (
            <rect
              key={`null-gap-${g.i0}-${g.i1}`}
              x={left}
              y={PAD_TOP}
              width={Math.max(0.4, right - left)}
              height={innerH}
              fill="#64748b"
              fillOpacity={0.18}
              stroke="none"
            />
          );
        })}
        {splitBandGuides.map((gy, gi) => {
          if (!Number.isFinite(gy)) return null;
          const y = yFor(gy, "left");
          if (!Number.isFinite(y)) return null;
          return (
            <line
              key={`band-guide-${gi}-${gy}`}
              x1={padL}
              x2={viewW - padR}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeWidth={0.4}
              strokeDasharray="2.5 3"
              vectorEffect="non-scaling-stroke"
              className={cn("text-muted-foreground")}
              opacity={0.35}
            />
          );
        })}
        {mode === "line"
          ? histPresence.map(({ item: h, key: histKey, phase }) => {
              const yBase = yFor(h.baseline, "left");
              const slot =
                n > 1 ? (innerW) / (n - 1) : innerW;
              const isVolume = h.style === "volume";
              const isOverlay = h.style === "overlay";
              const gs = Math.max(1, h.groupSize ?? 1);
              const gi = h.groupIndex ?? 0;
              const barWHist = Math.max(
                0.22,
                slot *
                  (isVolume && gs > 1
                    ? 0.62 / gs
                    : isVolume
                      ? 0.5
                      : isOverlay
                        ? 0.28
                        : 0.55),
              );
              const cluster =
                isVolume && gs > 1
                  ? (gi - (gs - 1) / 2) * (barWHist + 0.12)
                  : 0;
              const opacity = h.fillOpacity ?? (isOverlay ? 0.14 : isVolume ? 0.7 : 0.75);
              return (
                <g
                  key={histKey}
                  className={clipWipeClass(phase)}
                  data-clip-phase={phase}
                >
                  {(!isVolume || gi === 0) &&
                  !isOverlay &&
                  Math.abs(yBase - (PAD_TOP + innerH)) > 0.6 ? (
                    <line
                      x1={padL}
                      x2={viewW - padR}
                      y1={yBase}
                      y2={yBase}
                      stroke="#94a3b8"
                      strokeWidth={0.4}
                      strokeDasharray={isVolume ? "1 2" : "1.5 1.5"}
                      vectorEffect="non-scaling-stroke"
                      opacity={isVolume ? 0.35 : 0.5}
                    />
                  ) : null}
                  {isOverlay ? (
                    <line
                      x1={padL}
                      x2={viewW - padR}
                      y1={yBase}
                      y2={yBase}
                      stroke="#f87171"
                      strokeWidth={0.55}
                      strokeDasharray="3 2.5"
                      vectorEffect="non-scaling-stroke"
                      opacity={0.55}
                    />
                  ) : null}
                  {h.values.map((v, i) => {
                    if (v == null || !Number.isFinite(v)) return null;
                    const yVal = yFor(v, "left");
                    const top = Math.min(yBase, yVal);
                    const height = Math.max(0.35, Math.abs(yVal - yBase));
                    const up = v >= h.baseline;
                    const barOp =
                      h.fillOpacityValues?.[i] != null &&
                      Number.isFinite(h.fillOpacityValues[i]!)
                        ? (h.fillOpacityValues[i] as number)
                        : opacity;
                    const hoverGroup = hoverSeries
                      ? inferHoverMetricGroup(hoverSeries)
                      : null;
                    const histGroup = inferHoverMetricGroup(
                      h.legendLabel ?? histKey,
                    );
                    const barFocused =
                      hoverIdx === i &&
                      (hoverGroup == null || hoverGroup === histGroup);
                    return (
                      <rect
                        key={`${histKey}-${i}`}
                        x={xFor(i) + cluster - barWHist / 2}
                        y={top}
                        width={barWHist}
                        height={height}
                        fill={
                          isVolume || up ? h.colorUp : h.colorDown
                        }
                        fillOpacity={barFocused ? Math.min(1, barOp + 0.28) : barOp}
                        stroke={barFocused ? (isVolume || up ? h.colorUp : h.colorDown) : "none"}
                        strokeWidth={barFocused ? 0.4 : 0}
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
                </g>
              );
            })
          : null}
        {mode === "line"
          ? envelopePresence.map(({ item: env, key: envKey, phase }) => {
              const paths = envelopePaths(env);
              if (!paths.length) return null;
              return (
                <g
                  key={envKey}
                  className={clipWipeClass(phase)}
                  data-clip-phase={phase}
                >
                  {paths.map((d, pi) => (
                    <path
                      key={`${envKey}-p${pi}`}
                      d={d}
                      fill={env.fill}
                      fillOpacity={env.fillOpacity ?? 0.22}
                      stroke="none"
                    />
                  ))}
                </g>
              );
            })
          : null}

        {mode === "line"
          ? uniqueAlarmBands.map(({ band, axis }, idx) => {
              const yTop = yFor(band.hi, axis);
              const yBot = yFor(band.lo, axis);
              return (
                <g key={`alarm-${idx}`}>
                  <line
                    x1={padL}
                    x2={viewW - padR}
                    y1={yTop}
                    y2={yTop}
                    stroke={SEV_COLOR.warning}
                    strokeWidth={0.5}
                    strokeDasharray="2 1.5"
                    strokeOpacity={0.65}
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1={padL}
                    x2={viewW - padR}
                    y1={yBot}
                    y2={yBot}
                    stroke={SEV_COLOR.warning}
                    strokeWidth={0.5}
                    strokeDasharray="2 1.5"
                    strokeOpacity={0.65}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })
          : null}

        {dedupedReferenceLines.map((ref, idx) => {
          const y = yFor(ref.value, ref.axis ?? "left");
          if (!Number.isFinite(y)) return null;
          return (
            <line
              key={`ref-${idx}`}
              x1={padL}
              x2={viewW - padR}
              y1={y}
              y2={y}
              stroke={ref.color}
              strokeWidth={0.5}
              strokeDasharray="2 1.5"
              vectorEffect="non-scaling-stroke"
              opacity={0.7}
            />
          );
        })}

        {scaleEdgeLabels
          .filter((g) => g.showLine)
          .map((guide) => {
            const y = yFor(guide.value, guide.axis ?? "left");
            if (!Number.isFinite(y)) return null;
            const dragging = edgeDragId === guide.id;
            const baseW = guide.lineStrokeWidth ?? 0.45;
            const dash =
              guide.lineDasharray === "solid" || guide.lineDasharray === ""
                ? undefined
                : (guide.lineDasharray ?? "1.5 2");
            return (
              <line
                key={`scale-guide-${guide.id}`}
                x1={padL}
                x2={viewW - padR}
                y1={y}
                y2={y}
                stroke={guide.color}
                strokeWidth={dragging ? baseW + 0.35 : baseW}
                strokeDasharray={dash}
                vectorEffect="non-scaling-stroke"
                opacity={dragging ? 0.95 : 0.7}
                pointerEvents="none"
              />
            );
          })}

        {mode === "bar"
          ? series.map((s, si) =>
              s.data.map((v, i) => {
                if (v == null || !Number.isFinite(v)) return null;
                const axis = s.axis ?? "left";
                const yTop = yFor(v, axis);
                const baseY = PAD_TOP + innerH;
                const gx = xForBar(i) - barSlotW / 2 + si * barW;
                return (
                  <rect
                    key={`${s.name}-${i}`}
                    x={gx}
                    y={yTop}
                    width={Math.max(0.4, barW * 0.92)}
                    height={Math.max(0, baseY - yTop)}
                    fill={s.color}
                    opacity={hoverIdx === i ? 1 : 0.85}
                  />
                );
              }),
            )
          : seriesPresence.map(({ item: s, key: seriesKey, phase }, si) => {
              const axis = s.axis ?? "left";
              const segs = lineSegments(s);
              const hoverGroup = hoverSeries
                ? inferHoverMetricGroup(hoverSeries)
                : null;
              const focused =
                hoverGroup == null ||
                inferHoverMetricGroup(s.name) === hoverGroup;
              const lineOpacity = focused ? 1 : 0.22;
              const strokeW = focused && hoverSeries ? 1.85 : 1.55;
              return (
                <g
                  key={seriesKey}
                  className={clipWipeClass(phase)}
                  data-clip-phase={phase}
                  style={{
                    opacity: lineOpacity,
                    transition: "opacity 120ms linear",
                  }}
                >
                  {segs.map((pts, idx) => (
                    <g key={idx}>
                      {!s.strokeDasharray ? (
                        <polyline
                          points={pts}
                          fill="none"
                          stroke={s.color}
                          strokeWidth={strokeW + 2.2}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                          filter={`url(#${glowFilterId})`}
                          className={motionClass.farmChartLineGlow}
                          opacity={focused ? 0.35 : 0.08}
                        />
                      ) : null}
                      <polyline
                        points={pts}
                        fill="none"
                        stroke={s.color}
                        strokeWidth={strokeW}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        strokeDasharray={s.strokeDasharray}
                        vectorEffect="non-scaling-stroke"
                      />
                    </g>
                  ))}
                  {showMarkers
                    ? s.data.map((v, i) => {
                        if (v == null || !Number.isFinite(v)) return null;
                        if (!shouldShowMarker(i)) return null;
                        const cx = xFor(i);
                        const cy = yFor(v, axis);
                        const rPx = markerRadiusPx;
                        const markerDelayMs =
                          120 +
                          si * motionStaggerStepMs +
                          Math.min(i, 8) * 16;
                        const markerStyle =
                          phase === "enter"
                            ? ({
                                ["--farm-chart-marker-delay" as string]:
                                  `${markerDelayMs}ms`,
                              } as CSSProperties)
                            : undefined;
                        const markerClass =
                          phase === "enter"
                            ? motionClass.farmChartMarkerPop
                            : undefined;
                        if (s.band) {
                          const sev = sevOfScore(severityScore(v, s.band));
                          if (sev !== "normal") {
                            return (
                              <ellipse
                                key={`${s.name}-sev-${i}`}
                                cx={cx}
                                cy={cy}
                                rx={markerRx(rPx)}
                                ry={markerRy(rPx)}
                                fill={SEV_COLOR[sev]}
                                className={markerClass}
                                style={markerStyle}
                              />
                            );
                          }
                        }
                        return (
                          <ellipse
                            key={`${s.name}-dot-${i}`}
                            cx={cx}
                            cy={cy}
                            rx={markerRx(rPx)}
                            ry={markerRy(rPx)}
                            fill={s.color}
                            className={markerClass}
                            style={markerStyle}
                          />
                        );
                      })
                    : null}
                </g>
              );
            })}

        {/* 호버 강조 — 링 펄스 + 코어 */}
        {mode === "line" && hoverIdx != null && hoverIdx >= 0 && hoverIdx < n
          ? series.map((s) => {
              const v = s.data[hoverIdx];
              if (v == null || !Number.isFinite(v)) return null;
              const axis = s.axis ?? "left";
              const isFocus =
                hoverSeries == null ||
                inferHoverMetricGroup(hoverSeries) ===
                  inferHoverMetricGroup(s.name);
              if (!isFocus) return null;
              const cx = xFor(hoverIdx);
              const cy = yFor(v, axis);
              return (
                <g key={`hover-${s.name}`}>
                  <ellipse
                    cx={cx}
                    cy={cy}
                    rx={markerRx(markerRadiusPx + 5)}
                    ry={markerRy(markerRadiusPx + 5)}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={1.1}
                    vectorEffect="non-scaling-stroke"
                    className={motionClass.farmChartHoverRing}
                  />
                  <ellipse
                    cx={cx}
                    cy={cy}
                    rx={markerRx(markerRadiusPx + 1.8)}
                    ry={markerRy(markerRadiusPx + 1.8)}
                    fill={s.color}
                    opacity={0.98}
                  />
                  <ellipse
                    cx={cx}
                    cy={cy}
                    rx={markerRx(markerRadiusPx * 0.45)}
                    ry={markerRy(markerRadiusPx * 0.45)}
                    fill="#fff"
                    opacity={0.9}
                  />
                </g>
              );
            })
          : null}
        {/* 고정 핀 강조 */}
        {mode === "line"
          ? pinnedTips.map((pin) => {
              if (pin.idx < 0 || pin.idx >= n) return null;
              const group = inferHoverMetricGroup(pin.seriesKey);
              return series.map((s) => {
                if (inferHoverMetricGroup(s.name) !== group) return null;
                const v = s.data[pin.idx];
                if (v == null || !Number.isFinite(v)) return null;
                const axis = s.axis ?? "left";
                const cx = xFor(pin.idx);
                const cy = yFor(v, axis);
                return (
                  <g key={`pin-${pin.id}-${s.name}`}>
                    <ellipse
                      cx={cx}
                      cy={cy}
                      rx={markerRx(markerRadiusPx + 6)}
                      ry={markerRy(markerRadiusPx + 6)}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={1.35}
                      vectorEffect="non-scaling-stroke"
                      opacity={0.95}
                    />
                    <ellipse
                      cx={cx}
                      cy={cy}
                      rx={markerRx(markerRadiusPx + 2)}
                      ry={markerRy(markerRadiusPx + 2)}
                      fill={s.color}
                      opacity={1}
                    />
                  </g>
                );
              });
            })
          : null}
        </g>

        {/* 마우스 기준 회색 십자선 — DOM 직접 갱신(리렌더 최소화) */}
        <line
          ref={crossVRef}
          x1={padL}
          x2={padL}
          y1={PAD_TOP}
          y2={PAD_TOP + innerH}
          stroke="#94a3b8"
          strokeWidth={0.7}
          strokeDasharray="2.5 2"
          vectorEffect="non-scaling-stroke"
          opacity={0}
          style={{ opacity: 0, transition: "opacity 90ms linear" }}
          pointerEvents="none"
        />
        <line
          ref={crossHRef}
          x1={padL}
          x2={viewW - padR}
          y1={PAD_TOP}
          y2={PAD_TOP}
          stroke="#94a3b8"
          strokeWidth={0.7}
          strokeDasharray="2.5 2"
          vectorEffect="non-scaling-stroke"
          opacity={0}
          style={{ opacity: 0, transition: "opacity 90ms linear" }}
          pointerEvents="none"
        />
        {(() => {
          const win = xDraft;
          if (win == null) return null;
          const x0 = win.a;
          const x1 = win.b;
          const y0 = win.y0;
          const y1 = win.y;
          const left = Math.min(x0, x1);
          const right = Math.max(x0, x1);
          const top = Math.min(y0, y1);
          const bot = Math.max(y0, y1);
          const w = Math.max(0.5, right - left);
          const rawH = bot - top;
          const h = Math.max(3.2, rawH);
          const yMid = (top + bot) / 2;
          const yBox = Math.min(
            PAD_TOP + innerH - h,
            Math.max(PAD_TOP, rawH < 3.2 ? yMid - h / 2 : top),
          );
          const rx = markerRx(4.2);
          const ry = markerRy(4.2);
          const rxEnd = markerRx(5);
          const ryEnd = markerRy(5);
          return (
            <g pointerEvents="none" aria-hidden>
              <rect
                x={left}
                y={yBox}
                width={w}
                height={h}
                fill="rgb(14 165 233)"
                fillOpacity={0.12}
                stroke="rgb(14 165 233)"
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
              />
              <rect
                className={motionClass.farmChartScopeHandlePulse}
                x={left}
                y={yBox}
                width={0.7}
                height={h}
                fill="rgb(56 189 248)"
                opacity={0.95}
              />
              <rect
                className={motionClass.farmChartScopeHandlePulse}
                x={right - 0.7}
                y={yBox}
                width={0.7}
                height={h}
                fill="rgb(56 189 248)"
                opacity={0.95}
              />
              <ellipse
                cx={x0}
                cy={y0}
                rx={rx}
                ry={ry}
                fill="rgb(14 165 233)"
                stroke="#fff"
                strokeWidth={0.35}
                vectorEffect="non-scaling-stroke"
              />
              <ellipse
                cx={x1}
                cy={y1}
                rx={rxEnd}
                ry={ryEnd}
                fill="#fff"
                stroke="rgb(14 165 233)"
                strokeWidth={0.55}
                vectorEffect="non-scaling-stroke"
              />
              <ellipse
                cx={x1}
                cy={y1}
                rx={markerRx(2)}
                ry={markerRy(2)}
                fill="rgb(14 165 233)"
              />
              <line
                x1={x0}
                y1={y0}
                x2={x1}
                y2={y1}
                stroke="rgb(14 165 233)"
                strokeWidth={0.35}
                strokeDasharray="1.2 1.2"
                vectorEffect="non-scaling-stroke"
                opacity={0.7}
              />
            </g>
          );
        })()}
      </svg>

      {viewW > 0
        ? coverageBands.map((g) => {
            const x0 = xFor(g.i0);
            const x1 = xFor(g.i1);
            const slot = n > 1 ? innerW / (n - 1) : innerW;
            const left = Math.max(padL, x0 - slot / 2);
            const right = Math.min(viewW - padR, x1 + slot / 2);
            const width = Math.max(0, right - left);
            if (width / viewW < 0.08 && g.i1 - g.i0 < 1) return null;
            const color =
              g.kind === "sparse"
                ? "var(--status-warn-ink)"
                : g.kind === "offline"
                  ? "var(--status-danger-ink)"
                  : undefined;
            return (
              <span
                key={`cov-lab-${g.kind}-${g.i0}-${g.i1}`}
                className="pointer-events-none absolute top-1 z-[1] truncate px-0.5 farm-chart-fs-axis tabular-nums"
                style={{
                  left: `${(left / viewW) * 100}%`,
                  width: `${(width / viewW) * 100}%`,
                  color: color ?? "var(--muted-foreground)",
                }}
              >
                {g.label}
              </span>
            );
          })
        : null}

      {leftAxisTicks.map((tick) => (
        <span
          key={tick.id}
          className={cn(
            "pointer-events-none absolute left-0.5 z-[1] -translate-y-1/2 rounded-sm bg-background/85 leading-none tabular-nums text-muted-foreground",
            labelGutter ? "px-1 py-0.5 farm-chart-fs-legend font-medium" : "px-0.5 farm-chart-fs-axis",
          )}
          style={{ top: `${tick.topPct}%` }}
          aria-hidden
        >
          {tick.text}
        </span>
      ))}

      {edgeBandLabels.map((label) => {
        const editing = edgeEdit?.id === label.id;
        const showActions =
          Boolean(label.showApplyActions) &&
          (onScaleEdgeApply != null || onScaleEdgeRevert != null);
        const valueText = (
          <span
            className="inline-block text-center tabular-nums"
            style={{ minWidth: `${edgeValueMaxCh}ch` }}
          >
            {label.text}
          </span>
        );
        return (
          <span
            key={label.id}
            className={cn(
              "absolute z-[2] -translate-y-1/2 rounded-sm bg-background/85 leading-none tabular-nums",
              labelGutter
                ? "min-h-7 px-1.5 py-1 text-xs font-semibold"
                : "px-0.5 farm-chart-fs-axis",
              showActions && "inline-flex items-center gap-0.5 pr-0",
              (editing || Boolean(label.leadingText)) &&
                "inline-flex items-center gap-1 whitespace-nowrap",
              Boolean(label.leadingText) &&
                !editing &&
                "shadow-sm ring-1 ring-current/20",
              label.draggable && !editing
                ? "pointer-events-auto cursor-ns-resize select-none"
                : editing || showActions
                  ? "pointer-events-auto"
                  : "pointer-events-none",
              label.side === "left" && "left-0.5 text-left",
              /** 설정 명칭 단독(레거시) — 수치 칩 바로 왼쪽 */
              label.side === "plotStart" &&
                "left-1/2 z-[3] -translate-x-[calc(100%+0.35rem)] text-right font-medium",
              /** 설정 수치 — 플롯 중앙 (leadingText 있으면 명칭+수치) */
              label.side === "center" &&
                "left-1/2 z-[3] -translate-x-1/2 text-center",
              /** 모바일 거터 — 우측 단일 열(큰 칩). PC는 기존 inner/outer 레인 */
              label.side === "right" &&
                labelGutter &&
                "right-1 max-w-[6.5rem] text-center",
              label.side === "right" &&
                !labelGutter &&
                label.labelLane === "inner" &&
                !showActions &&
                "right-11 text-center",
              label.side === "right" &&
                !labelGutter &&
                label.labelLane === "inner" &&
                showActions &&
                "right-1 text-center",
              label.side === "right" &&
                !labelGutter &&
                label.labelLane !== "inner" &&
                "right-0.5 text-center",
              !editing && label.mark === "overline" && "border-t border-current pt-px",
              !editing && label.mark === "underline" && "border-b border-current pb-px",
              edgeDragId === label.id &&
                (labelGutter ||
                label.side === "center" ||
                label.side === "plotStart"
                  ? "min-h-9 text-sm ring-2 ring-current/45"
                  : "ring-1 ring-current/40"),
            )}
            style={{ top: `${label.topPct}%`, color: label.color }}
            title={
              label.draggable
                ? `${label.title} · 드래그 조절 · 더블클릭(PC)·더블탭(모바일)·우클릭 숫자 입력`
                : label.title
            }
            onPointerDown={
              label.draggable && !editing
                ? (e) => {
                    if (e.button !== 0 || !plotRef.current) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const guide = scaleEdgeLabels.find((g) => g.id === label.id);
                    if (!guide?.draggable) return;
                    plotRef.current.setPointerCapture(e.pointerId);
                    labelDragArmRef.current = {
                      id: guide.id,
                      axis: guide.axis ?? "left",
                      value: guide.value,
                      x: e.clientX,
                      y: e.clientY,
                      pointerId: e.pointerId,
                      pointerType: e.pointerType,
                    };
                    clearHover();
                  }
                : undefined
            }
            onDoubleClick={
              label.draggable && onScaleEdgeNumericCommit
                ? (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    beginScaleEdgeEdit(label.id);
                  }
                : undefined
            }
            onContextMenu={
              label.draggable && onScaleEdgeNumericCommit
                ? (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    beginScaleEdgeEdit(label.id);
                  }
                : undefined
            }
          >
            {editing ? (
              <>
                {label.leadingText ? (
                  <span className="font-medium not-italic tracking-tight">
                    {label.leadingText}
                  </span>
                ) : null}
                <input
                  autoFocus
                  type="text"
                  inputMode="decimal"
                  aria-label={`${label.title} 숫자 입력`}
                  className={cn(
                    "rounded-sm border border-current/40 bg-background text-center tabular-nums outline-none",
                    labelGutter
                      ? "h-7 w-14 px-1 text-xs font-semibold"
                      : "h-4 w-10 px-0.5 farm-chart-fs-axis",
                  )}
                  style={{
                    color: label.color,
                    minWidth: `${edgeValueMaxCh}ch`,
                  }}
                  value={edgeEdit.text}
                  onChange={(e) =>
                    setEdgeEdit({ id: label.id, text: e.target.value })
                  }
                  onFocus={(e) => e.currentTarget.select()}
                  onBlur={() => commitScaleEdgeEdit()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitScaleEdgeEdit();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelScaleEdgeEdit();
                    }
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                />
                {parseScaleEdgeValueUnit(label.text) ? (
                  <span className="tabular-nums">
                    {parseScaleEdgeValueUnit(label.text)}
                  </span>
                ) : null}
              </>
            ) : label.leadingText ? (
              <>
                <span className="font-medium not-italic tracking-tight">
                  {label.leadingText}
                </span>
                {valueText}
              </>
            ) : (
              valueText
            )}
            {showActions ? (
              <span
                className="ml-0.5 inline-flex items-center gap-0.5"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                {onScaleEdgeApply ? (
                  <button
                    type="button"
                    aria-label="설정값 적용"
                    title="적용 (명령 전송)"
                    disabled={scaleEdgeApplyBusy || scaleEdgeApplyDisabled}
                    className={cn(
                      "inline-flex size-5 items-center justify-center rounded border border-current/35 bg-background/95",
                      "hover:bg-current/10 disabled:opacity-40",
                    )}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (scaleEdgeApplyBusy || scaleEdgeApplyDisabled) return;
                      onScaleEdgeApply();
                    }}
                  >
                    <Check className="size-3" strokeWidth={2.5} aria-hidden />
                  </button>
                ) : null}
                {onScaleEdgeRevert ? (
                  <button
                    type="button"
                    aria-label="설정값 되돌리기"
                    title="되돌리기"
                    disabled={scaleEdgeApplyBusy}
                    className={cn(
                      "inline-flex size-5 items-center justify-center rounded border border-current/35 bg-background/95",
                      "hover:bg-current/10 disabled:opacity-40",
                    )}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (scaleEdgeApplyBusy) return;
                      onScaleEdgeRevert();
                    }}
                  >
                    <RotateCcw className="size-3" strokeWidth={2.5} aria-hidden />
                  </button>
                ) : null}
              </span>
            ) : null}
          </span>
        );
      })}

      {pinnedTips.length > 0 ? (
        <svg
          className="pointer-events-none absolute inset-0 z-[15] h-full w-full overflow-visible"
          aria-hidden
        >
          {pinnedTips.map((pin) => {
            if (pin.idx < 0 || pin.idx >= n) return null;
            const plotW = plotPx.w || 1;
            const plotH = plotPx.h || 1;
            const anchorX = pin.nx * plotW;
            const anchorY = pin.ny * plotH;
            const base = computeTipPlacement(anchorX, anchorY, plotW, plotH);
            const left = base.left + pin.ox;
            const top = base.top + pin.oy;
            const attachX = left + 84;
            const attachY = top + 8;
            return (
              <g key={`pin-link-${pin.id}`}>
                <line
                  x1={anchorX}
                  y1={anchorY}
                  x2={attachX}
                  y2={attachY}
                  className="stroke-foreground/55"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                />
              </g>
            );
          })}
        </svg>
      ) : null}

      {pinnedTips.map((pin, pinOrd) => {
        if (pin.idx < 0 || pin.idx >= n) return null;
        const plotW = plotPx.w || 1;
        const plotH = plotPx.h || 1;
        const anchorX = pin.nx * plotW;
        const anchorY = pin.ny * plotH;
        const base = computeTipPlacement(anchorX, anchorY, plotW, plotH);
        const left = base.left + pin.ox;
        const top = base.top + pin.oy;
        return (
          <div
            key={pin.id}
            className={cn(
              "pointer-events-auto absolute w-max max-w-[16rem]",
              motionClass.farmChartTipIn,
            )}
            style={{ left, top, zIndex: 20 + pinOrd }}
            data-tour-id="trend-chart-pinned-card"
            data-pin-id={pin.id}
            onPointerDown={(e) => {
              e.stopPropagation();
              bringPinToFront(pin.id);
            }}
          >
            <div className="overflow-hidden rounded-md border border-border/80 bg-popover/95 text-popover-foreground shadow-lg backdrop-blur-sm">
              <div className="flex items-stretch border-b border-border/60 bg-muted/40">
                <button
                  type="button"
                  aria-label="데이터 카드 위치 이동"
                  title="드래그하여 배치"
                  className={cn(
                    "flex min-w-0 flex-1 cursor-grab items-center justify-center gap-1 px-2 py-1",
                    "active:cursor-grabbing touch-none select-none",
                  )}
                  onPointerDown={(e) => {
                    if (e.button !== 0 || !plotRef.current) return;
                    e.preventDefault();
                    e.stopPropagation();
                    plotRef.current.setPointerCapture(e.pointerId);
                    pinCardDragRef.current = {
                      id: pin.id,
                      pointerId: e.pointerId,
                      startX: e.clientX,
                      startY: e.clientY,
                      origOx: pin.ox,
                      origOy: pin.oy,
                    };
                  }}
                >
                  <GripHorizontal
                    className="size-3.5 text-muted-foreground"
                    aria-hidden
                  />
                </button>
                <button
                  type="button"
                  aria-label="데이터 카드 닫기"
                  title="닫기"
                  className={cn(
                    "inline-flex shrink-0 items-center justify-center border-l border-border/60 px-1.5",
                    "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setPinnedTips((prev) => prev.filter((p) => p.id !== pin.id));
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>
              <div className="px-2.5 py-1.5">
                <TrendPointCardBody
                  idx={pin.idx}
                  seriesKey={pin.seriesKey}
                  categories={categories}
                  series={series}
                  envelopes={envelopes}
                  histograms={histograms}
                  leftUnit={leftUnit}
                  rightUnit={rightUnit}
                  onBreachEquipmentNavigate={onBreachEquipmentNavigate}
                />
              </div>
            </div>
          </div>
        );
      })}

      {hoverIdx != null &&
      hoverIdx >= 0 &&
      hoverIdx < n &&
      !(
        hoverSeries != null &&
        pinnedTips.some((p) => p.id === tipPinId(hoverIdx, hoverSeries))
      ) ? (
        <div
          ref={tipRef}
          className="pointer-events-none absolute left-0 top-0 z-10 w-max max-w-[16rem]"
          style={{ opacity: 0, willChange: "transform" }}
          aria-live="polite"
          data-tour-id="trend-chart-hover-card"
        >
          <div
            className={cn(
              "rounded-md border border-border/80 bg-popover/95 px-2.5 py-1.5 text-popover-foreground shadow-lg backdrop-blur-sm",
              motionClass.farmChartTipIn,
            )}
          >
            {(() => {
              const band = coverageBands.find(
                (b) => hoverIdx >= b.i0 && hoverIdx <= b.i1,
              );
              return band ? (
                <p className="mb-1 farm-chart-fs-legend text-muted-foreground">
                  {band.label}
                </p>
              ) : null;
            })()}
            <TrendPointCardBody
              idx={hoverIdx}
              seriesKey={hoverSeries}
              categories={categories}
              series={series}
              envelopes={envelopes}
              histograms={histograms}
              leftUnit={leftUnit}
              rightUnit={rightUnit}
              onBreachEquipmentNavigate={onBreachEquipmentNavigate}
            />
          </div>
        </div>
      ) : null}
      </div>

      <div className="relative overflow-visible border-t border-border">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[1]" aria-hidden>
          {axisMarks.minors.map((t) => (
            <span
              key={`axis-minor-${t}`}
              className="absolute top-0 w-px h-1.5 -translate-x-1/2 bg-muted-foreground/30"
              style={{ left: `${viewW > 0 ? ((padL + t * innerW) / viewW) * 100 : 0}%` }}
            />
          ))}
          {axisTicks.map((m) => (
            <span
              key={`axis-major-${m.t}-${m.fullLabel}`}
              className="absolute top-0 w-px h-2 -translate-x-1/2 bg-muted-foreground/55"
              style={{
                left: `${viewW > 0 ? ((padL + m.t * innerW) / viewW) * 100 : 0}%`,
              }}
            />
          ))}
          <span
            className="absolute top-0 w-0.5 h-2.5 -translate-x-1/2 bg-muted-foreground/70"
            style={{
              left: `${viewW > 0 ? ((padL + innerW) / viewW) * 100 : 100}%`,
            }}
          />
        </div>
        <div className="relative farm-chart-tick-rail-stacked overflow-visible">
          {axisTickViews.map((v) =>
            v.parts.date ? (
              <span
                key={`tick-date-${v.key}`}
                className="pointer-events-none absolute top-0.5 -translate-x-1/2 text-center farm-chart-fs-axis leading-none text-muted-foreground tabular-nums whitespace-nowrap"
                style={{ left: `${v.leftPct}%` }}
              >
                {v.parts.date}
              </span>
            ) : null,
          )}
          {axisTickViews.map((v) =>
            v.parts.time ? (
              <span
                key={`tick-time-${v.key}`}
                className="pointer-events-none absolute bottom-0.5 -translate-x-1/2 text-center farm-chart-fs-axis leading-none text-muted-foreground tabular-nums whitespace-nowrap"
                style={{ left: `${v.leftPct}%` }}
                title={v.fullLabel}
              >
                {v.parts.time}
              </span>
            ) : null,
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
