/**
 * DELIN U2 — 답변 → 차트 집계 딥링크 · 근거 칩.
 * AI 문장과 분리: facts + session만으로 결정.
 */
import type {
  ChartTrendZoomHint,
  FarmChartScope,
} from "@/lib/farm/farm-chart-scope";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import type { VoiceFarmFacts } from "@/lib/voice-report/types";

export type DelinChartHandoff = {
  /** CTA 짧은 라벨 */
  ctaLabel: string;
  scope: FarmChartScope;
  /**
   * P2 — 차트 탭 진입 시 Y밴드 포커스.
   * FARM/CTRL handoff는 온도 레인 스코프를 기본으로 연다.
   */
  focusMetric?: "temp" | "hum" | "motor";
  /** period 내 상대 구간(0–1). 생략 시 전체 */
  xRange?: { startRatio: number; endRatio: number };
};

/** handoff → URL 줌 힌트 */
export function zoomHintFromDelinHandoff(
  handoff: DelinChartHandoff,
): ChartTrendZoomHint | null {
  if (!handoff.focusMetric) return null;
  return {
    yBands: [handoff.focusMetric],
    startRatio: handoff.xRange?.startRatio ?? 0,
    endRatio: handoff.xRange?.endRatio ?? 1,
  };
}

export type DelinAnswerExtras = {
  evidenceChips: string[];
  chartHandoff: DelinChartHandoff | null;
};

function resolveStallTyCode(
  facts: VoiceFarmFacts,
  focus: string | null | undefined,
): string | null {
  const raw = focus?.trim();
  if (!raw) return null;
  if (/^[A-Z]{2}\d+/i.test(raw)) return normalizeStallTyCode(raw);
  const hit = facts.stalls.find(
    (s) =>
      s.stallLabel === raw ||
      s.stallLabel.includes(raw) ||
      raw.includes(s.stallLabel),
  );
  return hit ? normalizeStallTyCode(hit.stallTyCode) : null;
}

function scopeCtaLabel(scope: FarmChartScope, spLabel?: string): string {
  if (scope.level === "farm") return "차트에서 보기";
  if (scope.level === "sp") {
    return `차트 · ${spLabel ?? formatSpFallback(scope.stallTyCode)}`;
  }
  if (scope.level === "stall") {
    return `차트 · ${spLabel ?? formatSpFallback(scope.stallTyCode)} ${scope.stallNo}번`;
  }
  return "차트 · 해당 컨트롤러";
}

function formatSpFallback(code: string): string {
  return normalizeStallTyCode(code);
}

/**
 * FARM/CTRL 답변에 차트 handoff · 근거 칩.
 * CHAT·facts 없음 → handoff null, chips 비움.
 */
export function buildDelinAnswerExtras(opts: {
  route: "CHAT" | "FARM" | "CTRL" | null | undefined;
  facts: VoiceFarmFacts | null | undefined;
  focusStallType?: string | null;
  focusStallNo?: string | null;
}): DelinAnswerExtras {
  const { route, facts } = opts;
  if (!facts || route === "CHAT" || !route) {
    return { evidenceChips: [], chartHandoff: null };
  }

  const chips: string[] = [];
  if (facts.alarmCritical > 0) chips.push(`위험 ${facts.alarmCritical}`);
  if (facts.alarmWarning > 0) chips.push(`주의 ${facts.alarmWarning}`);
  if (facts.offlineControllers > 0) {
    chips.push(`통신 ${facts.offlineControllers}`);
  }
  if (chips.length < 3) {
    const top = [...facts.stalls]
      .filter((s) => s.alarmCount > 0)
      .sort((a, b) => b.alarmCount - a.alarmCount)[0];
    if (top) chips.push(top.stallLabel);
  }
  if (route === "CTRL" && chips.length < 3) chips.push("현장 추천");

  const evidenceChips = chips.slice(0, 3);

  const spCode = resolveStallTyCode(facts, opts.focusStallType);
  const stallNo = opts.focusStallNo?.trim() || null;
  const spMeta = spCode
    ? facts.stalls.find(
        (s) => normalizeStallTyCode(s.stallTyCode) === spCode,
      )
    : undefined;

  let scope: FarmChartScope = { level: "farm" };

  if (spCode) {
    const alarms = facts.alarmItems.filter((a) => {
      const aSp = facts.stalls.find((s) => s.stallLabel === a.stallLabel);
      const code = aSp
        ? normalizeStallTyCode(aSp.stallTyCode)
        : resolveStallTyCode(facts, a.stallLabel);
      if (code !== spCode) return false;
      if (stallNo && (a.stallNo ?? "").trim() !== stallNo) return false;
      return true;
    });

    if (stallNo) {
      const ctrlHit =
        alarms.length === 1
          ? alarms[0]
          : alarms.find((a) => (a.stallNo ?? "").trim() === stallNo);
      if (ctrlHit?.controllerKey) {
        scope = {
          level: "controller",
          stallTyCode: spCode,
          stallNo,
          controllerKey: ctrlHit.controllerKey,
        };
      } else {
        scope = { level: "stall", stallTyCode: spCode, stallNo };
      }
    } else if (alarms.length === 1 && alarms[0]?.stallNo?.trim()) {
      const a = alarms[0]!;
      scope = {
        level: "controller",
        stallTyCode: spCode,
        stallNo: a.stallNo!.trim(),
        controllerKey: a.controllerKey,
      };
    } else {
      scope = { level: "sp", stallTyCode: spCode };
    }
  } else if (facts.alarmItems.length === 1) {
    const a = facts.alarmItems[0]!;
    const code =
      resolveStallTyCode(facts, a.stallLabel) ??
      facts.stalls.find((s) => s.stallLabel === a.stallLabel)?.stallTyCode;
    const sn = (a.stallNo ?? "").trim();
    if (code && sn && a.controllerKey) {
      scope = {
        level: "controller",
        stallTyCode: normalizeStallTyCode(code),
        stallNo: sn,
        controllerKey: a.controllerKey,
      };
    }
  }

  return {
    evidenceChips,
    chartHandoff: {
      ctaLabel: scopeCtaLabel(scope, spMeta?.stallLabel),
      scope,
      /** P2 — 온도 레인 스코프 진입 */
      focusMetric: "temp",
    },
  };
}
