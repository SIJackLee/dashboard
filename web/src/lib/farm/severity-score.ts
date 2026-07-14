/**
 * 정규화 심각도 점수 유틸 — 그리드 그래프 모드(편차 스택 바)용.
 *
 * 단위가 다른 지표(온도 ℃ / 습도 % / 팬 %)를 하나의 축에서 비교하기 위해
 * 각 지표를 자기 밴드 [lo, hi] 기준의 정규화 편차 점수 s 로 환산한다.
 *
 *   center = (lo + hi) / 2
 *   half   = (hi - lo) / 2
 *   s      = |value - center| / half     // 0 = 밴드 중심, 1 = 밴드 경계
 *
 *   정상: s <= 0.85 · 주의: 0.85 < s <= 1 · 경고: s > 1
 *
 * 밴드 소스:
 *   온도 = thermo.setpointTemp ± tempDeviation (없으면 알람 tempLow~tempHigh)
 *   습도 = 알람 humidityLow ~ humidityHigh
 *   팬   = thermo.minVentPct ~ maxVentPct (없으면 자기 이력 통계 밴드로 폴백)
 */

import type { AlarmThresholds } from "@/lib/data/alarms";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";

export type Sev = "normal" | "caution" | "warning";

export const S_CAP = 1.5;
export const S_CAUTION = 0.85;
export const S_WARNING = 1.0;

export type Band = { lo: number; hi: number };

export function bandCenter(b: Band): number {
  return (b.lo + b.hi) / 2;
}

export function bandHalf(b: Band): number {
  return Math.max(0.001, (b.hi - b.lo) / 2);
}

/** 정규화 편차 점수. 값/밴드가 유효하지 않으면 null. */
export function severityScore(value: number | null | undefined, band: Band | null): number | null {
  if (value == null || !Number.isFinite(value) || !band) return null;
  return Math.abs(value - bandCenter(band)) / bandHalf(band);
}

export function sevOfScore(s: number | null): Sev {
  if (s == null) return "normal";
  if (s <= S_CAUTION) return "normal";
  if (s <= S_WARNING) return "caution";
  return "warning";
}

export function worstSev(sevs: Sev[]): Sev {
  let w: Sev = "normal";
  for (const s of sevs) {
    if (s === "warning") return "warning";
    if (s === "caution") w = "caution";
  }
  return w;
}

const EXCESS_SPAN = S_CAP - S_CAUTION;

/** 정상 초과분 비율 0~1 (스택 바 세그먼트 높이용). 정상=0, 밴드 경계 이상=커짐. */
export function excessRatio(s: number | null): number {
  if (s == null) return 0;
  return Math.min(1, Math.max(0, (s - S_CAUTION) / EXCESS_SPAN));
}

/* ---------- 표시 해상도 집계(다운샘플) ----------
 * 원본 버킷(예: 24h=96)을 그래프 표시 막대 수(bars, 예: 24)로 묶는다.
 * 하이브리드 렌더: 막대 높이는 binMean(추세), 색은 binWorst(구간 내 최악=짧은 이상 보존).
 * 입력/출력은 심각도 점수(number|null). null(결측)은 제외, 전부 결측이면 null.
 */

export function binMean(scores: (number | null)[], bars: number): (number | null)[] {
  const n = scores.length;
  if (!bars || bars >= n) return scores.slice();
  const g = Math.ceil(n / bars);
  const out: (number | null)[] = [];
  for (let i = 0; i < n; i += g) {
    let sum = 0;
    let cnt = 0;
    for (let j = i; j < Math.min(n, i + g); j++) {
      const v = scores[j];
      if (v != null && Number.isFinite(v)) {
        sum += v;
        cnt++;
      }
    }
    out.push(cnt > 0 ? sum / cnt : null);
  }
  return out;
}

export function binWorst(scores: (number | null)[], bars: number): (number | null)[] {
  const n = scores.length;
  if (!bars || bars >= n) return scores.slice();
  const g = Math.ceil(n / bars);
  const out: (number | null)[] = [];
  for (let i = 0; i < n; i += g) {
    let m: number | null = null;
    for (let j = i; j < Math.min(n, i + g); j++) {
      const v = scores[j];
      if (v != null && Number.isFinite(v)) m = m == null ? v : Math.max(m, v);
    }
    out.push(m);
  }
  return out;
}

/* ---------- 밴드 빌더 ---------- */

export function tempBand(
  thermo: Pick<ControllerThermoSettings, "setpointTemp" | "tempDeviation"> | null,
  thresholds: AlarmThresholds
): Band {
  if (thermo && Number.isFinite(thermo.setpointTemp) && Number.isFinite(thermo.tempDeviation) && thermo.tempDeviation > 0) {
    return { lo: thermo.setpointTemp - thermo.tempDeviation, hi: thermo.setpointTemp + thermo.tempDeviation };
  }
  return { lo: thresholds.tempLow, hi: thresholds.tempHigh };
}

export function humidityBand(thresholds: AlarmThresholds): Band {
  return { lo: thresholds.humidityLow, hi: thresholds.humidityHigh };
}

/** 팬 밴드 = 최저~최고 환기. 설정이 없거나 폭이 0이면 null(→ 통계 폴백). */
export function fanBand(
  thermo: Pick<ControllerThermoSettings, "minVentPct" | "maxVentPct"> | null
): Band | null {
  if (!thermo) return null;
  const { minVentPct, maxVentPct } = thermo;
  if (!Number.isFinite(minVentPct) || !Number.isFinite(maxVentPct)) return null;
  if (maxVentPct <= minVentPct) return null;
  return { lo: minVentPct, hi: maxVentPct };
}

/**
 * 통계 폴백 밴드 — thermo 결측 시 자기 이력(중앙값 ± 2σ) 기준.
 * 표본이 부족하거나 변동이 거의 없으면 null(→ 심각도 판정 보류 = 정상 처리).
 */
export function statBand(values: (number | null | undefined)[]): Band | null {
  const xs = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (xs.length < 4) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const mean = xs.reduce((sum, v) => sum + v, 0) / xs.length;
  const variance = xs.reduce((sum, v) => sum + (v - mean) ** 2, 0) / xs.length;
  const std = Math.sqrt(variance);
  const halfWidth = Math.max(std * 2, Math.abs(median) * 0.15, 1);
  return { lo: median - halfWidth, hi: median + halfWidth };
}
