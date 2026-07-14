"use client";

import { useMemo } from "react";
import { regionsBySido, SIDO_LIST } from "@/lib/geo/korea-regions";
import type { EditableFarmOption } from "@/lib/data/farm-location";
import {
  draftFromOption,
  farmOptionId,
  type LocationDraft,
} from "@/lib/settings/farm-location-client";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageActionButton } from "@/components/common/page-action-button";

export type BulkRowState = LocationDraft & { dirty: boolean };

type Props = {
  options: EditableFarmOption[];
  rows: Record<string, BulkRowState>;
  onRowsChange: (next: Record<string, BulkRowState>) => void;
  onApplyRow: (id: string) => void;
  applyingId?: string | null;
  pending?: boolean;
};

export function FarmLocationBulkTable({
  options,
  rows,
  onRowsChange,
  onApplyRow,
  applyingId = null,
  pending = false,
}: Props) {
  const bySido = useMemo(() => regionsBySido(), []);

  const updateRow = (id: string, patch: Partial<LocationDraft>) => {
    const base = rows[id] ?? {
      ...draftFromOption(options.find((o) => farmOptionId(o.farmKey) === id)),
      dirty: false,
    };
    onRowsChange({
      ...rows,
      [id]: { ...base, ...patch, dirty: true },
    });
  };

  if (options.length === 0) {
    return (
      <p className={cn("py-8 text-center text-muted-foreground", dashboardUi.body)}>
        검색 조건에 맞는 농장이 없습니다.
      </p>
    );
  }

  const mobileCards = (
    <ul className="space-y-3 md:hidden">
      {options.map((o) => {
        const id = farmOptionId(o.farmKey);
        const row = rows[id] ?? {
          ...draftFromOption(o),
          dirty: false,
        };
        const isApplying = pending && applyingId === id;

        return (
          <li key={id} className="rounded-xl border bg-card p-3">
            <p className={cn(dashboardUi.body, "flex flex-wrap items-center gap-2 text-sm font-semibold")}>
              <span>{o.label}</span>
              {o.hasLiveData ? (
                <span className="rounded-full border border-emerald-500/40 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                  LIVE
                </span>
              ) : (
                <span className="rounded-full border border-amber-500/40 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                  위치만
                </span>
              )}
            </p>
            <div className="mt-3 space-y-2">
              <label className="block text-xs text-muted-foreground">
                시·도
                <select
                  className="mt-1 w-full rounded-lg border bg-background px-2 py-2 text-sm"
                  value={row.sido}
                  disabled={pending}
                  onChange={(e) => {
                    const sido = e.target.value;
                    const sigungu = bySido.get(sido)?.[0]?.sigungu ?? "";
                    updateRow(id, { sido, sigungu });
                  }}
                >
                  {SIDO_LIST.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-muted-foreground">
                시·군·구
                <select
                  className="mt-1 w-full rounded-lg border bg-background px-2 py-2 text-sm"
                  value={row.sigungu}
                  disabled={pending}
                  onChange={(e) => updateRow(id, { sigungu: e.target.value })}
                >
                  {(bySido.get(row.sido) ?? []).map((r) => (
                    <option key={r.sigungu} value={r.sigungu}>
                      {r.sigungu}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-muted-foreground">
                상세
                <input
                  className="mt-1 w-full rounded-lg border bg-background px-2 py-2 text-sm"
                  placeholder="읍·면·리 (선택)"
                  value={row.addressDetail}
                  disabled={pending}
                  onChange={(e) =>
                    updateRow(id, { addressDetail: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              {row.dirty ? (
                <span className="text-xs text-amber-700">변경됨</span>
              ) : o.location ? (
                <span className="text-xs text-emerald-700">설정됨</span>
              ) : (
                <span className="text-xs text-muted-foreground">미설정</span>
              )}
              <PageActionButton
                type="button"
                variant="primary"
                disabled={pending || !row.sido || !row.sigungu}
                onClick={() => onApplyRow(id)}
              >
                {isApplying ? "적용 중…" : "적용"}
              </PageActionButton>
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      {mobileCards}
      <div className="hidden md:block">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>농장</TableHead>
          <TableHead>시·도</TableHead>
          <TableHead>시·군·구</TableHead>
          <TableHead>상세</TableHead>
          <TableHead className="min-w-[9rem]">상태</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {options.map((o) => {
          const id = farmOptionId(o.farmKey);
          const row = rows[id] ?? {
            ...draftFromOption(o),
            dirty: false,
          };
          const isApplying = pending && applyingId === id;

          return (
            <TableRow key={id}>
              <TableCell className="font-medium">
                <div className="flex flex-wrap items-center gap-2">
                  <span>{o.label}</span>
                  {o.hasLiveData ? (
                    <span className="rounded-full border border-emerald-500/40 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                      LIVE
                    </span>
                  ) : (
                    <span className="rounded-full border border-amber-500/40 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                      위치만
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <select
                  className="w-full min-w-[8rem] rounded-lg border bg-background px-2 py-2"
                  value={row.sido}
                  disabled={pending}
                  onChange={(e) => {
                    const sido = e.target.value;
                    const sigungu = bySido.get(sido)?.[0]?.sigungu ?? "";
                    updateRow(id, { sido, sigungu });
                  }}
                >
                  {SIDO_LIST.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </TableCell>
              <TableCell>
                <select
                  className="w-full min-w-[8rem] rounded-lg border bg-background px-2 py-2"
                  value={row.sigungu}
                  disabled={pending}
                  onChange={(e) => updateRow(id, { sigungu: e.target.value })}
                >
                  {(bySido.get(row.sido) ?? []).map((r) => (
                    <option key={r.sigungu} value={r.sigungu}>
                      {r.sigungu}
                    </option>
                  ))}
                </select>
              </TableCell>
              <TableCell>
                <input
                  className="w-full min-w-[10rem] rounded-lg border bg-background px-2 py-2"
                  placeholder="읍·면·리 (선택)"
                  value={row.addressDetail}
                  disabled={pending}
                  onChange={(e) =>
                    updateRow(id, { addressDetail: e.target.value })
                  }
                />
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-2">
                  {row.dirty ? (
                    <span className="text-amber-700">변경됨</span>
                  ) : o.location ? (
                    <span className="text-emerald-700">설정됨</span>
                  ) : (
                    <span className="text-muted-foreground">미설정</span>
                  )}
                  <PageActionButton
                    type="button"
                    variant="primary"
                    disabled={pending || !row.sido || !row.sigungu}
                    onClick={() => onApplyRow(id)}
                  >
                    {isApplying ? "적용 중…" : "적용"}
                  </PageActionButton>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
      </div>
    </>
  );
}

export function buildBulkRowsFromOptions(
  options: EditableFarmOption[]
): Record<string, BulkRowState> {
  const rows: Record<string, BulkRowState> = {};
  for (const o of options) {
    rows[farmOptionId(o.farmKey)] = { ...draftFromOption(o), dirty: false };
  }
  return rows;
}

export function dirtyBulkInputs(
  options: EditableFarmOption[],
  rows: Record<string, BulkRowState>
) {
  return options
    .filter((o) => rows[farmOptionId(o.farmKey)]?.dirty)
    .map((o) => {
      const id = farmOptionId(o.farmKey);
      const row = rows[id]!;
      return {
        farmKey: o.farmKey,
        sido: row.sido,
        sigungu: row.sigungu,
        addressDetail: row.addressDetail || undefined,
      };
    });
}
