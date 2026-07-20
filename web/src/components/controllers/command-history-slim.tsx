"use client";

import { useMemo, useState, useTransition } from "react";
import { fetchOpsCommandHistoryAction } from "@/app/(dashboard)/admin/ops/command-history-actions";
import { CommandHistoryDetail } from "@/components/controllers/command-history-detail";
import {
  filterThermoCommands,
  type CommandHistoryStatusFilter,
} from "@/components/controllers/command-history-filter";
import { CommandHistoryTable } from "@/components/controllers/command-history-table";
import { CommandHistoryMobileList } from "@/components/controllers/command-history-mobile-list";
import {
  COMMAND_HISTORY_RANGE_DEFAULT,
  CommandHistoryRangeChips,
  commandHistoryRangeFromIso,
  type CommandHistoryRangeId,
} from "@/components/controllers/command-history-range-chips";
import { CommandHistoryStatusChips } from "@/components/controllers/command-history-status-chips";
import { BarnPanelBottomSheet } from "@/components/farm/barn-panel-bottom-sheet";
import { Input } from "@/components/ui/input";
import { opsControl, opsTypography } from "@/lib/ui/dashboard-page-ui";
import { useMobileLayout } from "@/lib/ui/use-mobile-layout";
import type { ThermoCommand } from "@/lib/data/commands";
import { cn } from "@/lib/utils";

const PREVIEW_LIMIT = 5;
const FULL_FETCH_LIMIT = 200;

type Props = {
  commands: ThermoCommand[];
};

function EmptyLookupCta({
  kind,
  range,
  atCap,
  pending,
  onResetFilters,
  onWidenRange,
}: {
  kind: "filtered" | "period";
  range: CommandHistoryRangeId;
  atCap: boolean;
  pending: boolean;
  onResetFilters: () => void;
  onWidenRange: (range: CommandHistoryRangeId) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <p className={opsTypography.meta}>
        {kind === "period"
          ? "해당 기간 명령이 없습니다."
          : "조건에 맞는 명령이 없습니다."}
      </p>
      {kind === "filtered" && atCap ? (
        <p className={opsTypography.meta}>
          최대 {FULL_FETCH_LIMIT}건까지 검색합니다. 기간을 넓히거나 검색어를
          바꿔보세요.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {kind === "filtered" ? (
          <button
            type="button"
            disabled={pending}
            onClick={onResetFilters}
            className={cn(opsControl.buttonOutline, "border disabled:opacity-50")}
          >
            필터 초기화
          </button>
        ) : null}
        {kind === "period" && range !== "7d" && range !== "all" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => onWidenRange("7d")}
            className={cn(opsControl.buttonOutline, "border disabled:opacity-50")}
          >
            7일
          </button>
        ) : null}
        {range !== "all" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => onWidenRange("all")}
            className={cn(opsControl.buttonOutline, "border disabled:opacity-50")}
          >
            {kind === "filtered" ? "기간 넓히기" : "기간 전체"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** 운영 홈 — 접힘 → 5건 · 조회(+기간·상태·검색) · 행 상세. */
export function CommandHistorySlim({ commands: initial }: Props) {
  const isMobile = useMobileLayout();
  const [previewCommands] = useState(initial);
  const [fullCommands, setFullCommands] = useState<ThermoCommand[]>([]);
  const [sectionOpen, setSectionOpen] = useState(false);
  const [pcFull, setPcFull] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [range, setRange] = useState<CommandHistoryRangeId>(
    COMMAND_HISTORY_RANGE_DEFAULT,
  );
  const [statusFilter, setStatusFilter] =
    useState<CommandHistoryStatusFilter>("all");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<ThermoCommand | null>(null);
  const [pending, startTransition] = useTransition();

  const preview = previewCommands.slice(0, PREVIEW_LIMIT);
  const atCap = fullCommands.length >= FULL_FETCH_LIMIT;

  const filteredFull = useMemo(
    () =>
      filterThermoCommands(fullCommands, {
        query,
        status: statusFilter,
      }),
    [fullCommands, query, statusFilter],
  );

  const shown = !sectionOpen
    ? []
    : isMobile
      ? preview
      : pcFull
        ? filteredFull
        : preview;

  const hasActiveLookup =
    Boolean(query.trim()) || statusFilter !== "all";

  const fullTitleCount = hasActiveLookup
    ? `${filteredFull.length}/${fullCommands.length}`
    : `${fullCommands.length}`;

  const title = !sectionOpen
    ? `명령 · 최근 ${Math.min(PREVIEW_LIMIT, previewCommands.length)}건`
    : isMobile || !pcFull
      ? `최근 명령 · ${Math.min(PREVIEW_LIMIT, previewCommands.length)}건`
      : `명령 조회 · ${fullTitleCount}건`;

  const loadRange = (next: CommandHistoryRangeId, openTarget: "sheet" | "pc") => {
    startTransition(async () => {
      const fromIso = commandHistoryRangeFromIso(next);
      const rows = await fetchOpsCommandHistoryAction({
        limit: FULL_FETCH_LIMIT,
        fromIso,
      });
      setFullCommands(rows);
      setRange(next);
      if (openTarget === "sheet") setSheetOpen(true);
      if (openTarget === "pc") setPcFull(true);
    });
  };

  const openFull = () => {
    setQuery("");
    setStatusFilter("all");
    setDetail(null);
    loadRange(COMMAND_HISTORY_RANGE_DEFAULT, isMobile ? "sheet" : "pc");
  };

  const onRangeChange = (next: CommandHistoryRangeId) => {
    if (next === range && fullCommands.length > 0) return;
    setDetail(null);
    loadRange(next, isMobile ? "sheet" : "pc");
  };

  const resetFilters = () => {
    setQuery("");
    setStatusFilter("all");
  };

  const collapse = () => {
    setSectionOpen(false);
    setPcFull(false);
    setSheetOpen(false);
    setDetail(null);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setDetail(null);
  };

  const showFullBtn = sectionOpen && (isMobile || !pcFull);

  const emptyKind: "filtered" | "period" | null =
    fullCommands.length === 0
      ? "period"
      : filteredFull.length === 0
        ? "filtered"
        : null;

  const emptyMessage =
    emptyKind === "filtered"
      ? "조건에 맞는 명령이 없습니다."
      : "해당 기간 명령이 없습니다.";

  const capHint = (
    <p className={opsTypography.meta}>
      기본 7일 · 최대 {FULL_FETCH_LIMIT}건
      {atCap ? " · 상한 도달" : ""}
    </p>
  );

  const lookupToolbar = (
    <div className="flex flex-col gap-2">
      <CommandHistoryRangeChips
        value={range}
        onChange={onRangeChange}
        disabled={pending}
      />
      <CommandHistoryStatusChips
        value={statusFilter}
        onChange={setStatusFilter}
        disabled={pending}
      />
      <Input
        uiSize="dashboard"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="검색: 농장·축사·장비·메모·오류·ID…"
        aria-label="명령 검색"
        className={opsControl.input}
      />
      {capHint}
      {(pcFull || sheetOpen) && !pending ? (
        <p aria-live="polite" className="sr-only">
          조회 결과 {filteredFull.length}건
          {atCap ? `, 최대 ${FULL_FETCH_LIMIT}건 상한` : ""}
        </p>
      ) : null}
    </div>
  );

  const emptyCta =
    emptyKind && (pcFull || sheetOpen) ? (
      <EmptyLookupCta
        kind={emptyKind}
        range={range}
        atCap={atCap}
        pending={pending}
        onResetFilters={resetFilters}
        onWidenRange={(r) => onRangeChange(r)}
      />
    ) : null;

  return (
    <>
      <CommandHistoryTable
        commands={shown}
        title={title}
        bodyHidden={!sectionOpen}
        mobileDensity={isMobile ? "brief" : "default"}
        toolbar={pcFull && !isMobile ? lookupToolbar : undefined}
        onSelect={
          pcFull && !isMobile
            ? (c) => {
                setDetail(c);
              }
            : undefined
        }
        emptyMessage={emptyMessage}
        emptyExtra={
          pcFull && !isMobile && emptyKind && !pending ? emptyCta : undefined
        }
        className="border-border/60 bg-muted/10"
        action={
          <div className="flex flex-wrap items-center gap-1.5">
            {showFullBtn ? (
              <button
                type="button"
                onClick={openFull}
                disabled={pending}
                className={cn(
                  opsControl.buttonOutline,
                  "border disabled:opacity-50",
                )}
              >
                {pending ? "불러오는 중…" : "조회"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (!sectionOpen) {
                  setSectionOpen(true);
                  return;
                }
                collapse();
              }}
              disabled={pending}
              className={cn(
                opsControl.buttonOutline,
                "border disabled:opacity-50",
              )}
            >
              {!sectionOpen ? "펼치기" : "접기"}
            </button>
          </div>
        }
      />

      {isMobile ? (
        <BarnPanelBottomSheet
          open={sheetOpen}
          onClose={closeSheet}
          onBack={detail ? () => setDetail(null) : undefined}
          backLabel="목록"
          title={
            detail
              ? "명령 상세"
              : `명령 조회 · ${fullTitleCount}건`
          }
          auditRegion="ops-command-history-sheet"
          contentClassName="overflow-y-auto p-3"
        >
          {detail ? (
            <CommandHistoryDetail command={detail} />
          ) : (
            <>
              <div className="mb-3">{lookupToolbar}</div>
              {pending && fullCommands.length === 0 ? (
                <p className={cn("py-6 text-center", opsTypography.meta)}>
                  불러오는 중…
                </p>
              ) : emptyKind ? (
                emptyCta
              ) : (
                <CommandHistoryMobileList
                  commands={filteredFull}
                  density="default"
                  forceVisible
                  onSelect={setDetail}
                />
              )}
            </>
          )}
        </BarnPanelBottomSheet>
      ) : null}

      {!isMobile ? (
        <BarnPanelBottomSheet
          open={Boolean(detail) && pcFull}
          onClose={() => setDetail(null)}
          title="명령 상세"
          auditRegion="ops-command-detail-sheet"
          contentClassName="overflow-y-auto p-3"
        >
          {detail ? <CommandHistoryDetail command={detail} /> : null}
        </BarnPanelBottomSheet>
      ) : null}
    </>
  );
}
