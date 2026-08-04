"use client";

import { jsPDF } from "jspdf";
import type {
  DailyReportPayload,
  DailyReportSeries,
} from "@/lib/report/daily-report-payload";
import type { TrendPeriodId } from "@/lib/data/farm-trend-types";

export type DailyReportProgress = {
  phase: "fetch" | "render" | "done" | "error";
  current: number;
  total: number;
  message: string;
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 28;
const ACCENT = "#DC2626";
const INK = "#111827";
const MUTED = "#6B7280";
const RULE = "#E5E7EB";
const FONT =
  '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", "Segoe UI", sans-serif';
/** 본문 하단(푸터 위) */
const CONTENT_BOTTOM = PAGE_H - 36;

function fmt(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

function statusLabel(status: string): string {
  if (status === "offline") return "통신 두절";
  if (status === "caution") return "수신 지연";
  return "정상";
}

function severityLabel(severity: "warning" | "critical"): string {
  return severity === "critical" ? "심각" : "경고";
}

function situationSourceLabel(source: "module" | "offline"): string {
  return source === "module" ? "모듈" : "통신두절";
}

/** 축사 시리즈 슬롯 평균 → 농장 대표 시리즈 */
function averageFarmSeries(
  barns: DailyReportPayload["barns"],
  period: TrendPeriodId,
): DailyReportSeries {
  if (!barns.length) {
    return {
      categories: [],
      temp: [],
      humidity: [],
      motorA: [],
      motorB: [],
      motorC: [],
    };
  }
  const categories = barns[0]!.periods[period].categories.slice();
  const len = categories.length;
  const avgCol = (
    pick: (s: DailyReportSeries) => (number | null)[],
  ): (number | null)[] => {
    const out = new Array<number | null>(len).fill(null);
    for (let i = 0; i < len; i++) {
      let sum = 0;
      let n = 0;
      for (const b of barns) {
        const v = pick(b.periods[period])[i];
        if (v != null && !Number.isNaN(v)) {
          sum += v;
          n += 1;
        }
      }
      out[i] = n ? sum / n : null;
    }
    return out;
  };
  return {
    categories,
    temp: avgCol((s) => s.temp),
    humidity: avgCol((s) => s.humidity),
    motorA: avgCol((s) => s.motorA),
    motorB: avgCol((s) => s.motorB),
    motorC: avgCol((s) => s.motorC),
  };
}

type AttentionRow = {
  barn: string;
  eqpmnNo: string;
  controllerKey: string;
  status: string;
  tempC: number | null;
  humidityPct: number | null;
};

function collectAttentionRows(
  barns: DailyReportPayload["barns"],
): AttentionRow[] {
  const rows: AttentionRow[] = [];
  for (const b of barns) {
    for (const c of b.controllers) {
      if (c.status !== "caution" && c.status !== "offline") continue;
      rows.push({
        barn: `${b.stallLabel} ${b.stallNo}`,
        eqpmnNo: c.eqpmnNo,
        controllerKey: c.controllerKey,
        status: c.status,
        tempC: c.tempC,
        humidityPct: c.humidityPct,
      });
    }
  }
  rows.sort((a, b) => {
    const rank = (s: string) => (s === "offline" ? 0 : 1);
    const d = rank(a.status) - rank(b.status);
    if (d !== 0) return d;
    return a.barn.localeCompare(b.barn, "ko");
  });
  return rows;
}

/** 24h 시리즈에서 약 N포인트 발췌 (축사·컨트롤러 표 공용) */
function sampleDetailRows(
  series: DailyReportSeries,
  maxRows = 8,
): {
  label: string;
  temp: number | null;
  humidity: number | null;
  motorA: number | null;
  motorB: number | null;
}[] {
  const finiteIdx: number[] = [];
  for (let i = 0; i < series.categories.length; i++) {
    if (
      series.temp[i] != null ||
      series.humidity[i] != null ||
      series.motorA[i] != null ||
      series.motorB[i] != null
    ) {
      finiteIdx.push(i);
    }
  }
  if (!finiteIdx.length && !series.categories.length) return [];
  const pick =
    finiteIdx.length >= maxRows
      ? finiteIdx
          .filter((_, j) => j % Math.ceil(finiteIdx.length / maxRows) === 0)
          .slice(0, maxRows)
      : finiteIdx.length > 0
        ? finiteIdx
        : Array.from(
            { length: Math.min(maxRows, series.categories.length) },
            (_, j) =>
              Math.floor(
                (j * Math.max(0, series.categories.length - 1)) /
                  Math.max(1, maxRows - 1),
              ),
          );
  return pick.map((i) => ({
    label: series.categories[i] ?? "",
    temp: series.temp[i] ?? null,
    humidity: series.humidity[i] ?? null,
    motorA: series.motorA[i] ?? null,
    motorB: series.motorB[i] ?? null,
  }));
}

function countSeriesPoints(
  series: { values: (number | null)[] }[],
): number {
  return series.reduce(
    (n, s) =>
      n + s.values.filter((v) => v != null && !Number.isNaN(v)).length,
    0,
  );
}

function drawLegend(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  items: { color: string; label: string }[],
) {
  let lx = x;
  ctx.font = `8px ${FONT}`;
  for (const it of items) {
    ctx.fillStyle = it.color;
    ctx.fillRect(lx, y - 6, 8, 8);
    ctx.fillStyle = MUTED;
    ctx.fillText(it.label, lx + 11, y);
    lx += 11 + ctx.measureText(it.label).width + 12;
  }
}

function drawLineChart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  categories: string[],
  series: { values: (number | null)[]; color: string; label: string }[],
  options?: { emptyHint?: string },
) {
  ctx.save();
  const points = countSeriesPoints(series);
  const empty = points < 1 || categories.length < 1;

  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);

  if (empty) {
    ctx.fillStyle = MUTED;
    ctx.font = `10px ${FONT}`;
    const hint = options?.emptyHint ?? "기록 부족";
    ctx.fillText(hint, x + 8, y + Math.max(14, h / 2));
    ctx.restore();
    return;
  }

  const nums = series.flatMap((s) =>
    s.values.filter((v): v is number => v != null && !Number.isNaN(v)),
  );
  let min = Math.min(...nums);
  let max = Math.max(...nums);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.08;
  min -= pad;
  max += pad;

  const innerX = x + 6;
  const innerW = w - 12;
  const innerY = y + 6;
  const innerH = Math.max(8, h - 22);

  for (const s of series) {
    ctx.beginPath();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 1.6;
    let started = false;
    for (let i = 0; i < s.values.length; i++) {
      const v = s.values[i];
      if (v == null || Number.isNaN(v)) {
        started = false;
        continue;
      }
      const px = innerX + (i / Math.max(1, s.values.length - 1)) * innerW;
      const py = innerY + innerH - ((v - min) / (max - min)) * innerH;
      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();

    ctx.fillStyle = s.color;
    for (let i = 0; i < s.values.length; i++) {
      const v = s.values[i];
      if (v == null || Number.isNaN(v)) continue;
      const px = innerX + (i / Math.max(1, s.values.length - 1)) * innerW;
      const py = innerY + innerH - ((v - min) / (max - min)) * innerH;
      ctx.beginPath();
      ctx.arc(px, py, s.values.length > 48 ? 1.1 : 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = MUTED;
  ctx.font = `8px ${FONT}`;
  const tickIdx = [
    0,
    Math.floor((categories.length - 1) / 2),
    categories.length - 1,
  ];
  for (const i of tickIdx) {
    const label = categories[i] ?? "";
    const px = innerX + (i / Math.max(1, categories.length - 1)) * innerW;
    ctx.fillText(label, Math.max(x, px - 12), y + h - 4);
  }
  ctx.restore();
}

function chartHeightFor(seriesList: { values: (number | null)[] }[], full: number) {
  return countSeriesPoints(seriesList) >= 1 ? full : Math.min(22, full);
}

/** 기간 1행 — 온도/습도/모터 3열 (페이지 밀도용) */
function periodRow(
  ctx: CanvasRenderingContext2D,
  yStart: number,
  periodLabel: string,
  series: DailyReportSeries,
  chartH = 58,
): number {
  let y = yStart;
  ctx.fillStyle = ACCENT;
  ctx.font = `bold 10px ${FONT}`;
  ctx.fillText(periodLabel, MARGIN, y);
  y += 6;

  const gap = 8;
  const chartW = (PAGE_W - MARGIN * 2 - gap * 2) / 3;
  const metrics: {
    title: string;
    series: { values: (number | null)[]; color: string; label: string }[];
    legend?: { color: string; label: string }[];
  }[] = [
    {
      title: "온도",
      series: [{ values: series.temp, color: "#EA580C", label: "온도" }],
    },
    {
      title: "습도",
      series: [{ values: series.humidity, color: "#2563EB", label: "습도" }],
    },
    {
      title: "모터",
      series: [
        { values: series.motorA, color: "#059669", label: "A" },
        { values: series.motorB, color: "#7C3AED", label: "B" },
      ].filter((s) => s.values.some((v) => v != null)),
      legend: [
        { color: "#059669", label: "A" },
        { color: "#7C3AED", label: "B" },
      ],
    },
  ];

  metrics.forEach((m, i) => {
    const x = MARGIN + i * (chartW + gap);
    ctx.fillStyle = INK;
    ctx.font = `8px ${FONT}`;
    ctx.fillText(m.title, x, y + 8);
    if (m.legend) {
      drawLegend(ctx, x + 22, y + 8, m.legend);
    }
    const list =
      m.series.length > 0
        ? m.series
        : [{ values: series.motorA, color: "#059669", label: "A" }];
    const h = chartHeightFor(list, chartH);
    drawLineChart(ctx, x, y + 11, chartW, h, series.categories, list, {
      emptyHint: "기록 부족",
    });
  });

  return y + 11 + chartH + 10;
}

function createPageCanvas(): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scale: number;
} {
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(PAGE_W * scale);
  canvas.height = Math.round(PAGE_H * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  return { canvas, ctx, scale };
}

function footer(ctx: CanvasRenderingContext2D, page: number, total: number) {
  ctx.strokeStyle = RULE;
  ctx.beginPath();
  ctx.moveTo(MARGIN, PAGE_H - 28);
  ctx.lineTo(PAGE_W - MARGIN, PAGE_H - 28);
  ctx.stroke();
  ctx.fillStyle = MUTED;
  ctx.font = `9px ${FONT}`;
  ctx.fillText("SUNG-IL IoT · 스마트축사 일보 · 축사 단위", MARGIN, PAGE_H - 14);
  ctx.textAlign = "right";
  ctx.fillStyle = INK;
  ctx.fillText(`${page} / ${total}`, PAGE_W - MARGIN, PAGE_H - 14);
  ctx.textAlign = "left";
}

function headerBand(
  ctx: CanvasRenderingContext2D,
  title: string,
  lines: string[],
) {
  ctx.fillStyle = MUTED;
  ctx.font = `8px ${FONT}`;
  ctx.fillText("SUNG-IL IoT BOARD", MARGIN, MARGIN + 6);
  ctx.fillStyle = ACCENT;
  ctx.font = `bold 15px ${FONT}`;
  ctx.fillText(title, MARGIN, MARGIN + 26);
  ctx.fillStyle = MUTED;
  ctx.font = `9px ${FONT}`;
  let ly = MARGIN + 10;
  ctx.textAlign = "right";
  for (const line of lines) {
    ctx.fillText(line, PAGE_W - MARGIN, ly);
    ly += 12;
  }
  ctx.textAlign = "left";
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MARGIN, MARGIN + 36);
  ctx.lineTo(PAGE_W - MARGIN, MARGIN + 36);
  ctx.stroke();
  ctx.lineWidth = 1;
}

function kpiBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  value: string,
  label: string,
  h = 36,
) {
  ctx.fillStyle = "#FEF2F2";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#FECACA";
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = INK;
  ctx.font = `bold 12px ${FONT}`;
  ctx.fillText(value, x + 6, y + 15);
  ctx.fillStyle = MUTED;
  ctx.font = `8px ${FONT}`;
  ctx.fillText(label, x + 6, y + h - 7);
}

function tableHeaderBar(
  ctx: CanvasRenderingContext2D,
  y: number,
  headers: string[],
  cols: number[],
) {
  ctx.fillStyle = "#FEE2E2";
  ctx.fillRect(MARGIN, y - 11, PAGE_W - MARGIN * 2, 16);
  ctx.fillStyle = ACCENT;
  ctx.font = `bold 8px ${FONT}`;
  headers.forEach((h, i) => ctx.fillText(h, cols[i]!, y));
}

function addCanvasPage(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  isFirst: boolean,
) {
  const img = canvas.toDataURL("image/jpeg", 0.92);
  if (!isFirst) pdf.addPage();
  pdf.addImage(img, "JPEG", 0, 0, PAGE_W, PAGE_H);
}

async function yieldFrame() {
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
}

export async function buildAndDownloadDailyReportPdf(
  payload: DailyReportPayload,
  onProgress?: (p: DailyReportProgress) => void,
): Promise<void> {
  type AppendixItem = {
    stallLabel: string;
    stallNo: string;
    stallTyCode: string;
    ctrl: DailyReportPayload["barns"][number]["controllers"][number];
  };
  const appendix: AppendixItem[] = [];
  for (const b of payload.barns) {
    for (const ctrl of b.controllers) {
      appendix.push({
        stallLabel: b.stallLabel,
        stallNo: b.stallNo,
        stallTyCode: b.stallTyCode,
        ctrl,
      });
    }
  }
  /** 표지 1 + 축사 N + 컨트롤러 첨부(1대/페이지 · 발췌표 포함) */
  const appendixPages = appendix.length;
  const totalPages = 1 + payload.barns.length + appendixPages;
  let pageNo = 0;

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  let first = true;

  const reportProgress = (message: string) => {
    onProgress?.({
      phase: "render",
      current: pageNo,
      total: totalPages,
      message,
    });
  };

  // ---- Cover ----
  {
    pageNo += 1;
    reportProgress("표지 작성 중…");
    const { canvas, ctx } = createPageCanvas();
    headerBand(ctx, "스마트축사 일보", [
      `${payload.farmKey.lsindRegistNo} · ${payload.farmKey.itemCode}`,
      `보고일 ${payload.reportDate}`,
      `생성 ${payload.generatedAt}`,
    ]);

    let y = MARGIN + 48;
    const boxW = (PAGE_W - MARGIN * 2 - 18) / 4;
    const ov = payload.overview;
    const kpis: [string, string][] = [
      [String(ov.barnCount), "축사"],
      [String(ov.controllerCount), "컨트롤러"],
      [String(ov.onlineCount), "온라인"],
      [String(ov.alarmCount), "이상상황"],
    ];
    kpis.forEach(([v, l], i) => {
      kpiBox(ctx, MARGIN + i * (boxW + 6), y, boxW, v, l, 34);
    });
    y += 44;

    // 1) 농장 24h 요약 차트
    const farm24 = averageFarmSeries(payload.barns, "24h");
    y = periodRow(ctx, y, "농장 24시간 요약 · 온도 / 습도 / 모터", farm24, 64);

    ctx.fillStyle = INK;
    ctx.font = `bold 11px ${FONT}`;
    ctx.fillText("축사 인덱스", MARGIN, y);
    y += 12;

    const indexCols = [
      MARGIN + 6,
      MARGIN + 100,
      MARGIN + 160,
      MARGIN + 210,
      MARGIN + 270,
      MARGIN + 340,
    ];
    tableHeaderBar(
      ctx,
      y,
      ["축사", "코드", "대수", "온도", "습도", "판정"],
      indexCols,
    );
    y += 12;

    ctx.fillStyle = INK;
    ctx.font = `9px ${FONT}`;
    for (const b of payload.barns) {
      if (y > CONTENT_BOTTOM - 120) break;
      ctx.fillText(`${b.stallLabel} ${b.stallNo}`, indexCols[0]!, y);
      ctx.fillText(b.stallTyCode, indexCols[1]!, y);
      ctx.fillText(String(b.kpi.total), indexCols[2]!, y);
      ctx.fillText(`${fmt(b.kpi.tempNow)}℃`, indexCols[3]!, y);
      ctx.fillText(`${fmt(b.kpi.humNow)}%`, indexCols[4]!, y);
      ctx.fillText(b.kpi.judge, indexCols[5]!, y);
      y += 13;
    }
    y += 10;

    // 2) 수신 지연·통신 두절 컨트롤러 (연결 상태)
    if (y + 40 < CONTENT_BOTTOM) {
      const attention = collectAttentionRows(payload.barns);
      ctx.fillStyle = INK;
      ctx.font = `bold 11px ${FONT}`;
      ctx.fillText(
        attention.length
          ? `수신 지연·통신 두절 (${attention.length})`
          : "수신 지연·통신 두절",
        MARGIN,
        y,
      );
      y += 12;

      if (attention.length === 0) {
        ctx.fillStyle = MUTED;
        ctx.font = `9px ${FONT}`;
        ctx.fillText(
          "해당 없음 — 수신 지연·통신 두절 장치가 없습니다.",
          MARGIN,
          y,
        );
        y += 14;
      } else {
        const aCols = [
          MARGIN + 4,
          MARGIN + 100,
          MARGIN + 140,
          MARGIN + 280,
          MARGIN + 340,
          MARGIN + 400,
        ];
        tableHeaderBar(
          ctx,
          y,
          ["축사", "번호", "컨트롤러", "상태", "온도", "습도"],
          aCols,
        );
        y += 12;
        ctx.font = `8px ${FONT}`;
        for (let i = 0; i < attention.length; i++) {
          if (y > CONTENT_BOTTOM - 8) break;
          const row = attention[i]!;
          if (i % 2 === 1) {
            ctx.fillStyle = "#F9FAFB";
            ctx.fillRect(MARGIN, y - 9, PAGE_W - MARGIN * 2, 12);
          }
          ctx.fillStyle = INK;
          ctx.fillText(row.barn, aCols[0]!, y);
          ctx.fillText(row.eqpmnNo, aCols[1]!, y);
          ctx.fillText(row.controllerKey.slice(0, 22), aCols[2]!, y);
          ctx.fillStyle =
            row.status === "offline" ? "#B91C1C" : "#B45309";
          ctx.fillText(statusLabel(row.status), aCols[3]!, y);
          ctx.fillStyle = INK;
          ctx.fillText(`${fmt(row.tempC)}℃`, aCols[4]!, y);
          ctx.fillText(`${fmt(row.humidityPct)}%`, aCols[5]!, y);
          y += 12;
        }
      }
    }

    // 3) 이상상황 (모듈 에러 + 통신두절)
    if (y + 40 < CONTENT_BOTTOM) {
      const alarms = payload.alarms;
      ctx.fillStyle = INK;
      ctx.font = `bold 11px ${FONT}`;
      ctx.fillText(
        alarms.length
          ? `이상상황 · 모듈 에러·통신 두절 (${alarms.length})`
          : "이상상황 · 모듈 에러·통신 두절",
        MARGIN,
        y,
      );
      y += 12;

      if (alarms.length === 0) {
        ctx.fillStyle = MUTED;
        ctx.font = `9px ${FONT}`;
        ctx.fillText(
          "이상 없음 — 모듈 에러·통신 두절이 없습니다.",
          MARGIN,
          y,
        );
        y += 14;
      } else {
        const maxRows = 8;
        const shown = alarms.slice(0, maxRows);
        const aCols = [
          MARGIN + 4,
          MARGIN + 80,
          MARGIN + 115,
          MARGIN + 175,
          MARGIN + 230,
          MARGIN + 280,
          MARGIN + 340,
        ];
        tableHeaderBar(
          ctx,
          y,
          ["축사", "번호", "출처", "유형", "심각도", "상세"],
          aCols,
        );
        y += 12;
        ctx.font = `8px ${FONT}`;
        for (let i = 0; i < shown.length; i++) {
          if (y > CONTENT_BOTTOM - 8) break;
          const row = shown[i]!;
          if (i % 2 === 1) {
            ctx.fillStyle = "#F9FAFB";
            ctx.fillRect(MARGIN, y - 9, PAGE_W - MARGIN * 2, 12);
          }
          ctx.fillStyle = INK;
          ctx.fillText(`${row.stallLabel} ${row.stallNo}`, aCols[0]!, y);
          ctx.fillText(row.eqpmnNo, aCols[1]!, y);
          ctx.fillText(situationSourceLabel(row.source), aCols[2]!, y);
          ctx.fillText(row.alarmType.slice(0, 10), aCols[3]!, y);
          ctx.fillStyle = row.severity === "critical" ? "#B91C1C" : "#B45309";
          ctx.fillText(severityLabel(row.severity), aCols[4]!, y);
          ctx.fillStyle = INK;
          ctx.fillText(row.detail.slice(0, 24), aCols[5]!, y);
          y += 12;
        }
        if (alarms.length > maxRows) {
          ctx.fillStyle = MUTED;
          ctx.font = `8px ${FONT}`;
          ctx.fillText(
            `외 ${alarms.length - maxRows}건 — 헤더 이상상황에서 전체 확인`,
            MARGIN,
            y + 2,
          );
          y += 14;
        }
      }
    }

    footer(ctx, pageNo, totalPages);
    addCanvasPage(pdf, canvas, first);
    first = false;
    await yieldFrame();
  }

  const periodOrder: { id: TrendPeriodId; label: string }[] = [
    { id: "24h", label: "24시간" },
    { id: "7d", label: "7일" },
    { id: "30d", label: "30일" },
  ];

  for (const barn of payload.barns) {
    pageNo += 1;
    reportProgress(`${barn.stallLabel} ${barn.stallNo}`);
    const { canvas, ctx } = createPageCanvas();
    headerBand(ctx, `${barn.stallLabel} ${barn.stallNo}`, [
      `${payload.farmKey.lsindRegistNo} / ${payload.farmKey.itemCode}`,
      `${barn.stallTyCode} · 컨트롤러 ${barn.kpi.total}대`,
      `보고일 ${payload.reportDate}`,
    ]);

    let y = MARGIN + 46;

    // KPI — 한 줄 8칸
    const kpiItems: [string, string][] = [
      [`${fmt(barn.kpi.tempNow)}℃`, "온도"],
      [`${fmt(barn.kpi.humNow)}%`, "습도"],
      [`${fmt(barn.kpi.motorA, 0)}%`, "모터A"],
      [
        barn.kpi.motorB == null ? "—" : `${fmt(barn.kpi.motorB, 0)}%`,
        "모터B",
      ],
      [`${fmt(barn.kpi.tMin24)}℃`, "24h↓"],
      [`${fmt(barn.kpi.tMax24)}℃`, "24h↑"],
      [`${barn.kpi.online}/${barn.kpi.total}`, "온라인"],
      [barn.kpi.judge, "판정"],
    ];
    const kpiGap = 4;
    const kpiW = (PAGE_W - MARGIN * 2 - kpiGap * 7) / 8;
    kpiItems.forEach(([v, l], i) => {
      kpiBox(ctx, MARGIN + i * (kpiW + kpiGap), y, kpiW, v, l, 32);
    });
    y += 40;

    for (const p of periodOrder) {
      y = periodRow(
        ctx,
        y,
        `${p.label} · 온도 / 습도 / 모터`,
        barn.periods[p.id],
        52,
      );
    }

    // 컨트롤러 표
    if (y + 40 < CONTENT_BOTTOM && barn.controllers.length > 0) {
      ctx.fillStyle = INK;
      ctx.font = `bold 10px ${FONT}`;
      ctx.fillText("컨트롤러 현황", MARGIN, y);
      y += 12;
      const heads = ["ID", "번호", "온도", "습도", "A%", "B%"];
      const cols = [
        MARGIN + 4,
        MARGIN + 150,
        MARGIN + 190,
        MARGIN + 240,
        MARGIN + 290,
        MARGIN + 340,
      ];
      tableHeaderBar(ctx, y, heads, cols);
      y += 12;
      ctx.font = `8px ${FONT}`;
      for (let rowIdx = 0; rowIdx < barn.controllers.length; rowIdx++) {
        if (y > CONTENT_BOTTOM - 40) break;
        const c = barn.controllers[rowIdx]!;
        if (rowIdx % 2 === 1) {
          ctx.fillStyle = "#F9FAFB";
          ctx.fillRect(MARGIN, y - 9, PAGE_W - MARGIN * 2, 12);
        }
        ctx.fillStyle = INK;
        ctx.fillText(c.controllerKey.slice(0, 28), cols[0]!, y);
        ctx.fillText(c.eqpmnNo, cols[1]!, y);
        ctx.fillText(`${fmt(c.tempC)}℃`, cols[2]!, y);
        ctx.fillText(`${fmt(c.humidityPct)}%`, cols[3]!, y);
        ctx.fillText(c.motorA == null ? "—" : fmt(c.motorA, 0), cols[4]!, y);
        ctx.fillText(c.motorB == null ? "—" : fmt(c.motorB, 0), cols[5]!, y);
        y += 12;
      }
      y += 8;
    }

    // 24h 발췌
    if (y + 36 < CONTENT_BOTTOM && barn.detailRows.length > 0) {
      ctx.fillStyle = INK;
      ctx.font = `bold 10px ${FONT}`;
      ctx.fillText("24시간 발췌", MARGIN, y);
      y += 12;
      const dHeads = ["시각", "온도℃", "습도%", "모터A", "모터B"];
      const dCols = [
        MARGIN + 4,
        MARGIN + 90,
        MARGIN + 160,
        MARGIN + 230,
        MARGIN + 300,
      ];
      tableHeaderBar(ctx, y, dHeads, dCols);
      y += 12;
      ctx.font = `8px ${FONT}`;
      for (let rowIdx = 0; rowIdx < barn.detailRows.length; rowIdx++) {
        if (y > CONTENT_BOTTOM - 8) break;
        const row = barn.detailRows[rowIdx]!;
        if (rowIdx % 2 === 1) {
          ctx.fillStyle = "#F9FAFB";
          ctx.fillRect(MARGIN, y - 9, PAGE_W - MARGIN * 2, 12);
        }
        ctx.fillStyle = INK;
        ctx.fillText(row.label, dCols[0]!, y);
        ctx.fillText(fmt(row.temp), dCols[1]!, y);
        ctx.fillText(fmt(row.humidity), dCols[2]!, y);
        ctx.fillText(
          row.motorA == null ? "—" : fmt(row.motorA, 0),
          dCols[3]!,
          y,
        );
        ctx.fillText(
          row.motorB == null ? "—" : fmt(row.motorB, 0),
          dCols[4]!,
          y,
        );
        y += 12;
      }
    }

    footer(ctx, pageNo, totalPages);
    addCanvasPage(pdf, canvas, first);
    first = false;
    await yieldFrame();
  }

  // ---- 컨트롤러 첨부 (1대/페이지 · KPI + 24h/7d/30d 차트 + 발췌 표) ----
  for (let i = 0; i < appendix.length; i++) {
    pageNo += 1;
    const item = appendix[i]!;
    reportProgress(
      `첨부 · ${item.stallLabel} ${item.stallNo} ${item.ctrl.eqpmnNo}번`,
    );
    const { canvas, ctx } = createPageCanvas();
    headerBand(
      ctx,
      `${item.stallLabel} ${item.stallNo} · ${item.ctrl.eqpmnNo}번`,
      [
        `${payload.farmKey.lsindRegistNo} / ${payload.farmKey.itemCode}`,
        `${item.stallTyCode} · ${item.ctrl.controllerKey}`,
        `컨트롤러 상세 ${i + 1}/${appendix.length}`,
      ],
    );

    let y = MARGIN + 46;

    const kpiGap = 4;
    const kpiW = (PAGE_W - MARGIN * 2 - kpiGap * 5) / 6;
    const kpis: [string, string][] = [
      [`${fmt(item.ctrl.tempC)}℃`, "온도"],
      [`${fmt(item.ctrl.humidityPct)}%`, "습도"],
      [
        item.ctrl.motorA == null ? "—" : `${fmt(item.ctrl.motorA, 0)}%`,
        "채널 A",
      ],
      [
        item.ctrl.motorB == null ? "—" : `${fmt(item.ctrl.motorB, 0)}%`,
        "채널 B",
      ],
      [
        item.ctrl.motorC == null ? "—" : `${fmt(item.ctrl.motorC, 0)}%`,
        "채널 C",
      ],
      [statusLabel(item.ctrl.status), "상태"],
    ];
    kpis.forEach(([v, l], idx) => {
      kpiBox(ctx, MARGIN + idx * (kpiW + kpiGap), y, kpiW, v, l, 32);
    });
    y += 40;

    const ctrlPeriods: { id: TrendPeriodId; label: string; chartH: number }[] =
      [
        { id: "24h", label: "24시간", chartH: 50 },
        { id: "7d", label: "7일", chartH: 42 },
        { id: "30d", label: "30일", chartH: 42 },
      ];
    for (const p of ctrlPeriods) {
      y = periodRow(
        ctx,
        y,
        `${p.label} · 온도 / 습도 / 모터`,
        item.ctrl.periods[p.id],
        p.chartH,
      );
    }

    const detailRows = sampleDetailRows(item.ctrl.periods["24h"], 6);
    if (detailRows.length > 0 && y + 40 < CONTENT_BOTTOM) {
      ctx.fillStyle = INK;
      ctx.font = `bold 10px ${FONT}`;
      ctx.fillText("24시간 발췌", MARGIN, y);
      y += 12;
      const dHeads = ["시각", "온도℃", "습도%", "모터A", "모터B"];
      const dCols = [
        MARGIN + 4,
        MARGIN + 90,
        MARGIN + 160,
        MARGIN + 230,
        MARGIN + 300,
      ];
      tableHeaderBar(ctx, y, dHeads, dCols);
      y += 12;
      ctx.font = `8px ${FONT}`;
      for (let rowIdx = 0; rowIdx < detailRows.length; rowIdx++) {
        if (y > CONTENT_BOTTOM - 8) break;
        const row = detailRows[rowIdx]!;
        if (rowIdx % 2 === 1) {
          ctx.fillStyle = "#F9FAFB";
          ctx.fillRect(MARGIN, y - 9, PAGE_W - MARGIN * 2, 12);
        }
        ctx.fillStyle = INK;
        ctx.fillText(row.label, dCols[0]!, y);
        ctx.fillText(fmt(row.temp), dCols[1]!, y);
        ctx.fillText(fmt(row.humidity), dCols[2]!, y);
        ctx.fillText(
          row.motorA == null ? "—" : fmt(row.motorA, 0),
          dCols[3]!,
          y,
        );
        ctx.fillText(
          row.motorB == null ? "—" : fmt(row.motorB, 0),
          dCols[4]!,
          y,
        );
        y += 12;
      }
    }

    footer(ctx, pageNo, totalPages);
    addCanvasPage(pdf, canvas, first);
    first = false;
    await yieldFrame();
  }

  const filename = `${payload.farmKey.lsindRegistNo}_${payload.farmKey.itemCode}_일보_${payload.reportDate}.pdf`;
  pdf.save(filename);
  onProgress?.({
    phase: "done",
    current: totalPages,
    total: totalPages,
    message: "다운로드 완료",
  });
}
