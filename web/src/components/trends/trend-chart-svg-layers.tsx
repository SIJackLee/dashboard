/**
 * 추이 차트 SVG — 결정적(순수) 배경/오버레이 레이어.
 *
 * 상태·ref·이벤트 핸들러가 없는, 데이터+기하 매퍼만으로 그려지는 레이어를
 * `trend-chart.tsx`에서 1:1 분리한다. (호버 십자선·핀·드래그 라벨 등 상호작용
 * 레이어는 ref/상태 결합이 강해 컴포넌트에 유지)
 *
 * 각 컴포넌트는 Fragment로 동일 key의 SVG 엘리먼트 배열을 반환 — DOM 출력·키가
 * 기존과 완전히 동일하다.
 */
import { Fragment } from "react";
import type { Band } from "@/lib/farm/severity-score";
import { SEV_COLOR } from "@/lib/farm/severity-score";
import type { UplinkCoverageBand } from "@/lib/farm/trend-uplink-coverage";
import type {
  TrendAxis,
  TrendCommandRangeFrame,
  TrendEventMark,
  TrendReferenceLine,
} from "@/lib/data/trend-chart-types";
import {
  COMMAND_RANGE_CHANNELS,
  COMMAND_RANGE_FILL_OPACITY,
  COMMAND_RANGE_LABEL_ANCHOR,
  COMMAND_RANGE_LINE_OPACITY,
  commandRangeLabelX,
} from "@/lib/farm/command-range-overlay";
import { PAD_TOP } from "./trend-chart-geometry";

/** 렌더 시점 기하 매퍼·치수 — 컴포넌트에서 주입 */
export type TrendPlotGeom = {
  xFor: (i: number) => number;
  yFor: (value: number, axis: TrendAxis) => number;
  padL: number;
  padR: number;
  viewW: number;
  innerW: number;
  innerH: number;
  n: number;
};

/** 업링크 커버리지 밴드(sparse/offline/void) 배경 rect */
export function CoverageBandsLayer({
  bands,
  geom,
}: {
  bands: UplinkCoverageBand[];
  geom: TrendPlotGeom;
}) {
  const { xFor, padL, padR, viewW, innerW, innerH, n } = geom;
  return (
    <Fragment>
      {bands.map((g) => {
        const x0 = xFor(g.i0);
        const x1 = xFor(g.i1);
        const slot = n > 1 ? innerW / (n - 1) : innerW;
        const left = Math.max(padL, x0 - slot / 2);
        const right = Math.min(viewW - padR, x1 + slot / 2);
        const fill =
          g.kind === "sparse"
            ? "var(--status-warn)"
            : g.kind === "offline"
              ? "var(--status-danger)"
              : "currentColor";
        const fillOpacity =
          g.kind === "sparse" ? 0.16 : g.kind === "offline" ? 0.2 : 0.1;
        return (
          <rect
            key={`cov-${g.kind}-${g.i0}-${g.i1}`}
            x={left}
            y={PAD_TOP}
            width={Math.max(0.4, right - left)}
            height={innerH}
            fill={fill}
            fillOpacity={fillOpacity}
            stroke="none"
            className={g.kind === "void" ? "text-muted-foreground" : undefined}
          />
        );
      })}
    </Fragment>
  );
}

/** null 구간(끊긴 데이터) 회색 rect */
export function NullGapsLayer({
  gaps,
  geom,
}: {
  gaps: { i0: number; i1: number }[];
  geom: TrendPlotGeom;
}) {
  const { xFor, padL, padR, viewW, innerW, innerH, n } = geom;
  return (
    <Fragment>
      {gaps.map((g) => {
        const x0 = xFor(g.i0);
        const x1 = xFor(g.i1);
        const slot = n > 1 ? innerW / (n - 1) : innerW;
        const left = Math.max(padL, x0 - slot / 2);
        const right = Math.min(viewW - padR, x1 + slot / 2);
        return (
          <rect
            key={`null-gap-${g.i0}-${g.i1}`}
            x={left}
            y={PAD_TOP}
            width={Math.max(0.4, right - left)}
            height={innerH}
            fill="#64748b"
            fillOpacity={0.18}
            stroke="none"
          />
        );
      })}
    </Fragment>
  );
}

/** 밴드 분할 가이드(수평 점선) */
export function BandGuidesLayer({
  guides,
  geom,
}: {
  guides: number[];
  geom: TrendPlotGeom;
}) {
  const { yFor, padL, padR, viewW } = geom;
  return (
    <Fragment>
      {guides.map((gy, gi) => {
        if (!Number.isFinite(gy)) return null;
        const y = yFor(gy, "left");
        if (!Number.isFinite(y)) return null;
        return (
          <line
            key={`band-guide-${gi}-${gy}`}
            x1={padL}
            x2={viewW - padR}
            y1={y}
            y2={y}
            stroke="currentColor"
            strokeWidth={0.4}
            strokeDasharray="2.5 3"
            vectorEffect="non-scaling-stroke"
            className="text-muted-foreground"
            opacity={0.35}
          />
        );
      })}
    </Fragment>
  );
}

/** 알람 밴드 상·하한(경고색 점선) */
export function AlarmBandsLayer({
  bands,
  geom,
}: {
  bands: { band: Band; axis: TrendAxis }[];
  geom: TrendPlotGeom;
}) {
  const { yFor, padL, padR, viewW } = geom;
  return (
    <Fragment>
      {bands.map(({ band, axis }, idx) => {
        const yTop = yFor(band.hi, axis);
        const yBot = yFor(band.lo, axis);
        return (
          <g key={`alarm-${idx}`}>
            <line
              x1={padL}
              x2={viewW - padR}
              y1={yTop}
              y2={yTop}
              stroke={SEV_COLOR.warning}
              strokeWidth={0.5}
              strokeDasharray="2 1.5"
              strokeOpacity={0.65}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={padL}
              x2={viewW - padR}
              y1={yBot}
              y2={yBot}
              stroke={SEV_COLOR.warning}
              strokeWidth={0.5}
              strokeDasharray="2 1.5"
              strokeOpacity={0.65}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
    </Fragment>
  );
}

/** 참조선(referenceLines — 알람 모서리 중복 제거 후) */
export function ReferenceLinesLayer({
  lines,
  geom,
}: {
  lines: TrendReferenceLine[];
  geom: TrendPlotGeom;
}) {
  const { yFor, padL, padR, viewW } = geom;
  return (
    <Fragment>
      {lines.map((ref, idx) => {
        const y = yFor(ref.value, ref.axis ?? "left");
        if (!Number.isFinite(y)) return null;
        return (
          <line
            key={`ref-${idx}`}
            x1={padL}
            x2={viewW - padR}
            y1={y}
            y2={y}
            stroke={ref.color}
            strokeWidth={0.5}
            strokeDasharray="2 1.5"
            vectorEffect="non-scaling-stroke"
            opacity={0.7}
          />
        );
      })}
    </Fragment>
  );
}

function previewBandY(
  lo: number | null | undefined,
  hi: number | null | undefined,
  yFor: TrendPlotGeom["yFor"],
): { y: number; h: number } | null {
  if (lo == null || hi == null || !Number.isFinite(lo) || !Number.isFinite(hi)) {
    return null;
  }
  const y1 = yFor(lo, "left");
  const y2 = yFor(hi, "left");
  if (!Number.isFinite(y1) || !Number.isFinite(y2)) return null;
  const mid = (y1 + y2) / 2;
  const h = Math.max(5, Math.abs(y2 - y1));
  return { y: mid - h / 2, h };
}

function inPlotY(y: number, plotTop: number, plotBottom: number): boolean {
  return Number.isFinite(y) && y >= plotTop - 0.4 && y <= plotBottom + 0.4;
}

function CommandBoundLabel({
  x,
  y,
  text,
  anchor,
  color,
  fontSize,
  opacity,
  plotTop,
  plotBottom,
}: {
  x: number;
  y: number;
  text: string | null;
  anchor: "start" | "middle" | "end";
  color: string;
  fontSize: number;
  opacity: number;
  plotTop: number;
  plotBottom: number;
}) {
  if (
    !text ||
    !Number.isFinite(y) ||
    y < plotTop - 0.4 ||
    y > plotBottom + 0.4
  ) {
    return null;
  }
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      dominantBaseline="middle"
      fill={color}
      stroke="var(--background)"
      strokeWidth={0.7}
      paintOrder="stroke"
      fontSize={fontSize}
      fontWeight={600}
      opacity={opacity}
    >
      {text}
    </text>
  );
}

/** 명령 호버 — 같은 잉크 농도(무지개 CSS 그라데이션 아님). */
export function CommandHoverPreview({
  mark,
  xView,
  geom,
  gradientId,
}: {
  mark: TrendEventMark | null;
  xView: number | null;
  geom: TrendPlotGeom;
  gradientId: string;
}) {
  const preview = mark?.preview;
  if (!preview || xView == null || !Number.isFinite(xView)) return null;
  const { padL, padR, viewW, innerW, innerH, yFor } = geom;
  const plotTop = PAD_TOP;
  const plotBottom = PAD_TOP + innerH;
  const plotLeft = padL;
  const plotRight = viewW - padR;
  const halfW = Math.min(innerW * 0.09, Math.max(innerW * 0.055, 10));
  const x = Math.min(plotRight - 0.5, Math.max(plotLeft + 0.5, xView));
  const left = Math.max(plotLeft, x - halfW);
  const right = Math.min(plotRight, x + halfW);
  const w = right - left;
  if (!(w > 1)) return null;

  const temp = previewBandY(preview.tempLo, preview.tempHi, yFor);
  const motor = previewBandY(preview.motorLo, preview.motorHi, yFor);
  const clip = (band: { y: number; h: number }) => {
    const y = Math.max(plotTop, band.y);
    const y2 = Math.min(plotBottom, band.y + band.h);
    const h = y2 - y;
    if (!(h > 0.4)) return null;
    return { y, h };
  };
  const tempBand = temp ? clip(temp) : null;
  const motorBand = motor ? clip(motor) : null;
  if (!tempBand && !motorBand) return null;

  const tempGrad = `${gradientId}-temp`;
  const motorGrad = `${gradientId}-motor`;
  return (
    <g aria-hidden pointerEvents="none" data-command-hover-preview="">
      <defs>
        {tempBand ? (
          <linearGradient id={tempGrad} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--channel-temp)" stopOpacity="0" />
            <stop
              offset="0.5"
              stopColor="var(--channel-temp)"
              stopOpacity="0.42"
            />
            <stop offset="1" stopColor="var(--channel-temp)" stopOpacity="0" />
          </linearGradient>
        ) : null}
        {motorBand ? (
          <linearGradient id={motorGrad} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--channel-motor)" stopOpacity="0" />
            <stop
              offset="0.5"
              stopColor="var(--channel-motor)"
              stopOpacity="0.42"
            />
            <stop offset="1" stopColor="var(--channel-motor)" stopOpacity="0" />
          </linearGradient>
        ) : null}
      </defs>
      {tempBand ? (
        <rect
          x={left}
          y={tempBand.y}
          width={w}
          height={tempBand.h}
          fill={`url(#${tempGrad})`}
        />
      ) : null}
      {motorBand ? (
        <rect
          x={left}
          y={motorBand.y}
          width={w}
          height={motorBand.h}
          fill={`url(#${motorGrad})`}
        />
      ) : null}
    </g>
  );
}

/** 온도·모터 명령 마커 호버 — 채널별 구간을 X 전폭, A 진함 / C 옅음. */
export function CommandChannelRangeOverlay({
  frame,
  geom,
  gradientId,
}: {
  frame: TrendCommandRangeFrame | null;
  geom: TrendPlotGeom;
  gradientId: string;
}) {
  if (!frame?.channels.length) return null;
  const { padL, padR, viewW, innerW, innerH, yFor } = geom;
  const plotTop = PAD_TOP;
  const plotBottom = PAD_TOP + innerH;
  const x1 = padL;
  const x2 = viewW - padR;
  const w = x2 - x1;
  if (!(w > 1)) return null;

  const clip = (band: { y: number; h: number }) => {
    const y = Math.max(plotTop, band.y);
    const y2 = Math.min(plotBottom, band.y + band.h);
    const h = y2 - y;
    if (!(h > 0.4)) return null;
    return { y, h };
  };

  const byChannel = new Map(frame.channels.map((ch) => [ch.channel, ch]));
  const ordered = COMMAND_RANGE_CHANNELS.map((slot) => byChannel.get(slot)).filter(
    (ch): ch is NonNullable<typeof ch> => ch != null,
  );
  const solo = ordered.length === 1;
  const fillOf = (channel: (typeof ordered)[number]["channel"]) =>
    Math.min(
      0.48,
      COMMAND_RANGE_FILL_OPACITY[channel] * (solo ? 1.35 : 1),
    );
  const lineOf = (channel: (typeof ordered)[number]["channel"]) =>
    Math.min(
      1,
      COMMAND_RANGE_LINE_OPACITY[channel] * (solo ? 1.12 : 1),
    );

  return (
    <g aria-hidden pointerEvents="none" data-command-channel-range="">
      <defs>
        {ordered.flatMap((ch) => {
          const fill = fillOf(ch.channel);
          const tempId = `${gradientId}-${ch.channel}-temp`;
          const motorId = `${gradientId}-${ch.channel}-motor`;
          return [
            <linearGradient
              key={tempId}
              id={tempId}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0" stopColor="var(--channel-temp)" stopOpacity={fill * 0.35} />
              <stop offset="0.5" stopColor="var(--channel-temp)" stopOpacity={fill} />
              <stop offset="1" stopColor="var(--channel-temp)" stopOpacity={fill * 0.35} />
            </linearGradient>,
            <linearGradient
              key={motorId}
              id={motorId}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0" stopColor="var(--channel-motor)" stopOpacity={fill * 0.35} />
              <stop offset="0.5" stopColor="var(--channel-motor)" stopOpacity={fill} />
              <stop offset="1" stopColor="var(--channel-motor)" stopOpacity={fill * 0.35} />
            </linearGradient>,
          ];
        })}
      </defs>
      {ordered.map((ch) => {
        const lineOp = lineOf(ch.channel);
        const lx = commandRangeLabelX(ch.channel, padL, innerW);
        const anchor = COMMAND_RANGE_LABEL_ANCHOR[ch.channel];
        const tempRaw = previewBandY(ch.tempLo, ch.tempHi, yFor);
        const motorRaw = previewBandY(ch.motorLo, ch.motorHi, yFor);
        const tempBand = tempRaw ? clip(tempRaw) : null;
        const motorBand = motorRaw ? clip(motorRaw) : null;
        const fontSize = Math.max(4.2, innerH * 0.042);
        const textOp = Math.min(1, lineOp + 0.12);
        const yTempLo =
          ch.tempLo != null ? yFor(ch.tempLo, "left") : Number.NaN;
        const yTempHi =
          ch.tempHi != null ? yFor(ch.tempHi, "left") : Number.NaN;
        const yMotorLo =
          ch.motorLo != null ? yFor(ch.motorLo, "left") : Number.NaN;
        const yMotorHi =
          ch.motorHi != null ? yFor(ch.motorHi, "left") : Number.NaN;
        const yTempTop =
          ch.tempHiText && inPlotY(yTempHi, plotTop, plotBottom)
            ? yTempHi
            : tempBand
              ? tempBand.y
              : Number.NaN;
        const yTempBot =
          ch.tempLoText && inPlotY(yTempLo, plotTop, plotBottom)
            ? yTempLo
            : tempBand
              ? tempBand.y + tempBand.h
              : Number.NaN;
        const yMotorTop =
          ch.motorHiText && inPlotY(yMotorHi, plotTop, plotBottom)
            ? yMotorHi
            : motorBand
              ? motorBand.y
              : Number.NaN;
        const yMotorBot =
          ch.motorLoText && inPlotY(yMotorLo, plotTop, plotBottom)
            ? yMotorLo
            : motorBand
              ? motorBand.y + motorBand.h
              : Number.NaN;
        return (
          <g key={ch.channel}>
            {tempBand ? (
              <rect
                x={x1}
                y={tempBand.y}
                width={w}
                height={tempBand.h}
                fill={`url(#${gradientId}-${ch.channel}-temp)`}
              />
            ) : null}
            {Number.isFinite(yTempTop) ? (
              <line
                x1={x1}
                x2={x2}
                y1={yTempTop}
                y2={yTempTop}
                stroke="var(--channel-temp)"
                strokeWidth={0.55}
                opacity={lineOp}
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            {Number.isFinite(yTempBot) ? (
              <line
                x1={x1}
                x2={x2}
                y1={yTempBot}
                y2={yTempBot}
                stroke="var(--channel-temp)"
                strokeWidth={0.55}
                opacity={lineOp}
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            <CommandBoundLabel
              x={lx}
              y={yTempLo}
              text={ch.tempLoText}
              anchor={anchor}
              color="var(--channel-temp)"
              fontSize={fontSize}
              opacity={textOp}
              plotTop={plotTop}
              plotBottom={plotBottom}
            />
            <CommandBoundLabel
              x={lx}
              y={yTempHi}
              text={ch.tempHiText}
              anchor={anchor}
              color="var(--channel-temp)"
              fontSize={fontSize}
              opacity={textOp}
              plotTop={plotTop}
              plotBottom={plotBottom}
            />
            {motorBand ? (
              <rect
                x={x1}
                y={motorBand.y}
                width={w}
                height={motorBand.h}
                fill={`url(#${gradientId}-${ch.channel}-motor)`}
              />
            ) : null}
            {Number.isFinite(yMotorTop) ? (
              <line
                x1={x1}
                x2={x2}
                y1={yMotorTop}
                y2={yMotorTop}
                stroke="var(--channel-motor)"
                strokeWidth={0.55}
                opacity={lineOp}
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            {Number.isFinite(yMotorBot) ? (
              <line
                x1={x1}
                x2={x2}
                y1={yMotorBot}
                y2={yMotorBot}
                stroke="var(--channel-motor)"
                strokeWidth={0.55}
                opacity={lineOp}
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            <CommandBoundLabel
              x={lx}
              y={yMotorLo}
              text={ch.motorLoText}
              anchor={anchor}
              color="var(--channel-motor)"
              fontSize={fontSize}
              opacity={textOp}
              plotTop={plotTop}
              plotBottom={plotBottom}
            />
            <CommandBoundLabel
              x={lx}
              y={yMotorHi}
              text={ch.motorHiText}
              anchor={anchor}
              color="var(--channel-motor)"
              fontSize={fontSize}
              opacity={textOp}
              plotTop={plotTop}
              plotBottom={plotBottom}
            />
          </g>
        );
      })}
    </g>
  );
}
