import type { BarnReading } from "@/lib/data/iot";
import { buildAlarmScopeKey } from "@/lib/data/alarm-scope";
import { farmKeyId } from "@/lib/data/farm-key";
import {
  compareStallNo,
  stallKeyFromReading,
} from "@/lib/data/reading-hierarchy";
import {
  formatStallTypeLabel,
  normalizeStallTyCode,
  stallTyCodeSortKey,
} from "@/lib/data/stall-type";
import {
  formatControllerNoLabel,
} from "@/lib/farm/controller-summary-display";
import { normalizeEqpmnNo } from "@/lib/data/controller-key";

/** 차트 탭 집계 범위 — 기본은 선택 농장 전체 */
export type FarmChartScope =
  | { level: "farm" }
  | { level: "sp"; stallTyCode: string }
  | { level: "stall"; stallTyCode: string; stallNo: string }
  | {
      level: "controller";
      stallTyCode: string;
      stallNo: string;
      controllerKey: string;
    };

export type FarmChartControllerScope = Extract<
  FarmChartScope,
  { level: "controller" }
>;

export type FarmChartWidgetSlotId = "w1" | "w2";

export type FarmChartWidgetSlots = {
  w1: FarmChartControllerScope | null;
  w2: FarmChartControllerScope | null;
};

export const DEFAULT_FARM_CHART_SCOPE: FarmChartScope = { level: "farm" };

export function isFarmChartControllerScope(
  scope: FarmChartScope,
): scope is FarmChartControllerScope {
  return scope.level === "controller";
}

export type FarmChartTreeController = {
  controllerKey: string;
  eqpmnNo: string;
  label: string;
};

export type FarmChartTreeStall = {
  stallNo: string;
  label: string;
  controllers: FarmChartTreeController[];
};

export type FarmChartTreeSp = {
  stallTyCode: string;
  label: string;
  stalls: FarmChartTreeStall[];
  controllerCount: number;
};

export function filterReadingsByChartScope(
  readings: BarnReading[],
  scope: FarmChartScope,
): BarnReading[] {
  if (scope.level === "farm") return readings;
  const ty = normalizeStallTyCode(scope.stallTyCode);
  return readings.filter((r) => {
    if (normalizeStallTyCode(r.stallTyCode) !== ty) return false;
    if (scope.level === "sp") return true;
    const stallKey = stallKeyFromReading(r);
    if (stallKey !== scope.stallNo.trim()) return false;
    if (scope.level === "stall") return true;
    return r.controllerKey === scope.controllerKey;
  });
}

/**
 * 차트 집계 범위 → 알람 byScope 키.
 * 농장 전체 = farm만, 유형/축사/컨트롤러는 설정 패널과 동일 계층.
 */
export function alarmScopeKeyFromFarmChartScope(
  readings: BarnReading[],
  scope: FarmChartScope,
): string | null {
  const farmId = readings[0] ? farmKeyId(readings[0].farmKey) : "";
  if (!farmId) return null;
  if (scope.level === "farm") {
    return buildAlarmScopeKey({ farmId });
  }
  const sp = normalizeStallTyCode(scope.stallTyCode);
  if (scope.level === "sp") {
    return buildAlarmScopeKey({ farmId, sp });
  }
  if (scope.level === "stall") {
    return buildAlarmScopeKey({
      farmId,
      sp,
      stall: scope.stallNo.trim(),
    });
  }
  const hit = readings.find((r) => r.controllerKey === scope.controllerKey);
  const stall =
    scope.stallNo.trim() || (hit ? stallKeyFromReading(hit) : "");
  if (!stall) return null;
  return buildAlarmScopeKey({
    farmId,
    sp,
    stall,
    controllerKey: scope.controllerKey,
  });
}

export function chartScopeLabel(
  scope: FarmChartScope,
  readings: BarnReading[] = [],
): string {
  if (scope.level === "farm") return "농장 전체";
  const tyLabel = formatStallTypeLabel(scope.stallTyCode);
  if (scope.level === "sp") return tyLabel;
  if (scope.level === "stall") {
    return `${tyLabel} · ${scope.stallNo}번 축사`;
  }
  const hit = readings.find((r) => r.controllerKey === scope.controllerKey);
  if (hit) {
    return `${tyLabel} · ${formatControllerNoLabel(hit.eqpmnNo)}`;
  }
  return `${tyLabel} · ${scope.stallNo}번 · 컨트롤러`;
}

/** readings → 축사유형 → 축사번호 → 컨트롤러 트리 */
export function buildFarmChartTree(readings: BarnReading[]): FarmChartTreeSp[] {
  const bySp = new Map<
    string,
    Map<string, Map<string, BarnReading>>
  >();

  for (const r of readings) {
    const ty = normalizeStallTyCode(r.stallTyCode);
    const stall = stallKeyFromReading(r);
    let stallMap = bySp.get(ty);
    if (!stallMap) {
      stallMap = new Map();
      bySp.set(ty, stallMap);
    }
    let ctrlMap = stallMap.get(stall);
    if (!ctrlMap) {
      ctrlMap = new Map();
      stallMap.set(stall, ctrlMap);
    }
    ctrlMap.set(r.controllerKey, r);
  }

  const sps = [...bySp.entries()].sort(
    (a, b) =>
      stallTyCodeSortKey(a[0]) - stallTyCodeSortKey(b[0]) ||
      a[0].localeCompare(b[0]),
  );

  return sps.map(([stallTyCode, stallMap]) => {
    const stallEntries = [...stallMap.entries()].sort((a, b) =>
      compareStallNo(
        a[0].startsWith("__") ? null : a[0],
        b[0].startsWith("__") ? null : b[0],
      ),
    );
    const stalls: FarmChartTreeStall[] = stallEntries.map(
      ([stallNo, ctrlMap]) => {
        const controllers = [...ctrlMap.values()]
          .sort((a, b) =>
            normalizeEqpmnNo(a.eqpmnNo).localeCompare(
              normalizeEqpmnNo(b.eqpmnNo),
              "ko",
              { numeric: true },
            ),
          )
          .map((r) => ({
            controllerKey: r.controllerKey,
            eqpmnNo: r.eqpmnNo,
            label: formatControllerNoLabel(r.eqpmnNo),
          }));
        return {
          stallNo,
          label: stallNo.startsWith("__")
            ? "축사 미지정"
            : `${stallNo}번 축사`,
          controllers,
        };
      },
    );
    return {
      stallTyCode,
      label: formatStallTypeLabel(stallTyCode),
      stalls,
      controllerCount: stalls.reduce((n, s) => n + s.controllers.length, 0),
    };
  });
}

/** 모델 입구 차트 — 농장 전체를 막고 해당 축사 유형으로 고정 */
export function clampChartScopeToType(
  scope: FarmChartScope,
  stallTyCode: string,
): FarmChartScope {
  const ty = normalizeStallTyCode(stallTyCode);
  if (!ty) return { level: "farm" };
  if (scope.level === "farm") return { level: "sp", stallTyCode: ty };
  if (normalizeStallTyCode(scope.stallTyCode) !== ty) {
    return { level: "sp", stallTyCode: ty };
  }
  return scope;
}

export function filterFarmChartTreeByType(
  tree: FarmChartTreeSp[],
  stallTyCode: string,
): FarmChartTreeSp[] {
  const ty = normalizeStallTyCode(stallTyCode);
  if (!ty) return tree;
  return tree.filter((sp) => normalizeStallTyCode(sp.stallTyCode) === ty);
}

export function scopesEqual(a: FarmChartScope, b: FarmChartScope): boolean {
  if (a.level !== b.level) return false;
  switch (a.level) {
    case "farm":
      return true;
    case "sp":
      return b.level === "sp" && a.stallTyCode === b.stallTyCode;
    case "stall":
      return (
        b.level === "stall" &&
        a.stallTyCode === b.stallTyCode &&
        a.stallNo === b.stallNo
      );
    case "controller":
      return (
        b.level === "controller" &&
        a.stallTyCode === b.stallTyCode &&
        a.stallNo === b.stallNo &&
        a.controllerKey === b.controllerKey
      );
  }
}

/** 차트 집계 딥링크 — 맵 drill(`sp`/`stall`)과 분리 */
export const CHART_SP_PARAM = "chartSp";
export const CHART_STALL_PARAM = "chartStall";
export const CHART_CTRL_PARAM = "chartCtrl";
/** P2 — 통합 추이 Y밴드 포커스 (temp|hum|motor, +로 복수). 레거시 `command`는 명령 패널로 해석 */
export const CHART_Y_BAND_PARAM = "chartYBand";
/** P2 — 현재 period 카테고리 상대 구간 0–1 */
export const CHART_X0_PARAM = "chartX0";
export const CHART_X1_PARAM = "chartX1";
/** 컨트롤러 집계에서 명령 이력 전용 차트. `1`이면 켬 */
export const CHART_CMD_PARAM = "chartCmd";
/** 차트 위젯 칸 — 컨트롤러 단건 추이. `-`는 빈 칸(집계 딥링크 재시드 방지) */
export const CHART_W1_PARAM = "chartW1";
export const CHART_W2_PARAM = "chartW2";
export const CHART_WIDGET_EMPTY = "-";
/** 집계 트리 → 위젯 칸 HTML5 DnD */
export const CHART_WIDGET_DND_TYPE = "application/x-farm-chart-widget";

export type ChartYBandId =
  | "temp"
  | "hum"
  | "motor"
  | "command"
  | "overlay";

export type ChartTrendZoomHint = {
  yBands: ChartYBandId[];
  /** 0–1, period 내 상대. 생략 시 전체 */
  startRatio: number;
  endRatio: number;
  /**
   * 다운샘플 카테고리 절대 인덱스 (DELIN 가이드 커밋용).
   * 있으면 비율→인덱스 재변환보다 이걸 우선.
   */
  startIndex?: number;
  endIndex?: number;
};

export function clearFarmChartScopeParams(params: URLSearchParams): void {
  params.delete(CHART_SP_PARAM);
  params.delete(CHART_STALL_PARAM);
  params.delete(CHART_CTRL_PARAM);
}

export function clearFarmChartZoomParams(params: URLSearchParams): void {
  params.delete(CHART_Y_BAND_PARAM);
  params.delete(CHART_X0_PARAM);
  params.delete(CHART_X1_PARAM);
}

export function clearFarmChartCmdParam(params: URLSearchParams): void {
  params.delete(CHART_CMD_PARAM);
}

export function clearFarmChartWidgetParams(params: URLSearchParams): void {
  params.delete(CHART_W1_PARAM);
  params.delete(CHART_W2_PARAM);
}

export function encodeChartWidgetSlot(
  scope: FarmChartControllerScope,
): string {
  return [
    normalizeStallTyCode(scope.stallTyCode),
    scope.stallNo.trim(),
    scope.controllerKey,
  ].join("|");
}

export function parseChartWidgetSlot(
  raw: string | null | undefined,
): FarmChartControllerScope | null {
  if (!raw?.trim() || raw.trim() === CHART_WIDGET_EMPTY) return null;
  const decoded = safeDecodeCtrl(raw.trim());
  const i1 = decoded.indexOf("|");
  const i2 = decoded.indexOf("|", i1 + 1);
  if (i1 < 0 || i2 < 0) return null;
  const stallTyCode = normalizeStallTyCode(decoded.slice(0, i1));
  const stallNo = decoded.slice(i1 + 1, i2).trim();
  const controllerKey = decoded.slice(i2 + 1).trim();
  if (!stallTyCode || !stallNo || !controllerKey) return null;
  return { level: "controller", stallTyCode, stallNo, controllerKey };
}

/**
 * URL → 위젯 두 칸.
 * chartW*가 하나도 없고 집계가 컨트롤러면 위칸에 시드(필드「차트에서 보기」·옛 딥링크).
 */
export function resolveFarmChartWidgetSlots(
  params: URLSearchParams,
): FarmChartWidgetSlots {
  const w1Raw = params.get(CHART_W1_PARAM);
  const w2Raw = params.get(CHART_W2_PARAM);
  const explicit = w1Raw != null || w2Raw != null;
  let w1 = parseChartWidgetSlot(w1Raw);
  let w2 = parseChartWidgetSlot(w2Raw);
  if (!explicit) {
    const scope = resolveFarmChartScope(params);
    if (isFarmChartControllerScope(scope)) w1 = scope;
  }
  if (w1 && w2 && scopesEqual(w1, w2)) w2 = null;
  return { w1, w2 };
}

export function applyFarmChartWidgetSlotParams(
  params: URLSearchParams,
  slots: FarmChartWidgetSlots,
): void {
  params.set(
    CHART_W1_PARAM,
    slots.w1 ? encodeChartWidgetSlot(slots.w1) : CHART_WIDGET_EMPTY,
  );
  params.set(
    CHART_W2_PARAM,
    slots.w2 ? encodeChartWidgetSlot(slots.w2) : CHART_WIDGET_EMPTY,
  );
}

export function placeFarmChartWidget(
  slots: FarmChartWidgetSlots,
  target: FarmChartWidgetSlotId,
  ctrl: FarmChartControllerScope,
): FarmChartWidgetSlots {
  const next: FarmChartWidgetSlots = { ...slots, [target]: ctrl };
  const other: FarmChartWidgetSlotId = target === "w1" ? "w2" : "w1";
  if (next[other] && scopesEqual(next[other]!, ctrl)) next[other] = null;
  return next;
}

/**
 * 위칸이 비면 위칸, 차 있으면 아래칸.
 * 이미 들어 있는 컨트롤러면 칸을 바꾸지 않는다.
 */
export function placeFarmChartWidgetNext(
  slots: FarmChartWidgetSlots,
  ctrl: FarmChartControllerScope,
): FarmChartWidgetSlots {
  if (slots.w1 && scopesEqual(slots.w1, ctrl)) return slots;
  if (slots.w2 && scopesEqual(slots.w2, ctrl)) return slots;
  if (!slots.w1) return placeFarmChartWidget(slots, "w1", ctrl);
  return placeFarmChartWidget(slots, "w2", ctrl);
}

/**
 * 칸 세로 배분. PC는 항상 남은 높이를 반씩(빈 칸 포함).
 * 모바일은 한 칸만 차 있으면 그 그래프가 남는 높이를 쓰고, 빈 칸은 짧게 둔다.
 */
export type FarmChartWidgetSlotGrow = "equal" | "rest" | "compact";

export function farmChartWidgetSlotGrow(
  isMobileStack: boolean,
  thisFilled: boolean,
  otherFilled: boolean,
): FarmChartWidgetSlotGrow {
  if (!isMobileStack) return "equal";
  if (thisFilled && !otherFilled) return "rest";
  if (!thisFilled && otherFilled) return "compact";
  return "equal";
}

export function parseChartWidgetDragPayload(
  raw: string | null | undefined,
): FarmChartControllerScope | null {
  if (!raw?.trim()) return null;
  try {
    const data = JSON.parse(raw) as Partial<FarmChartControllerScope>;
    if (data.level !== "controller") return null;
    const stallTyCode = normalizeStallTyCode(data.stallTyCode ?? "");
    const stallNo = (data.stallNo ?? "").trim();
    const controllerKey = (data.controllerKey ?? "").trim();
    if (!stallTyCode || !stallNo || !controllerKey) return null;
    return { level: "controller", stallTyCode, stallNo, controllerKey };
  } catch {
    return parseChartWidgetSlot(raw);
  }
}

export function yBandsWithoutCommand(
  bands: ChartYBandId[] | null | undefined,
): ChartYBandId[] | null {
  if (!bands?.length) return null;
  const next = bands.filter((b) => b !== "command");
  return next.length > 0 ? next : null;
}

/** 명령 이력 전용 차트. `chartCmd=1` 또는 레거시 chartYBand의 command */
export function resolveFarmChartCmdParam(params: URLSearchParams): boolean {
  const raw = params.get(CHART_CMD_PARAM)?.trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "on") return true;
  const yBands = parseYBandsParam(params.get(CHART_Y_BAND_PARAM));
  return Boolean(yBands?.includes("command"));
}

export function applyFarmChartCmdParam(
  params: URLSearchParams,
  open: boolean,
): void {
  if (open) params.set(CHART_CMD_PARAM, "1");
  else params.delete(CHART_CMD_PARAM);
}

function parseYBandsParam(raw: string | null): ChartYBandId[] | null {
  if (!raw?.trim()) return null;
  const allowed = new Set<string>([
    "temp",
    "hum",
    "motor",
    "command",
    "overlay",
  ]);
  const bands = raw
    .split(/[+,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is ChartYBandId => allowed.has(s));
  return bands.length > 0 ? bands : null;
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

/** URL → 추이 줌 힌트 (집계 scope와 독립). 명령은 chartCmd로 분리. */
export function resolveFarmChartZoomHint(
  params: URLSearchParams,
): ChartTrendZoomHint | null {
  const yBands = yBandsWithoutCommand(
    parseYBandsParam(params.get(CHART_Y_BAND_PARAM)),
  );
  const x0Raw = params.get(CHART_X0_PARAM);
  const x1Raw = params.get(CHART_X1_PARAM);
  let startRatio = 0;
  let endRatio = 1;
  let hasX = false;
  if (x0Raw != null && x1Raw != null) {
    const a = clamp01(Number(x0Raw));
    const b = clamp01(Number(x1Raw));
    if (Number.isFinite(a) && Number.isFinite(b)) {
      startRatio = Math.min(a, b);
      endRatio = Math.max(a, b);
      if (endRatio - startRatio < 0.04) {
        endRatio = Math.min(1, startRatio + 0.04);
      }
      hasX = true;
    }
  }
  if (!yBands && !hasX) return null;
  return { yBands: yBands ?? [], startRatio, endRatio };
}

export function applyFarmChartZoomParams(
  params: URLSearchParams,
  zoom: ChartTrendZoomHint | null,
): void {
  const migrateCmd = Boolean(zoom?.yBands.includes("command"));
  const measureBands = yBandsWithoutCommand(zoom?.yBands ?? null);
  clearFarmChartZoomParams(params);
  if (migrateCmd) applyFarmChartCmdParam(params, true);
  if (!zoom || !measureBands || measureBands.length === 0) {
    if (zoom && (zoom.startRatio > 0.001 || zoom.endRatio < 0.999)) {
      params.set(CHART_X0_PARAM, zoom.startRatio.toFixed(3));
      params.set(CHART_X1_PARAM, zoom.endRatio.toFixed(3));
    }
    return;
  }
  params.set(CHART_Y_BAND_PARAM, measureBands.join("+"));
  if (zoom.startRatio > 0.001 || zoom.endRatio < 0.999) {
    params.set(CHART_X0_PARAM, zoom.startRatio.toFixed(3));
    params.set(CHART_X1_PARAM, zoom.endRatio.toFixed(3));
  }
}

/**
 * E — 스코프 스택 항목 → URL 줌 힌트.
 * Y밴드가 없으면 null (시간 줌만은 chartYBand에 안 씀).
 */
export function chartScopeEntryToZoomHint(
  entry: {
    start: number;
    end: number;
    yBands: ChartYBandId[] | null;
  } | null,
  categoryCount: number,
): ChartTrendZoomHint | null {
  const measureBands = yBandsWithoutCommand(entry?.yBands);
  if (!measureBands?.length || categoryCount < 2) return null;
  const denom = categoryCount - 1;
  const start = Math.max(0, Math.min(entry!.start, entry!.end));
  const end = Math.min(categoryCount - 1, Math.max(entry!.start, entry!.end));
  return {
    yBands: [...measureBands],
    startRatio: clamp01(start / denom),
    endRatio: clamp01(end / denom),
    startIndex: start,
    endIndex: end,
  };
}

/** URL → 집계 범위. 불완전/빈 값은 가능한 상위 레벨로 완화. */
export function resolveFarmChartScope(
  params: URLSearchParams,
): FarmChartScope {
  const spRaw = params.get(CHART_SP_PARAM)?.trim() ?? "";
  const stallRaw = params.get(CHART_STALL_PARAM)?.trim() ?? "";
  const ctrlRaw = params.get(CHART_CTRL_PARAM)?.trim() ?? "";
  if (!spRaw) return DEFAULT_FARM_CHART_SCOPE;

  const stallTyCode = normalizeStallTyCode(spRaw);
  if (ctrlRaw && stallRaw) {
    return {
      level: "controller",
      stallTyCode,
      stallNo: stallRaw,
      controllerKey: safeDecodeCtrl(ctrlRaw),
    };
  }
  if (stallRaw) {
    return { level: "stall", stallTyCode, stallNo: stallRaw };
  }
  return { level: "sp", stallTyCode };
}

function safeDecodeCtrl(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** 집계 범위 → URL. farm 레벨이면 chart* 제거. */
export function applyFarmChartScopeParams(
  params: URLSearchParams,
  scope: FarmChartScope,
): void {
  clearFarmChartScopeParams(params);
  if (scope.level === "farm") return;
  params.set(CHART_SP_PARAM, normalizeStallTyCode(scope.stallTyCode));
  if (scope.level === "sp") return;
  params.set(CHART_STALL_PARAM, scope.stallNo.trim());
  if (scope.level === "stall") return;
  params.set(CHART_CTRL_PARAM, encodeURIComponent(scope.controllerKey));
}
