import {
  type Band,
  type Sev,
  binMean,
  binWorst,
  excessRatio,
  severityScore,
  sevOfScore,
} from "@/lib/farm/severity-score";

/** 아래(index 0) → 위 순서로 스택된다. */
export type StackMetric = {
  id: string;
  label: string;
  values: (number | null)[];
  band: Band | null;
  unit?: string;
};

type Props = {
  /** 아래→위 순서의 지표들. 모든 values 길이는 동일(버킷 수)해야 한다. */
  metrics: StackMetric[];
  height?: number;
  /** 정상 기준선(빨강 점선) 표시 */
  showBaseline?: boolean;
  /** 표시 막대 수 — 원본 버킷을 이 수로 묶는다(하이브리드: 높이=평균, 색=최악). */
  bars?: number;
  className?: string;
};

/** 심각도 색 — STATUS_ACCENT(emerald/amber/red)와 동일 팔레트. */
const SEV_COLOR: Record<Sev, string> = {
  normal: "#10b981",
  caution: "#f59e0b",
  warning: "#ef4444",
};

const MIN_SEG = 6; // 정상 최소 세그먼트(5채널 항상 식별)
const SEG_GAP = 1; // 세그먼트 사이 구분 간격(채널 경계 강조)

/**
 * 편차 스택 바 — "한 시각 = 막대 1개".
 * 각 버킷에서 지표별 정규화 편차 초과분을 아래→위로 누적, 색은 심각도.
 * 막대가 정상 기준선 위로 솟으면 이상.
 */
export function DeviationStackChart({
  metrics,
  height = 60,
  showBaseline = true,
  bars,
  className,
}: Props) {
  const rows = metrics.length;
  // 지표별 원본 심각도 점수 → 표시 해상도로 집계(하이브리드: 높이=평균, 색=최악)
  const scoreRows = metrics.map((m) =>
    m.values.map((v) => severityScore(v, m.band)),
  );
  const heightRows = bars ? scoreRows.map((r) => binMean(r, bars)) : scoreRows;
  const colorRows = bars ? scoreRows.map((r) => binWorst(r, bars)) : scoreRows;

  const bucketCount = heightRows[0]?.length ?? 0;
  const H = height;
  const W = Math.max(1, bucketCount) * 16;
  const pad = 3;
  const colW = W / Math.max(1, bucketCount);
  const barW = Math.min(14, colW * 0.72);
  const avail = H - pad * 2;
  const maxPerSeg = rows > 0 ? avail / rows : avail;
  const minSeg = Math.min(MIN_SEG, maxPerSeg * 0.8);
  const baselineTop = H - pad - minSeg * rows;

  const hasAnyData = scoreRows.some((r) => r.some((v) => v != null));

  return (
    <svg
      className={className}
      width="100%"
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="지표별 편차 스택"
      style={{ display: "block" }}
    >
      <line x1={0} y1={H - pad} x2={W} y2={H - pad} stroke="currentColor" strokeOpacity={0.18} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {showBaseline && hasAnyData ? (
        <line
          x1={0}
          y1={baselineTop}
          x2={W}
          y2={baselineTop}
          stroke={SEV_COLOR.warning}
          strokeWidth={1}
          strokeDasharray="3 3"
          strokeOpacity={0.4}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {hasAnyData
        ? Array.from({ length: bucketCount }).map((_, gi) => {
            const x = gi * colW + (colW - barW) / 2;
            let cursor = H - pad;
            return metrics.map((m, mi) => {
              const hScore = heightRows[mi][gi]; // 높이 = 구간 평균
              const cScore = colorRows[mi][gi]; // 색 = 구간 내 최악
              const sev = sevOfScore(cScore);
              const segH = minSeg + excessRatio(hScore) * (maxPerSeg - minSeg);
              const y = cursor - segH;
              // 구분 간격(SEG_GAP)만큼 아래를 비워 채널 경계를 드러낸다.
              const drawH = Math.max(0.8, segH - SEG_GAP);
              const rect = (
                <rect
                  key={`${gi}-${m.id}`}
                  x={x}
                  y={y}
                  width={barW}
                  height={drawH}
                  fill={SEV_COLOR[sev]}
                  fillOpacity={sev === "normal" ? 0.3 : 0.95}
                />
              );
              cursor = y;
              return rect;
            });
          })
        : null}
    </svg>
  );
}
