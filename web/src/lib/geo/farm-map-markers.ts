import type { FarmMapPoint } from "@/lib/data/farm-geo-summary";
import { buildFarmAlarmsHref } from "@/lib/auth/farm-access";
import { farmKeyId } from "@/lib/data/farm-key";
import { formatItemCodeLabel } from "@/lib/data/item-code";
import type { MapZoomStage } from "@/lib/geo/farm-map-zoom";
import {
  farmRiskLevel,
  hexWithAlpha,
  type MapRiskLevel,
  PULSE_ALARM_THRESHOLD,
  regionRiskLevel,
  RISK_STYLE,
  scaledMarkerMetrics,
} from "@/lib/geo/farm-map-marker-scale";

export { PULSE_ALARM_THRESHOLD };

export const MAP_PIN = {
  ok: "#059669",
  okLight: "#10b981",
  warn: "#d97706",
  issue: "#dc2626",
  ink: "#ffffff",
  muted: "#64748b",
  clusterFill: "#047857",
  chipBg: "#7c3aed",
} as const;

function markerVisibilityStyle(visible: boolean): string {
  return visible
    ? "opacity:1;pointer-events:auto;transition:opacity 0.18s ease,transform 0.18s ease;"
    : "opacity:0;pointer-events:none;transition:opacity 0.18s ease,transform 0.18s ease;";
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

type RegionRow = {
  title: string;
  controllerSum: number;
  alarmSum: number;
  criticalSum: number;
  offlineSum: number;
  issueCount: number;
};

/** Z8 원 · Z9/Z11 사각 — 투명 배경 + 컨트롤러 수 + 지역명 */
export function buildRegionMarkerIconSpec(opts: {
  stage: MapZoomStage;
  row: RegionRow;
  totalControllers: number;
  cohortMax: number;
  visible?: boolean;
}): { html: string; w: number; h: number; anchorX: number; anchorY: number } {
  const { stage, row, totalControllers, cohortMax, visible = true } = opts;
  const isCircle = stage === 0;
  const risk = regionRiskLevel({
    alarmSum: row.alarmSum,
    criticalSum: row.criticalSum,
    issueCount: row.issueCount,
    offlineSum: row.offlineSum,
  });
  const style = RISK_STYLE[risk];
  const { size, fontSize, labelSize } = scaledMarkerMetrics(
    row.controllerSum,
    totalControllers,
    stage,
    cohortMax
  );
  const h = size + 14;
  const bg = hexWithAlpha(style.fill, style.bgAlpha);
  const shapeClass = isCircle
    ? "farm-map-region-marker--circle"
    : "farm-map-region-marker--rect";

  const html = `
    <div class="farm-map-region-marker ${shapeClass} farm-map-risk--${risk}" role="img" aria-label="${escapeHtml(row.title)} 컨트롤러 ${row.controllerSum}" style="display:flex;flex-direction:column;align-items:center;width:${size}px;${markerVisibilityStyle(visible)}">
      <div class="farm-map-region-marker__bubble" style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;border-radius:${isCircle ? 9999 : 8}px;background:${bg};border:2px solid ${style.border};color:${style.text};box-sizing:border-box;font-size:${fontSize}px;font-weight:800;line-height:1">${row.controllerSum}</div>
      <span style="font-size:${labelSize}px;font-weight:600;color:${MAP_PIN.muted};margin-top:2px;max-width:${size + 12}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.1">${escapeHtml(row.title)}</span>
    </div>`;

  return { html, w: size, h, anchorX: size / 2, anchorY: size / 2 };
}

export function buildRegionTooltipHtml(opts: {
  title: string;
  meta: string;
  controllerSum: number;
  farmCount: number;
  alarmSum: number;
  risk: MapRiskLevel;
  action: string;
}): string {
  const riskLabel =
    opts.risk === "critical"
      ? "긴급"
      : opts.risk === "warning"
        ? "주의"
        : opts.risk === "caution"
          ? "경계"
          : "정상";

  return `
    <div class="farm-map-tooltip">
      <div class="farm-map-tooltip__title">${escapeHtml(opts.title)}</div>
      <div class="farm-map-tooltip__meta">${escapeHtml(opts.meta)}</div>
      <div class="farm-map-tooltip__chips">
        <span class="farm-map-tooltip__chip farm-map-tooltip__chip--muted">컨트롤러 ${opts.controllerSum}</span>
        <span class="farm-map-tooltip__chip farm-map-tooltip__chip--muted">농장 ${opts.farmCount}</span>
        <span class="farm-map-tooltip__chip" style="background:${RISK_STYLE[opts.risk].fill}">${riskLabel}</span>
        <span class="farm-map-tooltip__chip" style="background:${opts.alarmSum > 0 ? MAP_PIN.warn : MAP_PIN.ok}">알람 ${opts.alarmSum}</span>
      </div>
      <div class="farm-map-tooltip__more">${escapeHtml(opts.action)}</div>
    </div>`;
}

export function farmPointFromMarker(
  marker: { options?: { farmPoint?: FarmMapPoint } }
): FarmMapPoint | undefined {
  return marker.options?.farmPoint;
}

/** Z13 — 불투명 원 · 축산업등록번호 · 축종코드 · 컨트롤러 수 · 겹침 시 핀 */
export function buildFarmMarkerIconSpec(opts: {
  point: FarmMapPoint;
  totalControllers: number;
  cohortMax: number;
  pinMode: boolean;
  /** Z4/4 — 카드 좌·우 클릭으로 컨트롤러/알람 라우팅 (툴팁은 hover 미지원) */
  splitNav?: boolean;
  visible?: boolean;
}): { html: string; w: number; h: number; anchorX: number; anchorY: number } {
  const {
    point,
    totalControllers,
    cohortMax,
    pinMode,
    splitNav = false,
    visible = true,
  } = opts;
  const risk = farmRiskLevel(point);
  const style = RISK_STYLE[risk];
  const { size, fontSize, labelSize } = scaledMarkerMetrics(
    point.controllerCount,
    totalControllers,
    3,
    cohortMax
  );
  const pulse =
    point.alarmCount >= PULSE_ALARM_THRESHOLD ? " farm-map-marker--pulse" : "";
  const vis = markerVisibilityStyle(visible);
  const itemLabel = escapeHtml(formatItemCodeLabel(point.itemCode));

  if (pinMode) {
    const pinH = size + 10;
    const html = `
      <div class="farm-map-farm-marker farm-map-farm-marker--pin${pulse}" role="img" aria-label="${escapeHtml(point.lsindRegistNo)} ${itemLabel} 컨트롤러 ${point.controllerCount}" style="position:relative;width:${Math.max(20, size - 8)}px;height:${pinH}px;${vis}">
        <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:0;height:0;border-left:${Math.max(8, size / 3)}px solid transparent;border-right:${Math.max(8, size / 3)}px solid transparent;border-top:${Math.max(10, size / 2)}px solid ${style.fill}"></div>
        <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:${Math.max(18, size - 6)}px;height:${Math.max(18, size - 6)}px;border-radius:9999px;background:${style.fill};border:2px solid ${style.border};color:${style.text};font-size:${Math.max(8, fontSize - 2)}px;font-weight:800;display:flex;align-items:center;justify-content:center">${point.controllerCount}</div>
      </div>`;
    return {
      html,
      w: Math.max(24, size),
      h: pinH,
      anchorX: Math.max(12, size / 2),
      anchorY: pinH,
    };
  }

  const core = Math.max(22, size - 4);
  const keyAttr = escapeHtml(farmKeyId(point.farmKey));
  const alarmBg = point.alarmCount > 0 ? MAP_PIN.warn : MAP_PIN.ok;

  if (splitNav) {
    const cardW = 96;
    const splitH = Math.max(36, core);
    const html = `
    <div class="farm-map-farm-marker farm-map-farm-marker--split farm-map-risk--${risk}${pulse}" data-farm-key="${keyAttr}" style="display:flex;flex-direction:column;align-items:stretch;gap:3px;width:${cardW}px;${vis}">
      <div class="farm-map-farm-marker__split-row" role="group" aria-label="${escapeHtml(point.lsindRegistNo)} ${itemLabel}">
        <button type="button" class="farm-map-farm-marker__zone farm-map-farm-marker__zone--ctrl" data-farm-nav="controllers" aria-label="컨트롤러 ${point.controllerCount}대 페이지로 이동" style="background:${style.fill};border-color:${style.border};color:${style.text};font-size:${fontSize}px">
          <span class="farm-map-farm-marker__zone-count">${point.controllerCount}</span>
          <span class="farm-map-farm-marker__zone-label">컨트롤러</span>
        </button>
        <button type="button" class="farm-map-farm-marker__zone farm-map-farm-marker__zone--alarm" data-farm-nav="alarms" aria-label="알람 ${point.alarmCount}건 페이지로 이동" style="background:${alarmBg};border-color:${point.alarmCount > 0 ? "#b45309" : style.border};color:#fff;font-size:${fontSize}px">
          <span class="farm-map-farm-marker__zone-count">${point.alarmCount}</span>
          <span class="farm-map-farm-marker__zone-label">알람</span>
        </button>
      </div>
      <span class="farm-map-farm-marker__id" style="font-size:${labelSize}px">${escapeHtml(point.lsindRegistNo)}</span>
      <span class="farm-map-item-chip">${itemLabel}</span>
    </div>`;
    const totalH = splitH + 30;
    return { html, w: cardW, h: totalH, anchorX: cardW / 2, anchorY: totalH };
  }

  const html = `
    <div class="farm-map-farm-marker farm-map-risk--${risk}${pulse}" role="img" aria-label="${escapeHtml(point.lsindRegistNo)} ${itemLabel} 컨트롤러 ${point.controllerCount}" style="display:flex;flex-direction:column;align-items:center;gap:2px;${vis}">
      <div style="width:${core}px;height:${core}px;border-radius:9999px;background:${style.fill};border:2px solid ${style.border};color:${style.text};font-size:${fontSize}px;font-weight:800;display:flex;align-items:center;justify-content:center;line-height:1">${point.controllerCount}</div>
      <span style="font-size:${labelSize}px;font-weight:700;color:#14532d;background:rgba(255,255,255,0.94);padding:1px 4px;border-radius:4px;border:1px solid #bbf7d0;white-space:nowrap;max-width:88px;overflow:hidden;text-overflow:ellipsis">${escapeHtml(point.lsindRegistNo)}</span>
      <span class="farm-map-item-chip">${itemLabel}</span>
    </div>`;

  return { html, w: 88, h: core + 28, anchorX: 44, anchorY: core / 2 + 4 };
}

export function buildFarmTooltipHtml(point: FarmMapPoint): string {
  const risk = farmRiskLevel(point);
  const riskLabel =
    risk === "critical"
      ? "긴급"
      : risk === "warning"
        ? "주의"
        : risk === "caution"
          ? "경계"
          : "정상";

  return `
    <div class="farm-map-tooltip">
      <div class="farm-map-tooltip__title">${escapeHtml(point.label)}</div>
      <div class="farm-map-tooltip__meta">${escapeHtml(point.sido)} ${escapeHtml(point.sigungu)}</div>
      <div class="farm-map-tooltip__chips">
        <span class="farm-map-tooltip__chip" style="background:${RISK_STYLE[risk].fill}">${riskLabel}</span>
        <span class="farm-map-tooltip__chip farm-map-tooltip__chip--muted">컨트롤러 ${point.controllerCount}</span>
        <span class="farm-map-tooltip__chip farm-map-tooltip__chip--muted">알람 ${point.alarmCount}</span>
      </div>
      <div class="farm-map-tooltip__more">카드 왼쪽 · 컨트롤러 / 오른쪽 · 알람 클릭</div>
    </div>`;
}

export function buildClusterListHtml(
  points: FarmMapPoint[],
  opts: { max?: number; title?: string } = {}
): string {
  const max = opts.max ?? 5;
  const sorted = [...points].sort((a, b) => b.alarmCount - a.alarmCount);
  const shown = sorted.slice(0, max);
  const rest = sorted.length - shown.length;

  const rows = shown
    .map((p) => {
      const href = escapeHtml(buildFarmAlarmsHref(p.farmKey));
      const risk = farmRiskLevel(p);
      return `
        <a class="farm-map-tooltip__row" href="${href}">
          <span class="farm-map-tooltip__row-label">${escapeHtml(p.lsindRegistNo)} · ${escapeHtml(formatItemCodeLabel(p.itemCode))}</span>
          <span class="farm-map-tooltip__chip" style="background:${RISK_STYLE[risk].fill}">${p.controllerCount}대</span>
        </a>`;
    })
    .join("");

  return `
    <div class="farm-map-tooltip farm-map-tooltip--cluster">
      <div class="farm-map-tooltip__title">${escapeHtml(opts.title ?? "농장 목록")}</div>
      <div class="farm-map-tooltip__meta">컨트롤러 · ${sorted.length}개 농장</div>
      ${rows}
      ${rest > 0 ? `<div class="farm-map-tooltip__more">+${rest} 더보기 (클릭하여 확대)</div>` : ""}
    </div>`;
}

export function summarizeClusterStats(points: FarmMapPoint[]) {
  let alarmSum = 0;
  let alarmFarms = 0;
  let controllerSum = 0;
  for (const p of points) {
    alarmSum += p.alarmCount;
    controllerSum += p.controllerCount;
    if (p.alarmCount > 0) alarmFarms += 1;
  }
  return {
    farmCount: points.length,
    alarmSum,
    alarmFarms,
    controllerSum,
  };
}

export type RegionMarkerDensity = "national" | "regional";
