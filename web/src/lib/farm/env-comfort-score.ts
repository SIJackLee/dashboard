import type { AlarmThresholds } from "@/lib/data/alarms";

/**
 * 구간 내 연속 양호도 (B안).
 * 중심=100 · 경계≈60 · 이탈 시 half-width 추가 구간에서 0으로 감점.
 */
export function dimensionComfortScore(
  value: number,
  low: number,
  high: number,
): number | null {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(low) ||
    !Number.isFinite(high) ||
    high <= low
  ) {
    return null;
  }
  const mid = (low + high) / 2;
  const half = (high - low) / 2;
  const dist = Math.abs(value - mid);
  if (dist <= half) {
    return 100 - 40 * (dist / half);
  }
  const over = dist - half;
  return Math.max(0, 60 * (1 - over / half));
}

/** 온도·습도 점수 평균. 한쪽만 있으면 그 값. 모터 제외. */
export function envComfortScore(
  tempC: number | null | undefined,
  humidityPct: number | null | undefined,
  thresholds: AlarmThresholds,
): number | null {
  const scores: number[] = [];
  if (tempC != null && Number.isFinite(tempC)) {
    const s = dimensionComfortScore(
      tempC,
      thresholds.tempLow,
      thresholds.tempHigh,
    );
    if (s != null) scores.push(s);
  }
  if (humidityPct != null && Number.isFinite(humidityPct)) {
    const s = dimensionComfortScore(
      humidityPct,
      thresholds.humidityLow,
      thresholds.humidityHigh,
    );
    if (s != null) scores.push(s);
  }
  if (!scores.length) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/** 점수 → 브러시 막대 색 (양호→주의→불량) */
export function comfortScoreToColor(score: number): string {
  const s = Math.max(0, Math.min(100, score));
  if (s >= 75) {
    const t = (s - 75) / 25;
    return lerpHex("#34d399", "#10b981", t);
  }
  if (s >= 45) {
    const t = (s - 45) / 30;
    return lerpHex("#fbbf24", "#34d399", t);
  }
  const t = s / 45;
  return lerpHex("#f43f5e", "#fbbf24", t);
}

/** 브러시·팝업용 구간 라벨 (색 임계와 동일) */
export function comfortScoreBandLabel(
  score: number,
): "양호" | "주의" | "이탈" {
  const s = Math.max(0, Math.min(100, score));
  if (s >= 75) return "양호";
  if (s >= 45) return "주의";
  return "이탈";
}

function lerpHex(a: string, b: string, t: number): string {
  const u = Math.max(0, Math.min(1, t));
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa.r + (pb.r - pa.r) * u);
  const g = Math.round(pa.g + (pb.g - pa.g) * u);
  const bl = Math.round(pa.b + (pb.b - pa.b) * u);
  return `rgb(${r} ${g} ${bl})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
  };
}
