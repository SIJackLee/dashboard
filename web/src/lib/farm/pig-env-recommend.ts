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
  /** 조언 단계: 통신두절 > 장비경보 > 권장표 이탈 > 적정 > 대상 없음 */
  tier: PigEnvAdviceTier;
  /** 접힌 뱃지 숫자 — 통신두절 대수 · 경보 대수 · 이탈 축사유형 수. 적정은 0. */
  noticeCount: number;
  stallLabel: string | null;
  summary: string;
  /** 말풍선 목록 — 축사유형 1줄. 화면은 최대 `PIG_ENV_ADVICE_LIST_CAP`. */
  items: string[];
  /** items를 이은 호환 문장. 화면은 items를 쓴다. */
  detail: string | null;
};

/** 말풍선에 바로 보여줄 유형 줄 수. 나머지는 「외 N건」. */
export const PIG_ENV_ADVICE_LIST_CAP = 3;

export function pigEnvAdviceListPreview(
  items: string[],
  cap = PIG_ENV_ADVICE_LIST_CAP,
): { shown: string[]; extraCount: number } {
  const limit = Math.max(0, cap);
  const shown = items.slice(0, limit);
  return {
    shown,
    extraCount: Math.max(0, items.length - shown.length),
  };
}

function withAdviceItems(
  base: Omit<PigEnvAdviceCopy, "items" | "detail">,
  items: string[],
): PigEnvAdviceCopy {
  return {
    ...base,
    items,
    detail: items.length ? `${items.join(". ")}.` : null,
  };
}

export type PigEnvAdviceTier =
  | "offline"
  | "alarm"
  | "offband"
  | "ok"
  | "none";

/** 장비 경보 안전망 임계 (권장표와 별개, 임계는 바꾸지 않는다). */
export const PIG_ENV_SAFETY = {
  tempHighC: 35,
  tempLowC: 10,
  humidityHighPct: 90,
  humidityLowPct: 30,
} as const;

export type PigEnvSafetyHit = {
  kind: "tempHigh" | "tempLow" | "humidityHigh" | "humidityLow";
  value: number;
  limit: number;
};

/** 안전망 임계 초과 1건 (온도 우선, 상한 우선). 없으면 null. */
export function pigEnvSafetyHit(
  reading: Pick<BarnReading, "tempC" | "humidityPct">,
): PigEnvSafetyHit | null {
  const t = reading.tempC;
  if (t != null && Number.isFinite(t)) {
    if (t >= PIG_ENV_SAFETY.tempHighC) {
      return { kind: "tempHigh", value: t, limit: PIG_ENV_SAFETY.tempHighC };
    }
    if (t <= PIG_ENV_SAFETY.tempLowC) {
      return { kind: "tempLow", value: t, limit: PIG_ENV_SAFETY.tempLowC };
    }
  }
  const h = reading.humidityPct;
  if (h != null && Number.isFinite(h)) {
    if (h >= PIG_ENV_SAFETY.humidityHighPct) {
      return {
        kind: "humidityHigh",
        value: h,
        limit: PIG_ENV_SAFETY.humidityHighPct,
      };
    }
    if (h <= PIG_ENV_SAFETY.humidityLowPct) {
      return {
        kind: "humidityLow",
        value: h,
        limit: PIG_ENV_SAFETY.humidityLowPct,
      };
    }
  }
  return null;
}

function pigEnvSafetyRank(hit: PigEnvSafetyHit): number {
  // 온도 경보를 습도보다, 이탈 폭이 클수록 우선.
  const dev = Math.abs(hit.value - hit.limit);
  const base =
    hit.kind === "tempHigh" || hit.kind === "tempLow" ? 1000 : 0;
  return base + dev;
}

function fmtTempSpoken(n: number): string {
  const t = Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
  return `${t}도`;
}

function fmtPctSpoken(n: number): string {
  return `${Math.round(n)}%`;
}

function pigEnvOffBandRank(v: PigEnvTypeVerdict): number {
  let score = 0;
  if (pigEnvFitOffBand(v.tempFit) && v.tempAvgC != null) {
    const d =
      v.tempFit === "high"
        ? v.tempAvgC - v.tempMaxC
        : v.tempMinC - v.tempAvgC;
    score += 1000 + Math.max(0, d);
  }
  if (pigEnvFitOffBand(v.humidityFit) && v.humidityAvgPct != null) {
    const d =
      v.humidityFit === "high"
        ? v.humidityAvgPct - v.humidityMaxPct
        : v.humidityMinPct - v.humidityAvgPct;
    score += Math.max(0, d);
  }
  return score;
}

/** 이탈 유형 1줄. 온·습이 같이 벗어나면 한 줄에 이음. 내부 코드 없음. */
function pigEnvTypeOffLine(v: PigEnvTypeVerdict): string {
  const parts: string[] = [];
  if (pigEnvFitOffBand(v.tempFit) && v.tempAvgC != null) {
    parts.push(
      `온도 ${fmtTempSpoken(v.tempAvgC)}(권장 ${fmtTempSpoken(v.tempMinC)}~${fmtTempSpoken(v.tempMaxC)})`,
    );
  }
  if (pigEnvFitOffBand(v.humidityFit) && v.humidityAvgPct != null) {
    parts.push(
      `습도 ${fmtPctSpoken(v.humidityAvgPct)}(권장 ${fmtPctSpoken(v.humidityMinPct)}~${fmtPctSpoken(v.humidityMaxPct)})`,
    );
  }
  return `${v.stallLabel} ${parts.join(" · ")}`.trim();
}

/** 뱃지 말풍선 — 내부 코드·영문 필드 없음. */
export function pigEnvAdviceCopy(
  verdicts: PigEnvTypeVerdict[],
): PigEnvAdviceCopy {
  const worst = pigEnvWorstVerdict(verdicts);
  if (!worst) {
    return withAdviceItems(
      {
        offBand: false,
        tier: "none",
        noticeCount: 0,
        stallLabel: null,
        summary: "권장 환경으로 볼 축사유형이 없습니다.",
      },
      [],
    );
  }
  if (!pigEnvVerdictOffBand(worst)) {
    return withAdviceItems(
      {
        offBand: false,
        tier: "ok",
        noticeCount: 0,
        stallLabel: worst.stallLabel,
        summary: "축사유형별 권장 온·습도 안에 있습니다.",
      },
      [],
    );
  }
  const off = verdicts
    .filter(pigEnvVerdictOffBand)
    .sort((a, b) => {
      const rank = pigEnvOffBandRank(b) - pigEnvOffBandRank(a);
      if (rank !== 0) return rank;
      return stallTyCodeSortKey(a.stallTyCode) - stallTyCodeSortKey(b.stallTyCode);
    });
  const items = off.map(pigEnvTypeOffLine);
  const noticeCount = Math.max(1, off.length);
  const top = off[0] ?? worst;
  return withAdviceItems(
    {
      offBand: true,
      tier: "offband",
      noticeCount,
      stallLabel: top.stallLabel,
      summary:
        off.length === 1
          ? `${top.stallLabel} 권장 온·습도를 벗어났습니다.`
          : `권장 온·습도를 벗어난 축사유형이 ${off.length}곳입니다.`,
    },
    items,
  );
}

type PigEnvBadgeReading = Pick<
  BarnReading,
  "stallTyCode" | "tempC" | "humidityPct" | "status"
>;

function pigEnvSafetyKindLabel(kind: PigEnvSafetyHit["kind"]): string {
  if (kind === "tempHigh") return "온도 상한";
  if (kind === "tempLow") return "온도 하한";
  if (kind === "humidityHigh") return "습도 상한";
  return "습도 하한";
}

function pigEnvSafetyHitSentence(
  stallLabel: string,
  hit: PigEnvSafetyHit,
): string {
  const dir = hit.kind.endsWith("High") ? "넘었습니다" : "밑돌았습니다";
  const bound = hit.kind.endsWith("High") ? "상한" : "하한";
  if (hit.kind.startsWith("temp")) {
    return `${stallLabel} 온도 ${fmtTempSpoken(hit.value)}로 ${bound} ${fmtTempSpoken(hit.limit)}를 ${dir}`;
  }
  return `${stallLabel} 습도 ${fmtPctSpoken(hit.value)}로 ${bound} ${fmtPctSpoken(hit.limit)}를 ${dir}`;
}

/**
 * 뱃지 조언 — 우선순위: 통신두절 > 장비경보(안전망 임계) > 권장표 이탈 > 적정.
 * 화면 맥락(stallTyCode)이 있으면 그 유형만 본다.
 */
export function pigEnvBadgeAdvice(
  readings: PigEnvBadgeReading[],
  stallTyCode?: string | null,
): PigEnvAdviceCopy {
  const focus = pigEnvFocusReadings(readings, stallTyCode);
  const verdicts = pigEnvTypeVerdicts(focus);
  const scopeLabel =
    pigEnvWorstVerdict(verdicts)?.stallLabel ??
    (normalizeStallTyCode(stallTyCode) !== "UNK"
      ? formatStallTypeLabel(normalizeStallTyCode(stallTyCode))
      : null);

  const offlineCount = focus.filter((r) => r.status === "offline").length;
  if (offlineCount > 0) {
    return withAdviceItems(
      {
        offBand: true,
        tier: "offline",
        noticeCount: offlineCount,
        stallLabel: scopeLabel,
        summary: `통신이 두절된 컨트롤러가 ${offlineCount}대 있습니다.`,
      },
      ["통신·전원을 확인하세요"],
    );
  }

  const alarmByType = new Map<
    string,
    { label: string; hit: PigEnvSafetyHit }
  >();
  let worstHit: { hit: PigEnvSafetyHit; label: string } | null = null;
  let alarmCount = 0;
  for (const r of focus) {
    if (r.status === "offline") continue;
    const hit = pigEnvSafetyHit(r);
    if (!hit) continue;
    alarmCount += 1;
    const code = normalizeStallTyCode(r.stallTyCode);
    const label = formatStallTypeLabel(code);
    const prev = alarmByType.get(code);
    if (!prev || pigEnvSafetyRank(hit) > pigEnvSafetyRank(prev.hit)) {
      alarmByType.set(code, { label, hit });
    }
    if (!worstHit || pigEnvSafetyRank(hit) > pigEnvSafetyRank(worstHit.hit)) {
      worstHit = { hit, label };
    }
  }
  if (worstHit) {
    const items = [...alarmByType.entries()]
      .sort((a, b) => {
        const rank =
          pigEnvSafetyRank(b[1].hit) - pigEnvSafetyRank(a[1].hit);
        if (rank !== 0) return rank;
        return stallTyCodeSortKey(a[0]) - stallTyCodeSortKey(b[0]);
      })
      .map(([, row]) => pigEnvSafetyHitSentence(row.label, row.hit));
    return withAdviceItems(
      {
        offBand: true,
        tier: "alarm",
        noticeCount: Math.max(1, alarmCount),
        stallLabel: worstHit.label,
        summary: `${pigEnvSafetyKindLabel(worstHit.hit.kind)}을 벗어난 장비 경보가 있습니다.`,
      },
      items,
    );
  }

  return pigEnvAdviceCopy(verdicts);
}
