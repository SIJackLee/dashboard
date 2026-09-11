"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { farmChartUi } from "@/lib/ui/farm-chart-ui-scale";
import {
  dashboardAffordance,
  dashboardChroma,
} from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { isPrimaryPress } from "@/lib/ui/pointer-press";
import { cn } from "@/lib/utils";
import { clusterEventMarks } from "@/lib/farm/command-cluster";
import type { TrendEventLane, TrendEventMark } from "@/lib/data/trend-chart-types";
import { X_SCOPE_DRAG_PX } from "./trend-chart-geometry";

export type PositionedEventMark = {
  mark: TrendEventMark;
  xView: number;
  yView: number;
};

const EDGE_PAD = 8;

/** effect 내 setState 없이 미디어쿼리 구독(react-hooks/set-state-in-effect 회피). */
function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener?.("change", onChange);
      return () => mq.removeEventListener?.("change", onChange);
    },
    () =>
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia(query).matches
        : false,
    () => false,
  );
}

/**
 * 단계 글리프: command 레인의 row(=COMMAND_HIT_STAGES 인덱스)로 모양을 구분한다.
 * 0 확인·1 수신 = 원, 2 전송 = 사각, 3 접수 = 마름모. 색약 대응(색+모양 이중 코딩).
 */
function stageShapeClass(row: number): string {
  if (row === 2) return "rounded-[1px]";
  if (row === 3) return "rounded-[1px] rotate-45";
  return "rounded-full";
}

function markDotClass(mark: TrendEventMark, selected: boolean): string {
  const fill =
    mark.tone === "ok"
      ? "bg-[var(--status-ok)] border-[color-mix(in_oklch,var(--status-ok)_40%,var(--background))]"
      : mark.infoStrength === 3
        ? "bg-[color-mix(in_oklch,var(--channel-command)_80%,transparent)] border-background"
        : mark.infoStrength === 2
          ? "bg-[color-mix(in_oklch,var(--channel-command)_55%,transparent)] border-background"
          : "bg-[color-mix(in_oklch,var(--channel-command)_35%,transparent)] border-background";
  return cn(
    "block border size-1.5",
    stageShapeClass(mark.row),
    fill,
    selected &&
      (mark.tone === "ok"
        ? "ring-1 ring-[color:var(--status-ok-ink)]"
        : "ring-1 ring-foreground"),
  );
}

export function EventLaneSvgGuides({
  padL,
  padR,
  viewW,
  laneTop,
  laneH,
  rowCount,
}: {
  padL: number;
  padR: number;
  viewW: number;
  laneTop: number;
  laneH: number;
  rowCount: number;
}) {
  const rows = Math.max(1, rowCount);
  const x2 = viewW - padR;
  return (
    <g aria-hidden>
      <line
        x1={padL}
        x2={x2}
        y1={laneTop}
        y2={laneTop}
        stroke="currentColor"
        className="text-border"
        strokeWidth={0.7}
        vectorEffect="non-scaling-stroke"
      />
      {Array.from({ length: rows }, (_, index) => (
        <line
          key={index}
          x1={padL}
          x2={x2}
          y1={laneTop + ((index + 0.5) / rows) * laneH}
          y2={laneTop + ((index + 0.5) / rows) * laneH}
          stroke="currentColor"
          className="text-border"
          strokeWidth={0.5}
          strokeOpacity={0.55}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}

type LaneScopeHandlers = {
  begin: (clientX: number, clientY: number) => void;
  move: (clientX: number, clientY: number) => void;
  /** @returns true if time scope committed (tap should not pin) */
  end: (clientX: number, clientY: number) => boolean;
  cancel: () => void;
};

export function EventLaneHtmlOverlay({
  lane,
  marks,
  viewW,
  chartH,
  laneTop,
  laneH,
  compact,
  labelGutter,
  selectedId,
  onSelect,
  onHover,
  onClearEventPins,
  onEmptyContextMenu,
  scopeHandlers = null,
}: {
  lane: TrendEventLane;
  marks: PositionedEventMark[];
  viewW: number;
  chartH: number;
  laneTop: number;
  laneH: number;
  compact?: boolean;
  labelGutter?: boolean;
  selectedId: string | null;
  onSelect: (mark: TrendEventMark) => void;
  onHover: (mark: TrendEventMark | null) => void;
  /** 클러스터 줌인 이탈 시 해당 멤버들의 핀 카드 제거 */
  onClearEventPins?: (markIds: string[]) => void;
  /** 빈 공간 우클릭: 카드가 있으면 일괄 닫고 true 반환(줌인 뒤로가기보다 우선) */
  onEmptyContextMenu?: () => boolean;
  /** 설정 시 점 위 가로 드래그도 시간 스코프 (탭=핀) */
  scopeHandlers?: LaneScopeHandlers | null;
}) {
  const rowCount = Math.max(1, lane.rowLabels.length);
  const selectedRow =
    marks.find((row) => row.mark.id === selectedId)?.mark.row ?? null;
  const pctY = (yView: number) =>
    `${chartH > 0 ? (yView / chartH) * 100 : 0}%`;

  // 오버레이 픽셀 폭 측정(클러스터 간격·펼침 계산은 px 기준).
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [widthPx, setWidthPx] = useState(0);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setWidthPx(entry.contentRect.width);
    });
    ro.observe(el);
    setWidthPx(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const coarse = useMediaQuery("(pointer: coarse)");
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");

  const [openClusterId, setOpenClusterId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [fanIn, setFanIn] = useState(false);
  const pointRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const hitPx = compact ? 36 : 28;
  const minGapPx = hitPx;

  const posById = useMemo(() => {
    const map = new Map<string, PositionedEventMark>();
    for (const p of marks) map.set(p.mark.id, p);
    return map;
  }, [marks]);

  const layout = useMemo(() => {
    if (widthPx <= 0) {
      // 측정 전에는 전부 single → 오늘과 동일한 no-op 렌더.
      return {
        singleIds: new Set(marks.map((p) => p.mark.id)),
        clusters: [] as ReturnType<typeof clusterEventMarks>["clusters"],
        clusterOf: new Map<string, string>(),
      };
    }
    return clusterEventMarks(
      marks.map((p) => ({
        id: p.mark.id,
        row: p.mark.row,
        xPx: viewW > 0 ? (p.xView / viewW) * widthPx : 0,
      })),
      minGapPx,
    );
  }, [marks, widthPx, viewW, minGapPx]);

  // 열린 클러스터가 마크 변화로 사라지면 파생값이 null → 렌더에서 자동 무시(정리 effect 불필요).
  const openCluster =
    layout.clusters.find((c) => c.id === openClusterId) ?? null;

  // 펼침 진입 애니메이션(setState는 rAF 콜백에서만 → effect 동기 setState 회피).
  useEffect(() => {
    if (!openClusterId) return;
    const r = requestAnimationFrame(() => setFanIn(true));
    return () => cancelAnimationFrame(r);
  }, [openClusterId]);

  // 로빙: 포커스된 멤버로 실제 DOM 포커스 이동(스크린리더 낭독).
  useEffect(() => {
    if (openClusterId && focusedId) pointRefs.current[focusedId]?.focus();
  }, [focusedId, openClusterId]);

  // 열림 중 키보드: Esc 접기 / 화살표 로빙.
  useEffect(() => {
    if (!openCluster) return;
    const ids = openCluster.memberIds;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClearEventPins?.(ids);
        setFanIn(false);
        setOpenClusterId(null);
        setFocusedId(null);
        return;
      }
      if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      ) {
        event.preventDefault();
        const dir =
          event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
        const cur = focusedId ? ids.indexOf(focusedId) : -1;
        const next =
          cur < 0
            ? dir > 0
              ? 0
              : ids.length - 1
            : Math.min(ids.length - 1, Math.max(0, cur + dir));
        setFocusedId(ids[next] ?? null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openCluster, focusedId, onClearEventPins]);

  const collapse = () => {
    const cl = layout.clusters.find((c) => c.id === openClusterId);
    if (cl) onClearEventPins?.(cl.memberIds);
    setFanIn(false);
    setOpenClusterId(null);
    setFocusedId(null);
  };

  const toggleCluster = (id: string) => {
    if (openClusterId === id) {
      collapse();
    } else {
      setFanIn(false);
      setOpenClusterId(id);
      setFocusedId(null);
    }
  };

  // ---- 싱글 마크: 점 위 탭=핀 / 가로 드래그=시간 스코프 (오늘과 동일) ----
  const armRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    mark: TrendEventMark;
  } | null>(null);
  const draggedRef = useRef(false);

  const clearArm = () => {
    armRef.current = null;
    draggedRef.current = false;
  };

  const onMarkPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    mark: TrendEventMark,
  ) => {
    event.stopPropagation();
    if (!isPrimaryPress(event)) return;
    armRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      mark,
    };
    draggedRef.current = false;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    scopeHandlers?.begin(event.clientX, event.clientY);
  };

  const onMarkPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const arm = armRef.current;
    if (!arm || arm.pointerId !== event.pointerId) return;
    const dist = Math.hypot(event.clientX - arm.x, event.clientY - arm.y);
    if (dist >= X_SCOPE_DRAG_PX) draggedRef.current = true;
    scopeHandlers?.move(event.clientX, event.clientY);
  };

  const onMarkPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const arm = armRef.current;
    if (!arm || arm.pointerId !== event.pointerId) {
      clearArm();
      return;
    }
    const committed = scopeHandlers?.end(event.clientX, event.clientY) ?? false;
    const wasDrag = draggedRef.current || committed;
    const mark = arm.mark;
    clearArm();
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    if (wasDrag) return;
    onSelect(mark);
  };

  const onMarkPointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (armRef.current?.pointerId === event.pointerId) {
      scopeHandlers?.cancel();
      clearArm();
    }
  };

  const renderSingle = ({ mark, xView, yView }: PositionedEventMark) => {
    const isSelected = selectedId === mark.id;
    return (
      <button
        key={mark.id}
        type="button"
        className={cn(
          "pointer-events-auto absolute flex items-center justify-center -translate-x-1/2 -translate-y-1/2",
          compact ? "size-9" : "size-7",
          dashboardAffordance.hitSurface,
          motionClass.microHover,
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground",
          isSelected && "z-[1]",
        )}
        style={{
          left: `${viewW > 0 ? (xView / viewW) * 100 : 0}%`,
          top: pctY(yView),
        }}
        aria-label={mark.ariaLabel}
        aria-pressed={isSelected}
        onPointerDown={(event) => onMarkPointerDown(event, mark)}
        onPointerMove={onMarkPointerMove}
        onPointerUp={onMarkPointerUp}
        onPointerCancel={onMarkPointerCancel}
        onClick={(event) => {
          event.stopPropagation();
          // 포인터 탭은 pointerUp에서 핀. 키보드(Enter/Space)만 click 경로.
          if (event.detail !== 0) return;
          onSelect(mark);
        }}
        onMouseEnter={() => onHover(mark)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(mark)}
        onBlur={() => onHover(null)}
      >
        <span className={markDotClass(mark, isSelected)} />
      </button>
    );
  };

  // ---- 펼침 기하 (px, 레인 밴드 내부) ----
  const openCount = openCluster ? openCluster.memberIds.length : 0;
  const fanGap = coarse ? hitPx + 16 : hitPx + 12;
  const neededHalf = openCount > 0 ? ((openCount - 1) / 2) * fanGap : 0;
  // 목록 폴백은 "폭이 부족하거나 터치"일 때만 — 넓은 차트에선 건수가 많아도 부채꼴로 펼친다.
  const useList =
    openCluster != null &&
    (coarse || neededHalf * 2 > widthPx - 2 * EDGE_PAD);
  let fanCenter = openCluster ? openCluster.centerXPx : 0;
  if (openCluster && !useList) {
    const min = EDGE_PAD + neededHalf;
    const max = widthPx - EDGE_PAD - neededHalf;
    if (max >= min) fanCenter = Math.min(max, Math.max(min, fanCenter));
  }

  const stageName = openCluster ? lane.rowLabels[openCluster.row] ?? "" : "";
  const liveMsg = openCluster ? `${stageName} 명령 ${openCount}건 펼침` : "";
  const laneTopPct = pctY(laneTop);
  const laneHeightPct = `${chartH > 0 ? (laneH / chartH) * 100 : 0}%`;

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 z-[3]"
      data-tour-id="chart-command-hit"
    >
      {lane.rowLabels.map((name, index) => (
        <div
          key={name}
          className={cn(
            "pointer-events-none absolute -translate-y-1/2 rounded-sm bg-background/85 text-right leading-none",
            farmChartUi.fsAxis,
            labelGutter ? "right-1" : "right-0.5",
            selectedRow === index
              ? dashboardChroma.chromeActiveText
              : dashboardChroma.chromeIdleText,
          )}
          style={{ top: pctY(laneTop + ((index + 0.5) / rowCount) * laneH) }}
          aria-hidden
        >
          {name}
        </div>
      ))}

      {marks.length === 0 ? (
        <p
          className={cn(
            "pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-center",
            farmChartUi.fsMeta,
            dashboardChroma.chromeIdleText,
          )}
          style={{ top: pctY(laneTop + laneH / 2) }}
        >
          {lane.emptyLabel}
        </p>
      ) : null}

      <div aria-live="polite" className="sr-only">
        {liveMsg}
      </div>

      {/* 단독 마크 (펼침 중에는 보이되 상호작용 차단) */}
      <div className={openCluster ? "pointer-events-none" : undefined}>
        {marks
          .filter((p) => layout.singleIds.has(p.mark.id))
          .map(renderSingle)}
      </div>

      {/* 접힌 클러스터 배지 (펼침 중에는 다른 클러스터도 보이되 차단) */}
      <div className={openCluster ? "pointer-events-none" : undefined}>
        {layout.clusters
          .filter((cl) => cl.id !== openClusterId)
          .map((cl) => {
          const sample = posById.get(cl.memberIds[0] ?? "");
          if (!sample) return null;
          const leftPct = widthPx > 0 ? (cl.centerXPx / widthPx) * 100 : 0;
          const containsSelected =
            selectedId != null && cl.memberIds.includes(selectedId);
          return (
            <button
              key={cl.id}
              type="button"
              className={cn(
                "pointer-events-auto absolute flex items-center gap-1 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-background/95 px-1.5 py-0.5 leading-none text-foreground",
                farmChartUi.fsMeta,
                dashboardAffordance.hitSurface,
                motionClass.microHover,
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground",
                containsSelected && "ring-1 ring-foreground",
              )}
              style={{ left: `${leftPct}%`, top: pctY(sample.yView) }}
              aria-label={`${lane.rowLabels[cl.row] ?? ""} 명령 ${cl.memberIds.length}건, 펼치기`}
              aria-expanded={false}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                toggleCluster(cl.id);
              }}
            >
              <span className={markDotClass(sample.mark, false)} />
              <span className="tabular-nums">+{cl.memberIds.length}</span>
            </button>
          );
          })}
      </div>

      {/* 열린 클러스터: 배경(닫기) + 펼침(부채꼴/목록) + 확장 배지 */}
      {openCluster ? (
        <>
          <button
            type="button"
            aria-label="펼침 닫기"
            className="pointer-events-auto absolute left-0 right-0"
            style={{
              top: laneTopPct,
              height: laneHeightPct,
              background: fanIn
                ? "color-mix(in oklch, var(--foreground) 8%, transparent)"
                : "transparent",
              transition: reduced ? undefined : "background 180ms ease",
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onMouseMove={(event) => event.stopPropagation()}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              // 카드가 있으면 일괄 닫기 우선, 없을 때만 줌인 뒤로가기(접기).
              if (onEmptyContextMenu?.()) return;
              collapse();
            }}
            onClick={(event) => {
              event.stopPropagation();
              collapse();
            }}
          />

          {useList ? (() => {
            const sample = posById.get(openCluster.memberIds[0] ?? "");
            const yView =
              sample?.yView ??
              laneTop + ((openCluster.row + 0.5) / rowCount) * laneH;
            const leftPct =
              widthPx > 0 ? (openCluster.centerXPx / widthPx) * 100 : 0;
            return (
              <button
                type="button"
                className={cn(
                  "pointer-events-auto absolute z-[2] flex items-center gap-1 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground/40 bg-background px-1.5 py-0.5 leading-none text-foreground",
                  farmChartUi.fsMeta,
                  dashboardAffordance.hitSurface,
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground",
                )}
                style={{ left: `${leftPct}%`, top: pctY(yView) }}
                aria-label={`${stageName} 명령 ${openCount}건, 접기`}
                aria-expanded
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  collapse();
                }}
              >
                {sample ? (
                  <span className={markDotClass(sample.mark, false)} />
                ) : null}
                <span className="tabular-nums">+{openCount}</span>
              </button>
            );
          })() : null}

          {useList
            ? (() => {
                const listW = 248;
                const leftPx = Math.max(
                  listW / 2 + EDGE_PAD,
                  Math.min(openCluster.centerXPx, widthPx - listW / 2 - EDGE_PAD),
                );
                const sample = posById.get(openCluster.memberIds[0] ?? "");
                const yView =
                  sample?.yView ??
                  laneTop + ((openCluster.row + 0.5) / rowCount) * laneH;
                const belowPx = (yView / chartH) * 100;
                const flipUp = yView + laneH > chartH - 8;
                return (
                  <div
                    className={cn(
                      "pointer-events-auto absolute z-[3] max-h-40 overflow-y-auto rounded-md border border-border bg-background shadow-sm -translate-x-1/2",
                      flipUp ? "-translate-y-full" : "",
                    )}
                    style={{
                      left: `${widthPx > 0 ? (leftPx / widthPx) * 100 : 0}%`,
                      top: `${belowPx}%`,
                      width: listW,
                      opacity: fanIn ? 1 : 0,
                      transition: reduced ? undefined : "opacity 180ms ease",
                    }}
                    role="listbox"
                    aria-label={`${stageName} 명령 ${openCount}건`}
                  >
                    <div
                      className={cn(
                        "sticky top-0 z-[1] flex items-center gap-1.5 border-b border-border bg-background px-2.5 py-1 leading-none",
                        farmChartUi.fsMeta,
                        dashboardChroma.chromeActiveText,
                      )}
                    >
                      {sample ? (
                        <span className={markDotClass(sample.mark, false)} />
                      ) : null}
                      <span className="font-medium">{stageName}</span>
                      <span className={dashboardChroma.chromeIdleText}>
                        · {openCount}건
                      </span>
                    </div>
                    {openCluster.memberIds.map((id) => {
                      const p = posById.get(id);
                      if (!p) return null;
                      const isSel = selectedId === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          ref={(el) => {
                            pointRefs.current[id] = el;
                          }}
                          role="option"
                          aria-selected={isSel}
                          className={cn(
                            "flex w-full items-start gap-2 border-b border-border/60 px-2.5 text-left last:border-b-0",
                            coarse ? "min-h-11 py-2.5" : "py-2",
                            isSel ? "bg-foreground/10" : "hover:bg-foreground/5",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground",
                          )}
                          onPointerDown={(event) => event.stopPropagation()}
                          onPointerUp={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelect(p.mark);
                          }}
                          onFocus={() => onHover(p.mark)}
                          onBlur={() => onHover(null)}
                        >
                          <span
                            className={cn(markDotClass(p.mark, isSel), "mt-1 shrink-0")}
                          />
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="flex items-center justify-between gap-2">
                              <span
                                className={cn(
                                  farmChartUi.fsMeta,
                                  dashboardChroma.chromeIdleText,
                                  "tabular-nums",
                                )}
                              >
                                {p.mark.card.time}
                              </span>
                              <span
                                className={cn(
                                  farmChartUi.fsMeta,
                                  "shrink-0 font-medium tabular-nums text-foreground",
                                )}
                              >
                                {p.mark.card.hero}
                              </span>
                            </span>
                            {(() => {
                              const detail = p.mark.card.rows
                                .filter((r) => r.label !== "단계")
                                .map((r) => `${r.label} ${r.value}`)
                                .join(" · ");
                              const sub = [detail, p.mark.card.footnote]
                                .filter(Boolean)
                                .join(" · ");
                              return sub ? (
                                <span
                                  className={cn(
                                    farmChartUi.fsMeta,
                                    dashboardChroma.chromeIdleText,
                                    "truncate",
                                  )}
                                >
                                  {sub}
                                </span>
                              ) : null;
                            })()}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()
            : (
              <>
                {(() => {
                  const half = neededHalf + hitPx / 2 + 8;
                  const boxLeftPx = fanCenter - half;
                  const boxTopPx =
                    (posById.get(openCluster.memberIds[0] ?? "")?.yView ??
                      laneTop + ((openCluster.row + 0.5) / rowCount) * laneH) -
                    (hitPx / 2 + 6);
                  return (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute z-[1] rounded-lg border border-foreground/30 bg-background/60"
                      style={{
                        left: `${widthPx > 0 ? (boxLeftPx / widthPx) * 100 : 0}%`,
                        top: `${chartH > 0 ? (boxTopPx / chartH) * 100 : 0}%`,
                        width: half * 2,
                        height: `${chartH > 0 ? ((hitPx + 12) / chartH) * 100 : 0}%`,
                        opacity: fanIn ? 1 : 0,
                        transition: reduced ? undefined : "opacity 180ms ease",
                      }}
                    />
                  );
                })()}
                {openCluster.memberIds.map((id, i) => {
                const p = posById.get(id);
                if (!p) return null;
                const xPx = fanCenter + (i - (openCount - 1) / 2) * fanGap;
                const leftPct = widthPx > 0 ? (xPx / widthPx) * 100 : 0;
                const isSel = selectedId === id;
                const isFoc = focusedId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    ref={(el) => {
                      pointRefs.current[id] = el;
                    }}
                    className={cn(
                      "pointer-events-auto absolute z-[2] flex items-center justify-center -translate-x-1/2 -translate-y-1/2",
                      compact ? "size-9" : "size-7",
                      dashboardAffordance.hitSurface,
                      motionClass.microHover,
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground",
                      (isSel || isFoc) && "z-[3]",
                    )}
                    style={{
                      left: `${leftPct}%`,
                      top: pctY(p.yView),
                      opacity: fanIn ? 1 : 0,
                      transition: reduced
                        ? undefined
                        : `left 200ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 16}ms, opacity 200ms ease ${i * 16}ms`,
                    }}
                    aria-label={p.mark.ariaLabel}
                    aria-pressed={isSel}
                    onPointerDown={(event) => {
                      // 플롯의 탭=핀 폴백과 이중 토글되지 않도록 전파 차단.
                      event.stopPropagation();
                    }}
                    onPointerUp={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(p.mark);
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      collapse();
                    }}
                    onMouseEnter={() => onHover(p.mark)}
                    onMouseMove={(event) => {
                      // 플롯 전역 mousemove가 실제 좌표로 히트를 재계산해
                      // 부채꼴 호버 카드를 지우는 것을 막는다.
                      event.stopPropagation();
                    }}
                    onMouseLeave={() => onHover(null)}
                    onFocus={() => onHover(p.mark)}
                    onBlur={() => onHover(null)}
                  >
                    <span className={markDotClass(p.mark, isSel)} />
                  </button>
                );
                })}
              </>
            )}
        </>
      ) : null}
    </div>
  );
}
