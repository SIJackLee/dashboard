import type { BarnReading } from "@/lib/data/iot";
import {
  formatStallTypeLabel,
  normalizeStallTyCode,
  stallTyCodeSortKey,
} from "@/lib/data/stall-type";

export type PigEnvFit = "ok" | "high" | "low" | "none";

export type PigEnvBand = {
  stallTyCode: string;
  stageLabel: string;
  tempMinC: number;
  tempMaxC: number;
  humidityMinPct: number;
  humidityMaxPct: number;
};

export type PigEnvTypeVerdict = {
  stallTyCode: string;
  stallLabel: string;
  stageLabel: string;
  tempMinC: number;
  tempMaxC: number;
  humidityMinPct: number;
  humidityMaxPct: number;
  tempAvgC: number | null;
  humidityAvgPct: number | null;
  tempFit: PigEnvFit;
  humidityFit: PigEnvFit;
  recommendTempC: number | null;
  recommendHumidityPct: number | null;
};

/** 한국 양돈 생육 권장 온·습도. 축사유형 → 표의 행. 분만사는 모돈 구역. */
const PIG_ENV_BAND_BY_TYPE: Record<string, Omit<PigEnvBand, "stallTyCode">> = {
  SP01: {
    stageLabel: "임신돈",
    tempMinC: 16,
    tempMaxC: 21,
    humidityMinPct: 50,
    humidityMaxPct: 60,
  },
  SP02: {
    stageLabel: "임신돈",
    tempMinC: 16,
    tempMaxC: 21,
    humidityMinPct: 50,
    humidityMaxPct: 60,
  },
  SP03: {
    stageLabel: "분만·포유모돈",
    tempMinC: 18,
    tempMaxC: 21,
    humidityMinPct: 50,
    humidityMaxPct: 60,
  },
  SP04: {
    stageLabel: "이유자돈",
    tempMinC: 25,
    tempMaxC: 28,
    humidityMinPct: 60,
    humidityMaxPct: 80,
  },
  SP05: {
    stageLabel: "자돈·육성 초기",
    tempMinC: 18,
    tempMaxC: 22,
    humidityMinPct: 50,
    humidityMaxPct: 80,
  },
  SP06: {
    stageLabel: "육성·비육돈",
    tempMinC: 15,
    tempMaxC: 20,
    humidityMinPct: 40,
    humidityMaxPct: 60,
  },
  SP07: {
    stageLabel: "육성·비육돈",
    tempMinC: 15,
    tempMaxC: 20,
    humidityMinPct: 40,
    humidityMaxPct: 60,
  },
  SP08: {
    stageLabel: "육성·비육돈",
    tempMinC: 15,
    tempMaxC: 20,
    humidityMinPct: 40,
    humidityMaxPct: 60,
  },
  SP09: {
    stageLabel: "종모돈",
    tempMinC: 16,
    tempMaxC: 21,
    humidityMinPct: 50,
    humidityMaxPct: 60,
  },
};

export function pigEnvBandForStallTy(
  stallTyCode: string | null | undefined,
): PigEnvBand | null {
  const code = normalizeStallTyCode(stallTyCode);
  const row = PIG_ENV_BAND_BY_TYPE[code];
  if (!row) return null;
  return { stallTyCode: code, ...row };
}

export function pigEnvFitToBand(
  value: number | null | undefined,
  min: number,
  max: number,
): PigEnvFit {
  if (value == null || !Number.isFinite(value)) return "none";
  if (value < min) return "low";
  if (value > max) return "high";
  return "ok";
}

/** 띠 안이면 현재값, 밖이면 가장 가까운 가장자리. */
export function pigEnvRecommendInBand(
  value: number | null | undefined,
  min: number,
  max: number,
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const clamped = Math.min(max, Math.max(min, value));
  return Math.round(clamped * 10) / 10;
}

export function pigEnvFitLabel(fit: PigEnvFit): string {
  if (fit === "high") return "높음";
  if (fit === "low") return "낮음";
  if (fit === "ok") return "적정";
  return "측정 없음";
}

export function pigEnvFitOffBand(fit: PigEnvFit): boolean {
  return fit === "high" || fit === "low";
}

function avg1(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

export function pigEnvVerdictForAverages(args: {
  stallTyCode: string;
  stallLabel?: string;
  tempAvgC: number | null;
  humidityAvgPct: number | null;
}): PigEnvTypeVerdict | null {
  const band = pigEnvBandForStallTy(args.stallTyCode);
  if (!band) return null;
  const stallLabel =
    args.stallLabel?.trim() || formatStallTypeLabel(band.stallTyCode);
  return {
    stallTyCode: band.stallTyCode,
    stallLabel,
    stageLabel: band.stageLabel,
    tempMinC: band.tempMinC,
    tempMaxC: band.tempMaxC,
    humidityMinPct: band.humidityMinPct,
    humidityMaxPct: band.humidityMaxPct,
    tempAvgC: args.tempAvgC,
    humidityAvgPct: args.humidityAvgPct,
    tempFit: pigEnvFitToBand(args.tempAvgC, band.tempMinC, band.tempMaxC),
    humidityFit: pigEnvFitToBand(
      args.humidityAvgPct,
      band.humidityMinPct,
      band.humidityMaxPct,
    ),
    recommendTempC: pigEnvRecommendInBand(
      args.tempAvgC,
      band.tempMinC,
      band.tempMaxC,
    ),
    recommendHumidityPct: pigEnvRecommendInBand(
      args.humidityAvgPct,
      band.humidityMinPct,
      band.humidityMaxPct,
    ),
  };
}

export function pigEnvTypeVerdicts(
  readings: Pick<
    BarnReading,
    "stallTyCode" | "tempC" | "humidityPct"
  >[],
): PigEnvTypeVerdict[] {
  const byTy = new Map<
    string,
    { temps: number[]; hums: number[] }
  >();
  for (const r of readings) {
    const code = normalizeStallTyCode(r.stallTyCode);
    if (!pigEnvBandForStallTy(code)) continue;
    let g = byTy.get(code);
    if (!g) {
      g = { temps: [], hums: [] };
      byTy.set(code, g);
    }
    if (r.tempC != null && Number.isFinite(r.tempC)) g.temps.push(r.tempC);
    if (r.humidityPct != null && Number.isFinite(r.humidityPct)) {
      g.hums.push(r.humidityPct);
    }
  }
  return [...byTy.entries()]
    .map(([code, g]) =>
      pigEnvVerdictForAverages({
        stallTyCode: code,
        tempAvgC: avg1(g.temps),
        humidityAvgPct: avg1(g.hums),
      }),
    )
    .filter((v): v is PigEnvTypeVerdict => v != null)
    .sort(
      (a, b) =>
        stallTyCodeSortKey(a.stallTyCode) - stallTyCodeSortKey(b.stallTyCode),
    );
}

export function pigEnvVerdictOffBand(v: PigEnvTypeVerdict): boolean {
  return pigEnvFitOffBand(v.tempFit) || pigEnvFitOffBand(v.humidityFit);
}

export function pigEnvWorstVerdict(
  verdicts: PigEnvTypeVerdict[],
): PigEnvTypeVerdict | null {
  return verdicts.find(pigEnvVerdictOffBand) ?? verdicts[0] ?? null;
}

/** 화면 맥락이 한 유형이면 그 유형만. 없으면 농장 전체. */
export function pigEnvFocusReadings<
  T extends Pick<BarnReading, "stallTyCode">,
>(readings: T[], stallTyCode?: string | null): T[] {
  const code = normalizeStallTyCode(stallTyCode);
  if (!code || code === "UNK") return readings;
  return readings.filter(
    (r) => normalizeStallTyCode(r.stallTyCode) === code,
  );
}

export type PigEnvAdviceCopy = {
  offBand: boolean;
  stallLabel: string | null;
  summary: string;
  detail: string | null;
};

function fmtTempSpoken(n: number): string {
  const t = Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
  return `${t}도`;
}

function fmtPctSpoken(n: number): string {
  return `${Math.round(n)}%`;
}

/** 뱃지 말풍선 — 내부 코드·영문 필드 없음. */
export function pigEnvAdviceCopy(
  verdicts: PigEnvTypeVerdict[],
): PigEnvAdviceCopy {
  const worst = pigEnvWorstVerdict(verdicts);
  if (!worst) {
    return {
      offBand: false,
      stallLabel: null,
      summary: "권장 환경으로 볼 축사유형이 없습니다.",
      detail: null,
    };
  }
  if (!pigEnvVerdictOffBand(worst)) {
    return {
      offBand: false,
      stallLabel: worst.stallLabel,
      summary: "축사유형별 권장 온·습도 안에 있습니다.",
      detail: null,
    };
  }
  const parts: string[] = [];
  if (pigEnvFitOffBand(worst.tempFit) && worst.tempAvgC != null) {
    const rec =
      worst.recommendTempC != null
        ? ` 목표는 ${fmtTempSpoken(worst.recommendTempC)}입니다`
        : "";
    parts.push(
      `${worst.stallLabel} 온도 ${fmtTempSpoken(worst.tempAvgC)}로 권장 ${fmtTempSpoken(worst.tempMinC)}에서 ${fmtTempSpoken(worst.tempMaxC)}보다 ${pigEnvFitLabel(worst.tempFit)}입니다${rec}`,
    );
  }
  if (pigEnvFitOffBand(worst.humidityFit) && worst.humidityAvgPct != null) {
    const rec =
      worst.recommendHumidityPct != null
        ? ` 목표는 ${fmtPctSpoken(worst.recommendHumidityPct)}입니다`
        : "";
    parts.push(
      `${worst.stallLabel} 습도 ${fmtPctSpoken(worst.humidityAvgPct)}로 권장 ${fmtPctSpoken(worst.humidityMinPct)}에서 ${fmtPctSpoken(worst.humidityMaxPct)}보다 ${pigEnvFitLabel(worst.humidityFit)}입니다${rec}`,
    );
  }
  return {
    offBand: true,
    stallLabel: worst.stallLabel,
    summary: `${worst.stallLabel} 권장 온·습도를 벗어났습니다.`,
    detail: parts.length ? `${parts.join(". ")}.` : null,
  };
}
