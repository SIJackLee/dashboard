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
const MARGIN = 36;
const ACCENT = "#DC2626";
const INK = "#111827";
const MUTED = "#6B7280";
const RULE = "#E5E7EB";
const FONT =
  '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", "Segoe UI", sans-serif';

function fmt(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
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
      ctx.arc(px, py, 2.2, 0, Math.PI * 2);
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
  return countSeriesPoints(seriesList) >= 1 ? full : Math.min(28, full);
}

function periodBlock(
  ctx: CanvasRenderingContext2D,
  yStart: number,
  periodLabel: string,
  series: DailyReportSeries,
): number {
  let y = yStart;
  ctx.fillStyle = ACCENT;
  ctx.font = `bold 11px ${FONT}`;
  ctx.fillText(periodLabel, MARGIN, y);
  y += 10;

  const chartW = PAGE_W - MARGIN * 2;
  const fullH = 64;

  const tempSeries = [
    { values: series.temp, color: "#EA580C", label: "온도" },
  ];
  const humSeries = [
    { values: series.humidity, color: "#2563EB", label: "습도" },
  ];
  const motorSeries = [
    { values: series.motorA, color: "#059669", label: "A" },
    { values: series.motorB, color: "#7C3AED", label: "B" },
  ].filter((s) => s.values.some((v) => v != null));

  const blocks: {
    title: string;
    series: { values: (number | null)[]; color: string; label: string }[];
    legend?: { color: string; label: string }[];
  }[] = [
    { title: "온도 (℃)", series: tempSeries },
    { title: "습도 (%)", series: humSeries },
    {
      title: "모터 (%)",
      series: motorSeries.length
        ? motorSeries
        : [{ values: series.motorA, color: "#059669", label: "A" }],
      legend: [
        { color: "#059669", label: "A" },
        { color: "#7C3AED", label: "B" },
      ],
    },
  ];

  for (const b of blocks) {
    ctx.fillStyle = INK;
    ctx.font = `10px ${FONT}`;
    ctx.fillText(b.title, MARGIN, y + 10);
    if (b.legend) {
      drawLegend(ctx, MARGIN + 72, y + 8, b.legend);
    }
    y += 14;
    const h = chartHeightFor(b.series, fullH);
    drawLineChart(ctx, MARGIN, y, chartW, h, series.categories, b.series, {
      emptyHint: "기록 부족",
    });
    y += h + 8;
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
  ctx.font = `9px ${FONT}`;
  ctx.fillText("SUNG-IL IoT BOARD", MARGIN, MARGIN + 8);
  ctx.fillStyle = ACCENT;
  ctx.font = `bold 18px ${FONT}`;
  ctx.fillText(title, MARGIN, MARGIN + 32);
  ctx.fillStyle = MUTED;
  ctx.font = `10px ${FONT}`;
  let ly = MARGIN + 12;
  ctx.textAlign = "right";
  for (const line of lines) {
    ctx.fillText(line, PAGE_W - MARGIN, ly);
    ly += 14;
  }
  ctx.textAlign = "left";
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MARGIN, MARGIN + 44);
  ctx.lineTo(PAGE_W - MARGIN, MARGIN + 44);
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
) {
  ctx.fillStyle = "#FEF2F2";
  ctx.fillRect(x, y, w, 44);
  ctx.strokeStyle = "#FECACA";
  ctx.strokeRect(x, y, w, 44);
  ctx.fillStyle = INK;
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillText(value, x + 8, y + 20);
  ctx.fillStyle = MUTED;
  ctx.font = `9px ${FONT}`;
  ctx.fillText(label, x + 8, y + 36);
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
  const barnPagePairs = payload.barns.length * 2;
  const totalPages = 1 + barnPagePairs;
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

    let y = MARGIN + 64;
    const boxW = (PAGE_W - MARGIN * 2 - 18) / 4;
    const ov = payload.overview;
    const kpis: [string, string][] = [
      [String(ov.barnCount), "축사"],
      [String(ov.controllerCount), "컨트롤러"],
      [String(ov.onlineCount), "온라인"],
      [String(ov.alarmCount), "알람"],
    ];
    kpis.forEach(([v, l], i) => {
      kpiBox(ctx, MARGIN + i * (boxW + 6), y, boxW, v, l);
    });
    y += 56;

    ctx.fillStyle = INK;
    ctx.font = `bold 12px ${FONT}`;
    ctx.fillText("축사 인덱스", MARGIN, y);
    y += 16;

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
    y += 14;

    ctx.fillStyle = INK;
    ctx.font = `10px ${FONT}`;
    for (const b of payload.barns) {
      ctx.fillText(`${b.stallLabel} ${b.stallNo}`, indexCols[0]!, y);
      ctx.fillText(b.stallTyCode, indexCols[1]!, y);
      ctx.fillText(String(b.kpi.total), indexCols[2]!, y);
      ctx.fillText(`${fmt(b.kpi.tempNow)}℃`, indexCols[3]!, y);
      ctx.fillText(`${fmt(b.kpi.humNow)}%`, indexCols[4]!, y);
      ctx.fillText(b.kpi.judge, indexCols[5]!, y);
      y += 15;
    }

    y += 10;
    ctx.fillStyle = MUTED;
    ctx.font = `9px ${FONT}`;
    ctx.fillText(
      "다음 장: 축사별 KPI · 24h/7d/30d 트렌드 · 상세표",
      MARGIN,
      y,
    );
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
    // Page A: KPI + 24h
    {
      pageNo += 1;
      reportProgress(`${barn.stallLabel} ${barn.stallNo} · KPI/24h`);
      const { canvas, ctx } = createPageCanvas();
      headerBand(ctx, `${barn.stallLabel} ${barn.stallNo}`, [
        `${payload.farmKey.lsindRegistNo} / ${payload.farmKey.itemCode}`,
        `${barn.stallTyCode} · 컨트롤러 ${barn.kpi.total}대`,
        `보고일 ${payload.reportDate}`,
      ]);

      let y = MARGIN + 60;
      ctx.fillStyle = INK;
      ctx.font = `bold 11px ${FONT}`;
      ctx.fillText("KPI 요약", MARGIN, y);
      y += 8;
      const boxW = (PAGE_W - MARGIN * 2 - 18) / 4;
      const row1: [string, string][] = [
        [`${fmt(barn.kpi.tempNow)}℃`, "현재 온도"],
        [`${fmt(barn.kpi.humNow)}%`, "현재 습도"],
        [`${fmt(barn.kpi.motorA, 0)}%`, "모터 A"],
        [
          barn.kpi.motorB == null ? "—" : `${fmt(barn.kpi.motorB, 0)}%`,
          "모터 B",
        ],
      ];
      row1.forEach(([v, l], i) => {
        kpiBox(ctx, MARGIN + i * (boxW + 6), y, boxW, v, l);
      });
      y += 52;
      const row2: [string, string][] = [
        [`${fmt(barn.kpi.tMin24)}℃`, "24h 최저 T"],
        [`${fmt(barn.kpi.tMax24)}℃`, "24h 최고 T"],
        [`${barn.kpi.online}/${barn.kpi.total}`, "온라인"],
        [barn.kpi.judge, "판정"],
      ];
      row2.forEach(([v, l], i) => {
        kpiBox(ctx, MARGIN + i * (boxW + 6), y, boxW, v, l);
      });
      y += 58;

      y = periodBlock(ctx, y, "24시간 트렌드 · 온도 / 습도 / 모터", barn.periods["24h"]);
      footer(ctx, pageNo, totalPages);
      addCanvasPage(pdf, canvas, first);
      first = false;
      await yieldFrame();
    }

    // Page B: 7d + 30d + tables
    {
      pageNo += 1;
      reportProgress(`${barn.stallLabel} ${barn.stallNo} · 7d/30d/표`);
      const { canvas, ctx } = createPageCanvas();
      headerBand(ctx, `${barn.stallLabel} ${barn.stallNo} · 계속`, [
        "7일 / 30일 + 상세표",
        barn.stallTyCode,
        `p.${pageNo}/${totalPages}`,
      ]);

      let y = MARGIN + 56;
      // Compact 7d and 30d — one metric row each to fit, or full if space
      for (const p of periodOrder.slice(1)) {
        ctx.fillStyle = ACCENT;
        ctx.font = `bold 11px ${FONT}`;
        ctx.fillText(`${p.label} 트렌드`, MARGIN, y);
        y += 8;
        const s = barn.periods[p.id];
        const chartW = (PAGE_W - MARGIN * 2 - 12) / 3;
        const chartH = 70;
        const metrics: {
          title: string;
          values: (number | null)[];
          color: string;
          extra?: (number | null)[];
        }[] = [
          { title: "온도", values: s.temp, color: "#EA580C" },
          { title: "습도", values: s.humidity, color: "#2563EB" },
          {
            title: "모터",
            values: s.motorA,
            color: "#059669",
            extra: s.motorB,
          },
        ];
        metrics.forEach((m, i) => {
          const x = MARGIN + i * (chartW + 6);
          ctx.fillStyle = INK;
          ctx.font = `9px ${FONT}`;
          ctx.fillText(m.title, x, y + 8);
          const seriesList = m.extra
            ? [
                { values: m.values, color: m.color, label: "A" },
                { values: m.extra, color: "#7C3AED", label: "B" },
              ].filter((x) => x.values.some((v) => v != null))
            : [{ values: m.values, color: m.color, label: m.title }];
          if (m.title === "모터") {
            drawLegend(ctx, x + 28, y + 8, [
              { color: "#059669", label: "A" },
              { color: "#7C3AED", label: "B" },
            ]);
          }
          const h = chartHeightFor(
            seriesList.length
              ? seriesList
              : [{ values: m.values, color: m.color, label: m.title }],
            chartH,
          );
          drawLineChart(
            ctx,
            x,
            y + 12,
            chartW,
            h,
            s.categories,
            seriesList.length
              ? seriesList
              : [{ values: m.values, color: m.color, label: m.title }],
            { emptyHint: "기록 부족" },
          );
        });
        y += chartH + 28;
      }

      ctx.fillStyle = INK;
      ctx.font = `bold 11px ${FONT}`;
      ctx.fillText("상세표 · 컨트롤러 현황", MARGIN, y);
      y += 16;
      const heads = ["ID", "번호", "온도", "습도", "A%", "B%"];
      const cols = [
        MARGIN + 4,
        MARGIN + 130,
        MARGIN + 170,
        MARGIN + 220,
        MARGIN + 270,
        MARGIN + 320,
      ];
      tableHeaderBar(ctx, y, heads, cols);
      y += 14;
      ctx.font = `9px ${FONT}`;
      barn.controllers.slice(0, 12).forEach((c, rowIdx) => {
        if (rowIdx % 2 === 1) {
          ctx.fillStyle = "#F9FAFB";
          ctx.fillRect(MARGIN, y - 10, PAGE_W - MARGIN * 2, 13);
        }
        ctx.fillStyle = INK;
        ctx.fillText(c.controllerKey, cols[0]!, y);
        ctx.fillText(c.eqpmnNo, cols[1]!, y);
        ctx.fillText(`${fmt(c.tempC)}℃`, cols[2]!, y);
        ctx.fillText(`${fmt(c.humidityPct)}%`, cols[3]!, y);
        ctx.fillText(c.motorA == null ? "—" : fmt(c.motorA, 0), cols[4]!, y);
        ctx.fillText(c.motorB == null ? "—" : fmt(c.motorB, 0), cols[5]!, y);
        y += 13;
      });

      y += 12;
      ctx.fillStyle = INK;
      ctx.font = `bold 11px ${FONT}`;
      ctx.fillText("상세표 · 24시간 발췌", MARGIN, y);
      y += 16;
      const dHeads = ["시각", "온도℃", "습도%", "모터A", "모터B"];
      const dCols = [
        MARGIN + 4,
        MARGIN + 74,
        MARGIN + 144,
        MARGIN + 214,
        MARGIN + 284,
      ];
      tableHeaderBar(ctx, y, dHeads, dCols);
      y += 14;
      ctx.font = `9px ${FONT}`;
      barn.detailRows.forEach((row, rowIdx) => {
        if (y > PAGE_H - 50) return;
        if (rowIdx % 2 === 1) {
          ctx.fillStyle = "#F9FAFB";
          ctx.fillRect(MARGIN, y - 10, PAGE_W - MARGIN * 2, 13);
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
        y += 13;
      });

      footer(ctx, pageNo, totalPages);
      addCanvasPage(pdf, canvas, first);
      first = false;
      await yieldFrame();
    }
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
