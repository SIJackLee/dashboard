"use client";

import { jsPDF } from "jspdf";
import { CHANNEL_SLOT_LABELS } from "@/lib/data/iot-channel";
import { TREND_CHART_COLORS } from "@/lib/farm/trend-chart-series";
import { downsampleDailyReportSeriesForPrint } from "@/lib/report/daily-report-chart";
import {
  buildDailyReportBriefing,
  farmBriefingFacts,
  riskBriefingFacts,
  typeBriefingFacts,
  type DailyReportBriefing,
  type DailyReportRiskWindow,
  type DailyReportTypeBrief,
} from "@/lib/report/daily-report-briefing";
import {
  dailyReportPdfFilename,
  type DailyReportPayload,
  type DailyReportSeries,
} from "@/lib/report/daily-report-payload";
import {
  type DailyReportPdfTheme,
} from "@/lib/report/daily-report-pdf-theme";

export type DailyReportProgress = {
  phase: "fetch" | "render" | "done" | "error";
  current: number;
  total: number;
  message: string;
};

import {
  ALARM_GUIDE_LEGEND,
  CONTENT_BOTTOM,
  ChartGuide,
  DEFAULT_THEME,
  FONT,
  INK,
  KPI_TONE,
  KpiTone,
  MARGIN,
  MUTED,
  PAGE_H,
  PAGE_W,
  RECOMMEND_GUIDE_LEGEND,
  RULE,
  averageFarmSeries,
  bandGuide,
  collectAttentionRows,
  countSeriesPoints,
  farmAlarmGuides,
  finiteExtent,
  fmt,
  printMotorSeries,
  severityLabel,
  situationSourceLabel,
  stackedMetricTitle,
  statusLabel,
  toneFromControllerStatus,
  toneFromJudge,
  typeChartGuides,
} from "@/lib/report/build-daily-report-pdf-base";

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
  options?: {
    emptyHint?: string;
    unit?: string;
    guide?: ChartGuide;
    yAxis?: boolean;
    yFixed?: { min: number; max: number };
  },
) {
  ctx.save();
  const points = countSeriesPoints(series);
  const empty = points < 1 || categories.length < 1;
  const yAxis = Boolean(options?.yAxis || options?.guide);

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
  let dataMin = Math.min(...nums);
  let dataMax = Math.max(...nums);
  if (dataMin === dataMax) {
    dataMin -= 1;
    dataMax += 1;
  }

  let min = options?.yFixed?.min ?? dataMin;
  let max = options?.yFixed?.max ?? dataMax;
  const guide = options?.guide;
  if (guide) {
    min = Math.min(min, guide.lo);
    max = Math.max(max, guide.hi);
  }
  if (min === max) {
    min -= 1;
    max += 1;
  }
  if (!options?.yFixed) {
    const pad = (max - min) * 0.08;
    min -= pad;
    max += pad;
  }

  const axisW = yAxis ? 34 : 6;
  const innerX = x + axisW;
  const innerW = w - axisW - 8;
  const innerY = y + 6;
  const innerH = Math.max(8, h - 22);

  const pyAt = (v: number) =>
    innerY + innerH - ((v - min) / (max - min)) * innerH;

  if (yAxis && guide) {
    const top = pyAt(guide.hi);
    const bot = pyAt(guide.lo);
    ctx.fillStyle = "rgba(16, 185, 129, 0.10)";
    ctx.fillRect(innerX, top, innerW, Math.max(1, bot - top));
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = "#B45309";
    ctx.lineWidth = 1;
    for (const gv of [guide.lo, guide.hi]) {
      const gy = pyAt(gv);
      ctx.beginPath();
      ctx.moveTo(innerX, gy);
      ctx.lineTo(innerX + innerW, gy);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  if (yAxis) {
    ctx.setLineDash([1, 3]);
    ctx.strokeStyle = "#9CA3AF";
    ctx.lineWidth = 1;
    for (const gv of [dataMin, dataMax]) {
      if (gv < min || gv > max) continue;
      if (guide && (Math.abs(gv - guide.lo) < 0.15 || Math.abs(gv - guide.hi) < 0.15)) {
        continue;
      }
      const gy = pyAt(gv);
      ctx.beginPath();
      ctx.moveTo(innerX, gy);
      ctx.lineTo(innerX + innerW, gy);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(innerX, innerY, innerW, innerH);
  ctx.clip();
  for (const s of series) {
    ctx.beginPath();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 1.7;
    let started = false;
    for (let i = 0; i < s.values.length; i++) {
      const v = s.values[i];
      if (v == null || Number.isNaN(v)) {
        started = false;
        continue;
      }
      const px = innerX + (i / Math.max(1, s.values.length - 1)) * innerW;
      const py = pyAt(v);
      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();

    if (s.values.length <= 40) {
      ctx.fillStyle = s.color;
      for (let i = 0; i < s.values.length; i++) {
        const v = s.values[i];
        if (v == null || Number.isNaN(v)) continue;
        const px = innerX + (i / Math.max(1, s.values.length - 1)) * innerW;
        ctx.beginPath();
        ctx.arc(px, pyAt(v), 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();

  const fmtTick = (n: number) =>
    Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1);
  const span = max - min;
  const tooClose = (a: number, b: number) => Math.abs(a - b) < span * 0.08;

  ctx.fillStyle = MUTED;
  ctx.font = `7px ${FONT}`;
  if (yAxis) {
    const ticks: number[] = options?.yFixed
      ? [
          options.yFixed.max,
          (options.yFixed.min + options.yFixed.max) / 2,
          options.yFixed.min,
        ]
      : guide
        ? [guide.hi, guide.lo]
        : [dataMax, (dataMin + dataMax) / 2, dataMin];
    if (!options?.yFixed) {
      for (const extra of [dataMax, dataMin]) {
        if (ticks.every((t) => !tooClose(t, extra))) ticks.push(extra);
      }
    }
    const seen: number[] = [];
    for (const t of ticks) {
      if (seen.some((s) => tooClose(s, t))) continue;
      seen.push(t);
      ctx.fillText(fmtTick(t), x + 3, pyAt(t) + 3);
    }

    ctx.textAlign = "right";
    if (guide) {
      ctx.fillStyle = "#B45309";
      ctx.fillText(
        `${guide.name} ${fmtTick(guide.hi)}`,
        innerX + innerW - 3,
        Math.max(innerY + 8, pyAt(guide.hi) - 3),
      );
      ctx.fillText(
        `${guide.name} ${fmtTick(guide.lo)}`,
        innerX + innerW - 3,
        Math.min(innerY + innerH - 2, pyAt(guide.lo) + 9),
      );
    }
    ctx.fillStyle = MUTED;
    if (!guide || !tooClose(dataMax, guide.hi)) {
      ctx.fillText(
        `그래프 ${fmtTick(dataMax)}`,
        innerX + innerW - 3,
        pyAt(dataMax) - 3,
      );
    }
    if (!guide || !tooClose(dataMin, guide.lo)) {
      ctx.fillText(
        `그래프 ${fmtTick(dataMin)}`,
        innerX + innerW - 3,
        pyAt(dataMin) + 9,
      );
    }
    ctx.textAlign = "left";
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

/** 기간 1행 — 온도/습도/채널 3열 (인쇄 밀도. 허브 split-Y·브러시 없음) */
function periodRow(
  ctx: CanvasRenderingContext2D,
  yStart: number,
  periodLabel: string,
  series: DailyReportSeries,
  chartH = 58,
  theme: DailyReportPdfTheme = DEFAULT_THEME,
): number {
  const print = downsampleDailyReportSeriesForPrint(series);
  let y = yStart;
  ctx.fillStyle = theme.section;
  ctx.font = `bold 10px ${FONT}`;
  ctx.fillText(periodLabel, MARGIN, y);
  y += 6;

  const gap = 8;
  const chartW = (PAGE_W - MARGIN * 2 - gap * 2) / 3;
  const motorSeries = [
    {
      values: print.motorA,
      color: TREND_CHART_COLORS.fanIntake,
      label: CHANNEL_SLOT_LABELS.A,
    },
    {
      values: print.motorB,
      color: TREND_CHART_COLORS.fanExhaust,
      label: CHANNEL_SLOT_LABELS.B,
    },
    {
      values: print.motorC,
      color: TREND_CHART_COLORS.fanSupply,
      label: CHANNEL_SLOT_LABELS.C,
    },
  ].filter((s) => s.values.some((v) => v != null && !Number.isNaN(v)));
  const metrics: {
    title: string;
    series: { values: (number | null)[]; color: string; label: string }[];
    legend?: { color: string; label: string }[];
  }[] = [
    {
      title: "온도",
      series: [
        { values: print.temp, color: TREND_CHART_COLORS.temp, label: "온도" },
      ],
    },
    {
      title: "습도",
      series: [
        {
          values: print.humidity,
          color: TREND_CHART_COLORS.humidity,
          label: "습도",
        },
      ],
    },
    {
      title: "채널",
      series: motorSeries,
      legend: motorSeries.map((s) => ({ color: s.color, label: s.label })),
    },
  ];

  metrics.forEach((m, i) => {
    const x = MARGIN + i * (chartW + gap);
    ctx.fillStyle = INK;
    ctx.font = `8px ${FONT}`;
    ctx.fillText(m.title, x, y + 8);
    if (m.legend && m.legend.length > 0) {
      drawLegend(ctx, x + 22, y + 8, m.legend);
    }
    const list =
      m.series.length > 0
        ? m.series
        : [
            {
              values: print.motorA,
              color: TREND_CHART_COLORS.fanIntake,
              label: CHANNEL_SLOT_LABELS.A,
            },
          ];
    const h = chartHeightFor(list, chartH);
    drawLineChart(ctx, x, y + 11, chartW, h, print.categories, list, {
      emptyHint: "기록 부족",
    });
  });

  return y + 11 + chartH + 10;
}

/** 허브 차트와 같이 지표마다 고유 행 · 풀폭. 권장/가이드와 그래프 최저·최고를 함께 표기. */
function periodStack(
  ctx: CanvasRenderingContext2D,
  yStart: number,
  heading: string,
  series: DailyReportSeries,
  theme: DailyReportPdfTheme,
  guides: { temp?: ChartGuide; humidity?: ChartGuide },
  chartH = 96,
  emptyHint = "기록 부족",
  guideLegend = RECOMMEND_GUIDE_LEGEND,
): number {
  const print = downsampleDailyReportSeriesForPrint(series);
  let y = yStart;
  ctx.fillStyle = theme.section;
  ctx.font = `bold 10px ${FONT}`;
  ctx.fillText(heading, MARGIN, y);
  y += 12;
  ctx.fillStyle = MUTED;
  ctx.font = `8px ${FONT}`;
  ctx.fillText(guideLegend, MARGIN, y);
  y += 10;

  const chartW = PAGE_W - MARGIN * 2;
  const motorSeries = printMotorSeries(print);
  const rows: {
    title: string;
    list: { values: (number | null)[]; color: string; label: string }[];
    legend?: { color: string; label: string }[];
    guide?: ChartGuide;
    yFixed?: { min: number; max: number };
  }[] = [
    {
      title: stackedMetricTitle(
        "온도",
        guides.temp,
        finiteExtent([print.temp]),
        "℃",
        1,
      ),
      list: [
        { values: print.temp, color: TREND_CHART_COLORS.temp, label: "온도" },
      ],
      guide: guides.temp,
    },
    {
      title: stackedMetricTitle(
        "습도",
        guides.humidity,
        finiteExtent([print.humidity]),
        "%",
        0,
      ),
      list: [
        {
          values: print.humidity,
          color: TREND_CHART_COLORS.humidity,
          label: "습도",
        },
      ],
      guide: guides.humidity,
    },
    {
      title: stackedMetricTitle(
        "채널",
        undefined,
        finiteExtent([print.motorA, print.motorB, print.motorC]),
        "%",
        0,
        "축 0~100%",
      ),
      list:
        motorSeries.length > 0
          ? motorSeries
          : [
              {
                values: print.motorA,
                color: TREND_CHART_COLORS.fanIntake,
                label: CHANNEL_SLOT_LABELS.A,
              },
            ],
      legend: motorSeries.map((s) => ({ color: s.color, label: s.label })),
      yFixed: { min: 0, max: 100 },
    },
  ];

  for (const row of rows) {
    ctx.fillStyle = INK;
    ctx.font = `8px ${FONT}`;
    ctx.fillText(row.title, MARGIN, y + 8);
    if (row.legend && row.legend.length > 0) {
      const tw = ctx.measureText(row.title).width;
      drawLegend(ctx, MARGIN + tw + 14, y + 8, row.legend);
    }
    const h = chartHeightFor(row.list, chartH);
    drawLineChart(ctx, MARGIN, y + 11, chartW, h, print.categories, row.list, {
      emptyHint,
      yAxis: true,
      guide: row.guide,
      yFixed: row.yFixed,
    });
    y += 11 + h + 10;
  }
  return y;
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

function footer(
  ctx: CanvasRenderingContext2D,
  page: number,
  total: number,
  theme: DailyReportPdfTheme = DEFAULT_THEME,
) {
  if (theme.footer === "bar") {
    ctx.fillStyle = theme.footerBg;
    ctx.fillRect(0, PAGE_H - 28, PAGE_W, 28);
    ctx.fillStyle = theme.footerMuted;
    ctx.font = `9px ${FONT}`;
    ctx.fillText(
      "SUNG-IL IoT · 스마트축사 일보 · 축사 단위",
      MARGIN,
      PAGE_H - 11,
    );
    ctx.textAlign = "right";
    ctx.fillStyle = theme.footerFg;
    ctx.fillText(`${page} / ${total}`, PAGE_W - MARGIN, PAGE_H - 11);
    ctx.textAlign = "left";
    return;
  }
  ctx.strokeStyle = RULE;
  ctx.beginPath();
  ctx.moveTo(MARGIN, PAGE_H - 28);
  ctx.lineTo(PAGE_W - MARGIN, PAGE_H - 28);
  ctx.stroke();
  ctx.fillStyle = theme.footerMuted;
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
  theme: DailyReportPdfTheme = DEFAULT_THEME,
) {
  if (theme.header === "letterhead") {
    ctx.fillStyle = theme.letterheadBg;
    ctx.fillRect(0, 0, PAGE_W, MARGIN + 40);
    ctx.fillStyle = theme.letterheadMuted;
    ctx.font = `8px ${FONT}`;
    ctx.fillText("SUNG-IL IoT BOARD", MARGIN, MARGIN + 8);
    ctx.fillStyle = theme.letterheadFg;
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillText(title, MARGIN, MARGIN + 28);
    ctx.fillStyle = theme.letterheadMuted;
    ctx.font = `9px ${FONT}`;
    let ly = MARGIN + 10;
    ctx.textAlign = "right";
    for (const line of lines) {
      ctx.fillText(line, PAGE_W - MARGIN, ly);
      ly += 12;
    }
    ctx.textAlign = "left";
    return;
  }

  ctx.fillStyle = theme.wordmark;
  ctx.font = `8px ${FONT}`;
  ctx.fillText("SUNG-IL IoT BOARD", MARGIN, MARGIN + 6);
  ctx.fillStyle = theme.title;
  ctx.font = `bold 15px ${FONT}`;
  ctx.fillText(title, MARGIN, MARGIN + 26);
  ctx.fillStyle = theme.meta;
  ctx.font = `9px ${FONT}`;
  let ly = MARGIN + 10;
  ctx.textAlign = "right";
  for (const line of lines) {
    ctx.fillText(line, PAGE_W - MARGIN, ly);
    ly += 12;
  }
  ctx.textAlign = "left";
  ctx.strokeStyle = theme.rule;
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
  tone: KpiTone = "neutral",
) {
  const t = KPI_TONE[tone];
  ctx.fillStyle = t.bg;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = t.border;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = t.value;
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
  theme: DailyReportPdfTheme = DEFAULT_THEME,
) {
  ctx.fillStyle = theme.tableHeadBg;
  ctx.fillRect(MARGIN, y - 11, PAGE_W - MARGIN * 2, 16);
  ctx.fillStyle = theme.tableHeadFg;
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

function paintCoverPage(
  ctx: CanvasRenderingContext2D,
  payload: DailyReportPayload,
  pageNo: number,
  totalPages: number,
  theme: DailyReportPdfTheme,
) {
  headerBand(
    ctx,
    "스마트축사 일보",
    [
      payload.farmLabel,
      `보고일 ${payload.reportDate}`,
      `생성 ${payload.generatedAt}`,
    ],
    theme,
  );

  let y = MARGIN + 48;
  const boxW = (PAGE_W - MARGIN * 2 - 18) / 4;
  const ov = payload.overview;
  const kpis: [string, string, KpiTone?][] = [
    [String(ov.barnCount), "축사"],
    [String(ov.controllerCount), "컨트롤러"],
    [String(ov.onlineCount), "온라인", "ok"],
    [
      String(ov.alarmCount),
      "이상상황",
      ov.alarmCount > 0 ? "danger" : "ok",
    ],
  ];
  kpis.forEach(([v, l, tone], i) => {
    kpiBox(ctx, MARGIN + i * (boxW + 6), y, boxW, v, l, 34, tone);
  });
  y += 44;

  const farm24 = averageFarmSeries(payload.barns, "24h");
  y = periodRow(
    ctx,
    y,
    "농장 24시간 요약 · 온도 / 습도 / 채널",
    farm24,
    64,
    theme,
  );

  ctx.fillStyle = INK;
  ctx.font = `bold 11px ${FONT}`;
  ctx.fillText("축사 인덱스", MARGIN, y);
  y += 12;

  const indexCols = [
    MARGIN + 6,
    MARGIN + 130,
    MARGIN + 180,
    MARGIN + 250,
    MARGIN + 320,
  ];
  tableHeaderBar(
    ctx,
    y,
    ["축사", "대수", "온도", "습도", "판정"],
    indexCols,
    theme,
  );
  y += 12;

  ctx.fillStyle = INK;
  ctx.font = `9px ${FONT}`;
  for (const b of payload.barns) {
    if (y > CONTENT_BOTTOM - 120) break;
    ctx.fillStyle = INK;
    ctx.fillText(`${b.stallLabel} ${b.stallNo}`, indexCols[0]!, y);
    ctx.fillText(String(b.kpi.total), indexCols[1]!, y);
    ctx.fillText(`${fmt(b.kpi.tempNow)}℃`, indexCols[2]!, y);
    ctx.fillText(`${fmt(b.kpi.humNow)}%`, indexCols[3]!, y);
    ctx.fillStyle = KPI_TONE[toneFromJudge(b.kpi.judge)].value;
    ctx.fillText(b.kpi.judge, indexCols[4]!, y);
    y += 13;
  }
  y += 10;

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
        MARGIN + 140,
        MARGIN + 200,
        MARGIN + 280,
        MARGIN + 360,
      ];
      tableHeaderBar(
        ctx,
        y,
        ["축사", "번호", "상태", "온도", "습도"],
        aCols,
        theme,
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
        ctx.fillStyle =
          row.status === "offline" ? "#B91C1C" : "#B45309";
        ctx.fillText(statusLabel(row.status), aCols[2]!, y);
        ctx.fillStyle = INK;
        ctx.fillText(`${fmt(row.tempC)}℃`, aCols[3]!, y);
        ctx.fillText(`${fmt(row.humidityPct)}%`, aCols[4]!, y);
        y += 12;
      }
    }
  }

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
        theme,
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
    }
  }

  footer(ctx, pageNo, totalPages, theme);
}

function paintOverviewKpis(
  ctx: CanvasRenderingContext2D,
  y: number,
  payload: DailyReportPayload,
): number {
  const boxW = (PAGE_W - MARGIN * 2 - 18) / 4;
  const ov = payload.overview;
  const kpis: [string, string, KpiTone?][] = [
    [String(ov.barnCount), "축사"],
    [String(ov.controllerCount), "컨트롤러"],
    [String(ov.onlineCount), "온라인", "ok"],
    [
      String(ov.alarmCount),
      "이상상황",
      ov.alarmCount > 0 ? "danger" : "ok",
    ],
  ];
  kpis.forEach(([v, l, tone], i) => {
    kpiBox(ctx, MARGIN + i * (boxW + 6), y, boxW, v, l, 34, tone);
  });
  return y + 44;
}

function paintTodayBanner(
  ctx: CanvasRenderingContext2D,
  y: number,
  payload: DailyReportPayload,
): number {
  const ov = payload.overview;
  const ok = ov.alarmCount === 0 && ov.offlineCount === 0;
  const tone = ok ? KPI_TONE.ok : KPI_TONE.danger;
  ctx.fillStyle = tone.bg;
  ctx.fillRect(MARGIN, y, PAGE_W - MARGIN * 2, 28);
  ctx.strokeStyle = tone.border;
  ctx.strokeRect(MARGIN, y, PAGE_W - MARGIN * 2, 28);
  ctx.fillStyle = tone.value;
  ctx.font = `bold 10px ${FONT}`;
  const line = ok
    ? "오늘 모듈 에러·통신 두절 없음"
    : `오늘 이상상황 ${ov.alarmCount}건 · 통신 두절 ${ov.offlineCount}대`;
  ctx.fillText(line, MARGIN + 10, y + 18);
  return y + 36;
}

function paintBarnIndex(
  ctx: CanvasRenderingContext2D,
  y: number,
  payload: DailyReportPayload,
  theme: DailyReportPdfTheme,
): number {
  ctx.fillStyle = INK;
  ctx.font = `bold 11px ${FONT}`;
  ctx.fillText("축사 인덱스", MARGIN, y);
  y += 12;
  const indexCols = [
    MARGIN + 6,
    MARGIN + 130,
    MARGIN + 180,
    MARGIN + 250,
    MARGIN + 320,
  ];
  tableHeaderBar(
    ctx,
    y,
    ["축사", "대수", "온도", "습도", "판정"],
    indexCols,
    theme,
  );
  y += 12;
  ctx.font = `9px ${FONT}`;
  for (const b of payload.barns) {
    if (y > CONTENT_BOTTOM - 80) break;
    ctx.fillStyle = INK;
    ctx.fillText(`${b.stallLabel} ${b.stallNo}`, indexCols[0]!, y);
    ctx.fillText(String(b.kpi.total), indexCols[1]!, y);
    ctx.fillText(`${fmt(b.kpi.tempNow)}℃`, indexCols[2]!, y);
    ctx.fillText(`${fmt(b.kpi.humNow)}%`, indexCols[3]!, y);
    ctx.fillStyle = KPI_TONE[toneFromJudge(b.kpi.judge)].value;
    ctx.fillText(b.kpi.judge, indexCols[4]!, y);
    y += 13;
  }
  return y + 10;
}

function paintAlarmsBlock(
  ctx: CanvasRenderingContext2D,
  y: number,
  payload: DailyReportPayload,
  theme: DailyReportPdfTheme,
): number {
  const alarms = payload.alarms;
  ctx.fillStyle = INK;
  ctx.font = `bold 11px ${FONT}`;
  ctx.fillText(
    alarms.length
      ? `이상상황 (${alarms.length})`
      : "이상상황",
    MARGIN,
    y,
  );
  y += 12;
  if (alarms.length === 0) {
    ctx.fillStyle = MUTED;
    ctx.font = `9px ${FONT}`;
    ctx.fillText("모듈 에러·통신 두절 없음", MARGIN, y);
    return y + 14;
  }
  const aCols = [
    MARGIN + 4,
    MARGIN + 90,
    MARGIN + 150,
    MARGIN + 210,
    MARGIN + 280,
  ];
  tableHeaderBar(
    ctx,
    y,
    ["축사", "번호", "출처", "심각도", "상세"],
    aCols,
    theme,
  );
  y += 12;
  ctx.font = `8px ${FONT}`;
  for (let i = 0; i < Math.min(alarms.length, 8); i++) {
    const row = alarms[i]!;
    ctx.fillStyle = INK;
    ctx.fillText(`${row.stallLabel} ${row.stallNo}`, aCols[0]!, y);
    ctx.fillText(row.eqpmnNo, aCols[1]!, y);
    ctx.fillText(situationSourceLabel(row.source), aCols[2]!, y);
    ctx.fillStyle = row.severity === "critical" ? "#B91C1C" : "#B45309";
    ctx.fillText(severityLabel(row.severity), aCols[3]!, y);
    ctx.fillStyle = INK;
    ctx.fillText(row.detail.slice(0, 22), aCols[4]!, y);
    y += 12;
  }
  return y + 8;
}

function paintControllerTable(
  ctx: CanvasRenderingContext2D,
  y: number,
  controllers: DailyReportPayload["barns"][number]["controllers"],
  theme: DailyReportPdfTheme,
): number {
  ctx.fillStyle = INK;
  ctx.font = `bold 10px ${FONT}`;
  ctx.fillText("컨트롤러 현황", MARGIN, y);
  y += 12;
  const heads = ["번호", "상태", "온도", "습도", "A%", "B%", "C%"];
  const cols = [
    MARGIN + 4,
    MARGIN + 70,
    MARGIN + 140,
    MARGIN + 210,
    MARGIN + 280,
    MARGIN + 340,
    MARGIN + 400,
  ];
  tableHeaderBar(ctx, y, heads, cols, theme);
  y += 12;
  ctx.font = `8px ${FONT}`;
  for (let rowIdx = 0; rowIdx < controllers.length; rowIdx++) {
    if (y > CONTENT_BOTTOM - 28) break;
    const c = controllers[rowIdx]!;
    if (rowIdx % 2 === 1) {
      ctx.fillStyle = "#F9FAFB";
      ctx.fillRect(MARGIN, y - 9, PAGE_W - MARGIN * 2, 12);
    }
    ctx.fillStyle = INK;
    ctx.fillText(c.eqpmnNo, cols[0]!, y);
    ctx.fillStyle = KPI_TONE[toneFromControllerStatus(c.status)].value;
    ctx.fillText(statusLabel(c.status), cols[1]!, y);
    ctx.fillStyle = INK;
    ctx.fillText(`${fmt(c.tempC)}℃`, cols[2]!, y);
    ctx.fillText(`${fmt(c.humidityPct)}%`, cols[3]!, y);
    ctx.fillText(c.motorA == null ? "—" : fmt(c.motorA, 0), cols[4]!, y);
    ctx.fillText(c.motorB == null ? "—" : fmt(c.motorB, 0), cols[5]!, y);
    ctx.fillText(c.motorC == null ? "—" : fmt(c.motorC, 0), cols[6]!, y);
    y += 12;
  }
  return y + 8;
}

function paintBarnKpiRow(
  ctx: CanvasRenderingContext2D,
  y: number,
  barn: DailyReportPayload["barns"][number],
  compact: boolean,
): number {
  const kpiItems: [string, string, KpiTone?][] = compact
    ? [
        [`${fmt(barn.kpi.tempNow)}℃`, "온도"],
        [`${fmt(barn.kpi.humNow)}%`, "습도"],
        [
          barn.kpi.motorA == null ? "—" : `${fmt(barn.kpi.motorA, 0)}%`,
          CHANNEL_SLOT_LABELS.A,
        ],
        [
          barn.kpi.motorB == null ? "—" : `${fmt(barn.kpi.motorB, 0)}%`,
          CHANNEL_SLOT_LABELS.B,
        ],
        [
          barn.kpi.motorC == null ? "—" : `${fmt(barn.kpi.motorC, 0)}%`,
          CHANNEL_SLOT_LABELS.C,
        ],
        [barn.kpi.judge, "판정", toneFromJudge(barn.kpi.judge)],
      ]
    : [
        [`${fmt(barn.kpi.tempNow)}℃`, "온도"],
        [`${fmt(barn.kpi.humNow)}%`, "습도"],
        [
          barn.kpi.motorA == null ? "—" : `${fmt(barn.kpi.motorA, 0)}%`,
          CHANNEL_SLOT_LABELS.A,
        ],
        [
          barn.kpi.motorB == null ? "—" : `${fmt(barn.kpi.motorB, 0)}%`,
          CHANNEL_SLOT_LABELS.B,
        ],
        [
          barn.kpi.motorC == null ? "—" : `${fmt(barn.kpi.motorC, 0)}%`,
          CHANNEL_SLOT_LABELS.C,
        ],
        [`${fmt(barn.kpi.tMin24)}~${fmt(barn.kpi.tMax24)}℃`, "24h 온도"],
        [`${barn.kpi.online}/${barn.kpi.total}`, "온라인"],
        [barn.kpi.judge, "판정", toneFromJudge(barn.kpi.judge)],
      ];
  const kpiGap = 4;
  const kpiW =
    (PAGE_W - MARGIN * 2 - kpiGap * (kpiItems.length - 1)) / kpiItems.length;
  kpiItems.forEach(([v, l, tone], i) => {
    kpiBox(ctx, MARGIN + i * (kpiW + kpiGap), y, kpiW, v, l, 32, tone);
  });
  return y + 40;
}

function paintCoverBrief(
  ctx: CanvasRenderingContext2D,
  payload: DailyReportPayload,
  theme: DailyReportPdfTheme,
) {
  headerBand(
    ctx,
    "스마트축사 일보",
    [payload.farmLabel, `보고일 ${payload.reportDate}`, "오늘 브리프"],
    theme,
  );
  let y = paintOverviewKpis(ctx, MARGIN + 48, payload);
  y = paintTodayBanner(ctx, y, payload);
  y = paintBarnIndex(ctx, y, payload, theme);
  paintAlarmsBlock(ctx, y, payload, theme);
  footer(ctx, 1, 1 + payload.barns.length, theme);
}

function paintCoverOps(
  ctx: CanvasRenderingContext2D,
  payload: DailyReportPayload,
  theme: DailyReportPdfTheme,
) {
  headerBand(
    ctx,
    "스마트축사 일보",
    [payload.farmLabel, `보고일 ${payload.reportDate}`, "운영 브리핑"],
    theme,
  );
  let y = paintOverviewKpis(ctx, MARGIN + 48, payload);
  y = periodRow(
    ctx,
    y,
    "농장 24시간 · 온도 / 습도 / 채널",
    averageFarmSeries(payload.barns, "24h"),
    72,
    theme,
  );
  paintAlarmsBlock(ctx, y, payload, theme);
  const extra = collectAttentionRows(payload.barns).length;
  footer(ctx, 1, 1 + payload.barns.length + extra, theme);
}

function paintBarnBrief(
  ctx: CanvasRenderingContext2D,
  payload: DailyReportPayload,
  barn: DailyReportPayload["barns"][number],
  theme: DailyReportPdfTheme,
) {
  headerBand(
    ctx,
    `${barn.stallLabel} ${barn.stallNo}`,
    [payload.farmLabel, `컨트롤러 ${barn.kpi.total}대`, "오늘 24시간"],
    theme,
  );
  let y = paintBarnKpiRow(ctx, MARGIN + 46, barn, true);
  y = periodRow(
    ctx,
    y,
    "24시간 · 온도 / 습도 / 채널",
    barn.periods["24h"],
    78,
    theme,
  );
  paintControllerTable(ctx, y, barn.controllers, theme);
  footer(ctx, 2, 1 + payload.barns.length, theme);
}

function paintBarnOps(
  ctx: CanvasRenderingContext2D,
  payload: DailyReportPayload,
  barn: DailyReportPayload["barns"][number],
  theme: DailyReportPdfTheme,
) {
  headerBand(
    ctx,
    `${barn.stallLabel} ${barn.stallNo}`,
    [payload.farmLabel, `컨트롤러 ${barn.kpi.total}대`, "24시간 · 7일"],
    theme,
  );
  let y = paintBarnKpiRow(ctx, MARGIN + 46, barn, false);
  y = periodRow(
    ctx,
    y,
    "24시간 · 온도 / 습도 / 채널",
    barn.periods["24h"],
    58,
    theme,
  );
  y = periodRow(
    ctx,
    y,
    "7일 · 온도 / 습도 / 채널",
    barn.periods["7d"],
    46,
    theme,
  );
  paintControllerTable(ctx, y, barn.controllers, theme);
  const extra = collectAttentionRows(payload.barns).length;
  footer(ctx, 2, 1 + payload.barns.length + extra, theme);
}

function paintBarnArchive(
  ctx: CanvasRenderingContext2D,
  payload: DailyReportPayload,
  barn: DailyReportPayload["barns"][number],
  theme: DailyReportPdfTheme,
) {
  headerBand(
    ctx,
    `${barn.stallLabel} ${barn.stallNo}`,
    [payload.farmLabel, `컨트롤러 ${barn.kpi.total}대`, "24시간 · 7일 · 30일"],
    theme,
  );
  let y = paintBarnKpiRow(ctx, MARGIN + 46, barn, false);
  for (const p of [
    { id: "24h" as const, label: "24시간", h: 48 },
    { id: "7d" as const, label: "7일", h: 40 },
    { id: "30d" as const, label: "30일", h: 40 },
  ]) {
    y = periodRow(
      ctx,
      y,
      `${p.label} · 온도 / 습도 / 채널`,
      barn.periods[p.id],
      p.h,
      theme,
    );
  }
  const total = 1 + payload.barns.length + payload.barns.reduce((n, b) => n + b.controllers.length, 0);
  footer(ctx, 2, total, theme);
}

function paintAppendixSample(
  ctx: CanvasRenderingContext2D,
  payload: DailyReportPayload,
  theme: DailyReportPdfTheme,
  caption: string,
) {
  const hit =
    payload.barns.flatMap((b) =>
      b.controllers
        .filter((c) => c.status === "offline" || c.status === "caution")
        .map((ctrl) => ({ barn: b, ctrl })),
    )[0] ?? {
      barn: payload.barns[0]!,
      ctrl: payload.barns[0]!.controllers[0]!,
    };
  headerBand(
    ctx,
    `${hit.barn.stallLabel} ${hit.barn.stallNo} · ${hit.ctrl.eqpmnNo}번`,
    [payload.farmLabel, caption],
    theme,
  );
  let y = MARGIN + 46;
  const kpiW = (PAGE_W - MARGIN * 2 - 20) / 6;
  const kpis: [string, string, KpiTone?][] = [
    [`${fmt(hit.ctrl.tempC)}℃`, "온도"],
    [`${fmt(hit.ctrl.humidityPct)}%`, "습도"],
    [
      hit.ctrl.motorA == null ? "—" : `${fmt(hit.ctrl.motorA, 0)}%`,
      CHANNEL_SLOT_LABELS.A,
    ],
    [
      hit.ctrl.motorB == null ? "—" : `${fmt(hit.ctrl.motorB, 0)}%`,
      CHANNEL_SLOT_LABELS.B,
    ],
    [
      hit.ctrl.motorC == null ? "—" : `${fmt(hit.ctrl.motorC, 0)}%`,
      CHANNEL_SLOT_LABELS.C,
    ],
    [
      statusLabel(hit.ctrl.status),
      "상태",
      toneFromControllerStatus(hit.ctrl.status),
    ],
  ];
  kpis.forEach(([v, l, tone], i) => {
    kpiBox(ctx, MARGIN + i * (kpiW + 4), y, kpiW, v, l, 32, tone);
  });
  y += 40;
  y = periodRow(
    ctx,
    y,
    "24시간 · 온도 / 습도 / 채널",
    hit.barn.periods["24h"],
    64,
    theme,
  );
  footer(ctx, 3, 3, theme);
}

export type DailyReportContentLayoutId = "brief" | "ops" | "archive";

export function renderDailyReportContentPreview(
  layout: DailyReportContentLayoutId,
  payload: DailyReportPayload,
): HTMLCanvasElement[] {
  const theme = DEFAULT_THEME;
  const barn = payload.barns[0];
  if (!barn) return [];
  const pages: HTMLCanvasElement[] = [];
  const cover = createPageCanvas();
  const barnPage = createPageCanvas();
  if (layout === "brief") {
    paintCoverBrief(cover.ctx, payload, theme);
    paintBarnBrief(barnPage.ctx, payload, barn, theme);
    pages.push(cover.canvas, barnPage.canvas);
  } else if (layout === "ops") {
    paintCoverOps(cover.ctx, payload, theme);
    paintBarnOps(barnPage.ctx, payload, barn, theme);
    const extra = createPageCanvas();
    paintAppendixSample(extra.ctx, payload, theme, "문제 장치만 첨부");
    pages.push(cover.canvas, barnPage.canvas, extra.canvas);
  } else {
    paintCoverPage(cover.ctx, payload, 1, 3, theme);
    paintBarnArchive(barnPage.ctx, payload, barn, theme);
    const extra = createPageCanvas();
    paintAppendixSample(extra.ctx, payload, theme, "컨트롤러 전부 첨부");
    pages.push(cover.canvas, barnPage.canvas, extra.canvas);
  }
  return pages;
}

function wrapBriefLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const chars = [...text];
  const lines: string[] = [];
  let cur = "";
  for (const ch of chars) {
    const next = cur + ch;
    if (ctx.measureText(next).width > maxWidth && cur) {
      lines.push(cur);
      cur = ch;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function paintBriefParagraphs(
  ctx: CanvasRenderingContext2D,
  y: number,
  title: string,
  paragraphs: string[],
): number {
  ctx.fillStyle = INK;
  ctx.font = `bold 11px ${FONT}`;
  ctx.fillText(title, MARGIN, y);
  y += 14;
  ctx.font = `9px ${FONT}`;
  const maxW = PAGE_W - MARGIN * 2;
  for (const p of paragraphs) {
    for (const line of wrapBriefLines(ctx, p, maxW)) {
      if (y > CONTENT_BOTTOM - 20) return y;
      ctx.fillStyle = INK;
      ctx.fillText(line, MARGIN, y);
      y += 13;
    }
    y += 4;
  }
  return y;
}

function paintCoverWeeklyBriefing(
  ctx: CanvasRenderingContext2D,
  payload: DailyReportPayload,
  briefing: DailyReportBriefing,
  theme: DailyReportPdfTheme,
  totalPages: number,
) {
  headerBand(
    ctx,
    "스마트축사 일보",
    [payload.farmLabel, `보고일 ${payload.reportDate}`, "주간 브리핑"],
    theme,
  );
  let y = paintOverviewKpis(ctx, MARGIN + 48, payload);
  const alarmGuides = farmAlarmGuides(payload);
  y = periodStack(
    ctx,
    y,
    "농장 7일",
    briefing.farm7d,
    theme,
    alarmGuides,
    92,
    "기록 부족",
    ALARM_GUIDE_LEGEND,
  );

  ctx.fillStyle = INK;
  ctx.font = `bold 11px ${FONT}`;
  ctx.fillText("축사유형", MARGIN, y);
  y += 12;
  const cols = [
    MARGIN + 6,
    MARGIN + 100,
    MARGIN + 150,
    MARGIN + 220,
    MARGIN + 300,
  ];
  tableHeaderBar(
    ctx,
    y,
    ["유형", "동", "평균 온도", "평균 습도", "7일 권장구간 밖"],
    cols,
    theme,
  );
  y += 12;
  ctx.font = `9px ${FONT}`;
  for (const type of briefing.types) {
    if (y > CONTENT_BOTTOM - 90) break;
    ctx.fillStyle = INK;
    ctx.fillText(type.stallLabel, cols[0]!, y);
    ctx.fillText(String(type.barnCount), cols[1]!, y);
    ctx.fillText(`${fmt(type.avgTemp7d)}℃`, cols[2]!, y);
    ctx.fillText(`${fmt(type.avgHum7d, 0)}%`, cols[3]!, y);
    ctx.fillText(
      type.hoursOutsideTemp7d == null ? "—" : `${type.hoursOutsideTemp7d}시간`,
      cols[4]!,
      y,
    );
    y += 13;
  }
  y += 12;
  paintBriefParagraphs(
    ctx,
    y,
    "브리핑",
    farmBriefingFacts(briefing, payload),
  );
  footer(ctx, 1, totalPages, theme);
}

function paintStallTypeBriefing(
  ctx: CanvasRenderingContext2D,
  payload: DailyReportPayload,
  type: DailyReportTypeBrief,
  theme: DailyReportPdfTheme,
  pageNo: number,
  totalPages: number,
) {
  headerBand(
    ctx,
    type.stallLabel,
    [payload.farmLabel, `축사유형 ${type.barnCount}동`, "주간 브리핑"],
    theme,
  );
  let y = MARGIN + 48;
  const recTemp = type.recommendTemp
    ? `${type.recommendTemp.lo}~${type.recommendTemp.hi}℃`
    : "—";
  const kpis: [string, string, KpiTone?][] = [
    [`${fmt(type.avgTemp7d)}℃`, "7일 온도"],
    [`${fmt(type.avgHum7d, 0)}%`, "7일 습도"],
    [recTemp, "권장 온도"],
    [
      type.hoursOutsideTemp7d == null ? "—" : `${type.hoursOutsideTemp7d}시간`,
      "권장 밖",
      (type.hoursOutsideTemp7d ?? 0) > 0 ? "caution" : "ok",
    ],
    [`${type.online}/${type.controllerTotal}`, "온라인"],
    [type.judge, "수신", toneFromJudge(type.judge)],
  ];
  const gap = 4;
  const w = (PAGE_W - MARGIN * 2 - gap * 5) / 6;
  kpis.forEach(([v, l, tone], i) => {
    kpiBox(ctx, MARGIN + i * (w + gap), y, w, v, l, 34, tone);
  });
  y += 44;
  y = periodStack(
    ctx,
    y,
    `${type.stallLabel} 7일`,
    type.series7d,
    theme,
    typeChartGuides(type, farmAlarmGuides(payload)),
    86,
    "기록 부족",
    RECOMMEND_GUIDE_LEGEND,
  );

  ctx.fillStyle = INK;
  ctx.font = `bold 11px ${FONT}`;
  ctx.fillText("축사", MARGIN, y);
  y += 12;
  const cols = [
    MARGIN + 6,
    MARGIN + 100,
    MARGIN + 160,
    MARGIN + 230,
    MARGIN + 310,
  ];
  tableHeaderBar(
    ctx,
    y,
    ["축사", "대수", "온도", "습도", "판정"],
    cols,
    theme,
  );
  y += 12;
  ctx.font = `9px ${FONT}`;
  for (const row of type.barns) {
    if (y > CONTENT_BOTTOM - 70) break;
    ctx.fillStyle = INK;
    ctx.fillText(`${row.stallLabel} ${row.stallNo}`, cols[0]!, y);
    ctx.fillText(String(row.total), cols[1]!, y);
    ctx.fillText(`${fmt(row.tempNow)}℃`, cols[2]!, y);
    ctx.fillText(`${fmt(row.humNow)}%`, cols[3]!, y);
    ctx.fillStyle = KPI_TONE[toneFromJudge(row.judge)].value;
    ctx.fillText(row.judge, cols[4]!, y);
    y += 13;
  }
  y += 12;
  paintBriefParagraphs(ctx, y, "브리핑", typeBriefingFacts(type));
  footer(ctx, pageNo, totalPages, theme);
}

function riskSideLabel(side: DailyReportRiskWindow["side"]): string {
  if (side === "low") return "저온";
  if (side === "both") return "고온·저온";
  if (side === "high") return "고온";
  return "—";
}

function paintRiskWindowBriefing(
  ctx: CanvasRenderingContext2D,
  payload: DailyReportPayload,
  risk: DailyReportRiskWindow,
  theme: DailyReportPdfTheme,
  totalPages: number,
) {
  const windowLine = risk.found
    ? `${risk.startLabel} ~ ${risk.endLabel}`
    : "30일";
  headerBand(
    ctx,
    "권장구간 이탈",
    [payload.farmLabel, windowLine, "30일 중 가장 긴 구간"],
    theme,
  );
  let y = MARGIN + 48;
  const peak =
    !risk.found
      ? "—"
      : risk.side === "low"
        ? `${risk.peakExcess.toFixed(1)}℃`
        : `+${risk.peakExcess.toFixed(1)}℃`;
  const kpis: [string, string, KpiTone?][] = [
    [risk.found ? `${risk.hours}시간` : "없음", "지속"],
    [peak, "이탈 폭", risk.found ? "danger" : "ok"],
    [risk.found ? risk.stallLabel : "—", "가장 긴 유형"],
    [riskSideLabel(risk.side), "방향", risk.found ? "caution" : "ok"],
  ];
  const gap = 4;
  const w = (PAGE_W - MARGIN * 2 - gap * 3) / 4;
  kpis.forEach(([v, l, tone], i) => {
    kpiBox(ctx, MARGIN + i * (w + gap), y, w, v, l, 34, tone);
  });
  y += 44;

  if (risk.found) {
    const fallback = farmAlarmGuides(payload);
    y = periodStack(
      ctx,
      y,
      "이탈 구간",
      risk.series,
      theme,
      {
        temp: bandGuide(risk.recommendTemp, fallback.temp),
        humidity: bandGuide(risk.recommendHum, fallback.humidity),
      },
      90,
      "기록 부족",
      RECOMMEND_GUIDE_LEGEND,
    );

    ctx.fillStyle = INK;
    ctx.font = `bold 11px ${FONT}`;
    ctx.fillText("구간 시각", MARGIN, y);
    y += 12;
    const cols = [MARGIN + 6, MARGIN + 100, MARGIN + 180, MARGIN + 260];
    tableHeaderBar(ctx, y, ["시각", "온도", "습도", "권장"], cols, theme);
    y += 12;
    ctx.font = `9px ${FONT}`;
    for (const row of risk.samples) {
      if (y > CONTENT_BOTTOM - 70) break;
      ctx.fillStyle = INK;
      ctx.fillText(row.label, cols[0]!, y);
      ctx.fillStyle = row.outsideTemp ? KPI_TONE.danger.value : INK;
      ctx.fillText(`${fmt(row.temp)}℃`, cols[1]!, y);
      ctx.fillStyle = INK;
      ctx.fillText(`${fmt(row.humidity, 0)}%`, cols[2]!, y);
      ctx.fillStyle = row.outsideTemp ? KPI_TONE.danger.value : MUTED;
      ctx.fillText(row.outsideTemp ? "밖" : "안", cols[3]!, y);
      y += 13;
    }
    y += 12;
  }

  paintBriefParagraphs(ctx, y, "브리핑", riskBriefingFacts(risk));
  footer(ctx, totalPages, totalPages, theme);
}

function briefingPageCount(typeCount: number): number {
  return 1 + typeCount + 1;
}

export function renderDailyReportBriefingPreview(
  payload: DailyReportPayload,
): HTMLCanvasElement[] {
  const theme = DEFAULT_THEME;
  const briefing = buildDailyReportBriefing(payload);
  const totalPages = briefingPageCount(briefing.types.length);
  const pages: HTMLCanvasElement[] = [];
  const cover = createPageCanvas();
  paintCoverWeeklyBriefing(cover.ctx, payload, briefing, theme, totalPages);
  pages.push(cover.canvas);
  briefing.types.forEach((type, i) => {
    const page = createPageCanvas();
    paintStallTypeBriefing(
      page.ctx,
      payload,
      type,
      theme,
      i + 2,
      totalPages,
    );
    pages.push(page.canvas);
  });
  const risk = createPageCanvas();
  paintRiskWindowBriefing(risk.ctx, payload, briefing.risk, theme, totalPages);
  pages.push(risk.canvas);
  return pages;
}

export async function buildAndDownloadDailyReportPdf(
  payload: DailyReportPayload,
  onProgress?: (p: DailyReportProgress) => void,
): Promise<void> {
  const briefing = buildDailyReportBriefing(payload);
  const totalPages = briefingPageCount(briefing.types.length);
  let pageNo = 0;

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  let first = true;
  const theme = DEFAULT_THEME;

  const reportProgress = (message: string) => {
    onProgress?.({
      phase: "render",
      current: pageNo,
      total: totalPages,
      message,
    });
  };

  {
    pageNo += 1;
    reportProgress("농장 주간 브리핑");
    const { canvas, ctx } = createPageCanvas();
    paintCoverWeeklyBriefing(ctx, payload, briefing, theme, totalPages);
    addCanvasPage(pdf, canvas, first);
    first = false;
    await yieldFrame();
  }

  for (const type of briefing.types) {
    pageNo += 1;
    reportProgress(`${type.stallLabel} 주간 브리핑`);
    const { canvas, ctx } = createPageCanvas();
    paintStallTypeBriefing(ctx, payload, type, theme, pageNo, totalPages);
    addCanvasPage(pdf, canvas, first);
    first = false;
    await yieldFrame();
  }

  {
    pageNo += 1;
    reportProgress("권장구간 이탈");
    const { canvas, ctx } = createPageCanvas();
    paintRiskWindowBriefing(ctx, payload, briefing.risk, theme, totalPages);
    addCanvasPage(pdf, canvas, first);
  }

  const filename = dailyReportPdfFilename(payload);
  pdf.save(filename);
  onProgress?.({
    phase: "done",
    current: totalPages,
    total: totalPages,
    message: "다운로드 완료",
  });
}
