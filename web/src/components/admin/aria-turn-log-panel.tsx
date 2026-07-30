"use client";

import { useCallback, useState, useTransition } from "react";
import {
  fetchAriaTurnLogsAction,
  setAriaTurnFeedbackAction,
  type AriaTurnFeedback,
  type AriaTurnLogRow,
} from "@/app/(dashboard)/admin/ops/aria-log-actions";
import { opsControl, opsTypography } from "@/lib/ui/dashboard-page-ui";
import { useMobileLayout } from "@/lib/ui/use-mobile-layout";
import { cn } from "@/lib/utils";

const ROUTES = ["ALL", "CHAT", "FARM", "CTRL"] as const;
type RouteFilter = (typeof ROUTES)[number];

const FEEDBACK_FILTERS = ["ALL", "none", "ok", "bad"] as const;
type FeedbackFilter = (typeof FEEDBACK_FILTERS)[number];

type Props = {
  initialRows: AriaTurnLogRow[];
};

function formatKst(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 19);
  }
}

function shortUser(id: string): string {
  return id.length <= 8 ? id : `${id.slice(0, 8)}…`;
}

function farmCell(row: AriaTurnLogRow): string {
  if (!row.lsindRegistNo) return "—";
  return row.itemCode
    ? `${row.lsindRegistNo}/${row.itemCode}`
    : row.lsindRegistNo;
}

function depthCell(row: AriaTurnLogRow): string {
  if (row.route !== "FARM" || row.depth == null) return "—";
  return `D${row.depth}`;
}

function FeedbackButtons({
  row,
  disabled,
  onSet,
}: {
  row: AriaTurnLogRow;
  disabled: boolean;
  onSet: (id: string, feedback: AriaTurnFeedback | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        disabled={disabled}
        aria-label="맞음으로 표시"
        onClick={() => onSet(row.id, "ok")}
        className={cn(
          "rounded border px-1.5 py-0.5 text-[10px] font-medium disabled:opacity-50",
          row.feedback === "ok"
            ? "border-emerald-600/50 bg-emerald-500/15 text-emerald-800"
            : "border-border/80 text-muted-foreground hover:bg-muted/40",
        )}
      >
        맞음
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-label="틀림으로 표시"
        onClick={() => onSet(row.id, "bad")}
        className={cn(
          "rounded border px-1.5 py-0.5 text-[10px] font-medium disabled:opacity-50",
          row.feedback === "bad"
            ? "border-destructive/50 bg-destructive/10 text-destructive"
            : "border-border/80 text-muted-foreground hover:bg-muted/40",
        )}
      >
        틀림
      </button>
      {row.feedback ? (
        <button
          type="button"
          disabled={disabled}
          aria-label="검수 취소"
          onClick={() => onSet(row.id, null)}
          className="rounded border border-border/80 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted/40 disabled:opacity-50"
        >
          취소
        </button>
      ) : null}
    </div>
  );
}

/** 운영 홈 — ARIA 턴 로그 (오분류 검수) */
export function AriaTurnLogPanel({ initialRows }: Props) {
  const isMobile = useMobileLayout();
  const [rows, setRows] = useState(initialRows);
  const [route, setRoute] = useState<RouteFilter>("ALL");
  const [feedbackFilter, setFeedbackFilter] = useState<FeedbackFilter>("ALL");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [markingId, setMarkingId] = useState<string | null>(null);

  const reload = useCallback(
    (nextRoute: RouteFilter, nextFeedback: FeedbackFilter) => {
      setError(null);
      setRows([]);
      startTransition(async () => {
        const result = await fetchAriaTurnLogsAction({
          limit: 50,
          route: nextRoute === "ALL" ? null : nextRoute,
          feedback: nextFeedback === "ALL" ? null : nextFeedback,
        });
        if (!result.ok) {
          setError("로그를 불러오지 못했습니다.");
          return;
        }
        setRows(result.rows);
      });
    },
    [],
  );

  const mark = useCallback(
    (id: string, feedback: AriaTurnFeedback | null) => {
      setError(null);
      setMarkingId(id);
      startTransition(async () => {
        const result = await setAriaTurnFeedbackAction({ id, feedback });
        setMarkingId(null);
        if (!result.ok) {
          setError("피드백 저장에 실패했습니다.");
          return;
        }
        setRows((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  feedback,
                  feedbackAt: feedback ? new Date().toISOString() : null,
                }
              : r,
          ),
        );
      });
    },
    [],
  );

  return (
    <section
      id="aria-logs"
      className="scroll-mt-3 rounded-xl border border-border/80 bg-card"
      data-audit-region="aria-turn-logs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5 md:px-4">
        <div>
          <h2 className={cn(opsTypography.sectionTitle, "font-semibold")}>
            ARIA 턴 로그
          </h2>
          <p className={cn(opsTypography.meta, "text-muted-foreground")}>
            오분류 검수 · 맞음/틀림 · 보관 7일
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => reload(route, feedbackFilter)}
          className={cn(opsControl.buttonOutline, "border disabled:opacity-50")}
        >
          {pending ? "불러오는 중…" : "새로고침"}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 px-3 py-2 md:px-4">
        {ROUTES.map((r) => (
          <button
            key={r}
            type="button"
            disabled={pending}
            onClick={() => {
              setRoute(r);
              reload(r, feedbackFilter);
            }}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-medium disabled:opacity-50",
              route === r
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/80 text-muted-foreground hover:bg-muted/40",
            )}
          >
            {r === "ALL" ? "전체" : r}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5 px-3 pb-2 md:px-4">
        {FEEDBACK_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            disabled={pending}
            onClick={() => {
              setFeedbackFilter(f);
              reload(route, f);
            }}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-medium disabled:opacity-50",
              feedbackFilter === f
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/80 text-muted-foreground hover:bg-muted/40",
            )}
          >
            {f === "ALL"
              ? "검수 전체"
              : f === "none"
                ? "미검수"
                : f === "ok"
                  ? "맞음"
                  : "틀림"}
          </button>
        ))}
      </div>

      {error ? (
        <p className={cn("px-3 pb-3 text-destructive md:px-4", opsTypography.meta)}>
          {error}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p
          className={cn(
            "px-3 py-8 text-center text-muted-foreground md:px-4",
            opsTypography.meta,
          )}
        >
          기록이 없습니다. ARIA에서 질문하면 여기에 쌓입니다.
        </p>
      ) : isMobile ? (
        <ul className="divide-y divide-border/60 px-3 pb-3 md:hidden">
          {rows.map((row) => (
            <li key={row.id} className="space-y-1.5 py-3">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <span>{formatKst(row.createdAt)}</span>
                <span className="rounded border px-1.5 py-0.5 font-medium text-foreground">
                  {row.route}
                </span>
                <span>{depthCell(row)}</span>
                <span>{row.source ?? "—"}</span>
              </div>
              <p className={cn(opsTypography.body, "font-medium")}>
                Q. {row.question}
              </p>
              <p className={cn(opsTypography.meta, "text-muted-foreground")}>
                A. {row.answerPreview ?? "—"}
              </p>
              <p className={cn(opsTypography.meta, "text-muted-foreground")}>
                {farmCell(row)} · {shortUser(row.userId)}
              </p>
              <FeedbackButtons
                row={row}
                disabled={pending || markingId === row.id}
                onSet={mark}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-border/60 bg-muted/30 text-[11px] text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">시각</th>
                <th className="px-2 py-2 font-medium">route</th>
                <th className="px-2 py-2 font-medium">D</th>
                <th className="px-2 py-2 font-medium">질문</th>
                <th className="px-2 py-2 font-medium">답변</th>
                <th className="px-2 py-2 font-medium">검수</th>
                <th className="px-3 py-2 font-medium">농장</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {rows.map((row) => (
                <tr key={row.id} className="align-top hover:bg-muted/20">
                  <td className="whitespace-nowrap px-3 py-2 text-[11px] text-muted-foreground">
                    {formatKst(row.createdAt)}
                  </td>
                  <td className="px-2 py-2">
                    <span className="rounded border px-1.5 py-0.5 text-[11px] font-medium">
                      {row.route}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-[11px] text-muted-foreground">
                    {depthCell(row)}
                  </td>
                  <td className="max-w-[180px] px-2 py-2 text-[12px]">
                    {row.question}
                  </td>
                  <td className="max-w-[220px] px-2 py-2 text-[12px] text-muted-foreground">
                    {row.answerPreview ?? "—"}
                  </td>
                  <td className="px-2 py-2">
                    <FeedbackButtons
                      row={row}
                      disabled={pending || markingId === row.id}
                      onSet={mark}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-[11px] text-muted-foreground">
                    {farmCell(row)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
