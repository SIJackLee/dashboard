import type { BarnReading } from "@/lib/data/iot";
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

export const DEFAULT_FARM_CHART_SCOPE: FarmChartScope = { level: "farm" };

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
