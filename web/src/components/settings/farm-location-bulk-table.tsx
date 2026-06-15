"use client";

import { useMemo, useState } from "react";
import { regionsBySido, SIDO_LIST } from "@/lib/geo/korea-regions";
import type { EditableFarmOption } from "@/lib/data/farm-location";
import {
  draftFromOption,
  farmOptionId,
  type LocationDraft,
} from "@/lib/settings/farm-location-client";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
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
  selectedIds: Set<string>;
  onSelectedIdsChange: (next: Set<string>) => void;
  onSaveDirty: () => void;
  pending?: boolean;
};

export function FarmLocationBulkTable({
  options,
  rows,
  onRowsChange,
  selectedIds,
  onSelectedIdsChange,
  onSaveDirty,
  pending = false,
}: Props) {
  const bySido = useMemo(() => regionsBySido(), []);
  const [bulkSido, setBulkSido] = useState(SIDO_LIST[0] ?? "");
  const [bulkSigungu, setBulkSigungu] = useState(
    () => bySido.get(SIDO_LIST[0] ?? "")?.[0]?.sigungu ?? ""
  );

  const dirtyCount = useMemo(
    () => Object.values(rows).filter((r) => r.dirty).length,
    [rows]
  );

  const applyBulkRegion = () => {
    if (selectedIds.size === 0) return;
    const next = { ...rows };
    for (const id of selectedIds) {
      const prev = next[id] ?? {
        ...draftFromOption(options.find((o) => farmOptionId(o.farmKey) === id)),
        dirty: false,
      };
      next[id] = {
        ...prev,
        sido: bulkSido,
        sigungu: bulkSigungu,
        dirty: true,
      };
    }
    onRowsChange(next);
  };

  const toggleAll = (checked: boolean) => {
    onSelectedIdsChange(
      checked ? new Set(options.map((o) => farmOptionId(o.farmKey))) : new Set()
    );
  };

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-muted/15 p-4">
        <label className="space-y-1">
          <span className={dashboardUi.tableMeta}>일괄 시·도</span>
          <select
            className="rounded-lg border bg-background px-3 py-2"
            value={bulkSido}
            onChange={(e) => {
              setBulkSido(e.target.value);
              setBulkSigungu(bySido.get(e.target.value)?.[0]?.sigungu ?? "");
            }}
          >
            {SIDO_LIST.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className={dashboardUi.tableMeta}>일괄 시·군·구</span>
          <select
            className="rounded-lg border bg-background px-3 py-2"
            value={bulkSigungu}
            onChange={(e) => setBulkSigungu(e.target.value)}
          >
            {(bySido.get(bulkSido) ?? []).map((r) => (
              <option key={r.sigungu} value={r.sigungu}>
                {r.sigungu}
              </option>
            ))}
          </select>
        </label>
        <PageActionButton
          type="button"
          variant="outline"
          disabled={selectedIds.size === 0}
          onClick={applyBulkRegion}
        >
          선택 {selectedIds.size}곳에 적용
        </PageActionButton>
        <PageActionButton
          type="button"
          variant="primary"
          disabled={pending || dirtyCount === 0}
          onClick={onSaveDirty}
        >
          {pending ? "저장 중…" : `변경 ${dirtyCount}건 저장`}
        </PageActionButton>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <input
                type="checkbox"
                checked={selectedIds.size === options.length && options.length > 0}
                onChange={(e) => toggleAll(e.target.checked)}
                aria-label="전체 선택"
              />
            </TableHead>
            <TableHead>농장</TableHead>
            <TableHead>시·도</TableHead>
            <TableHead>시·군·구</TableHead>
            <TableHead>상세</TableHead>
            <TableHead>상태</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {options.map((o) => {
            const id = farmOptionId(o.farmKey);
            const row = rows[id] ?? {
              ...draftFromOption(o),
              dirty: false,
            };
            return (
              <TableRow key={id}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(id)}
                    onChange={(e) => {
                      const next = new Set(selectedIds);
                      if (e.target.checked) next.add(id);
                      else next.delete(id);
                      onSelectedIdsChange(next);
                    }}
                    aria-label={`${o.label} 선택`}
                  />
                </TableCell>
                <TableCell className="font-medium">{o.label}</TableCell>
                <TableCell>
                  <select
                    className="w-full min-w-[8rem] rounded border bg-background px-2 py-1"
                    value={row.sido}
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
                    className="w-full min-w-[8rem] rounded border bg-background px-2 py-1"
                    value={row.sigungu}
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
                    className="w-full min-w-[10rem] rounded border bg-background px-2 py-1"
                    value={row.addressDetail}
                    onChange={(e) =>
                      updateRow(id, { addressDetail: e.target.value })
                    }
                  />
                </TableCell>
                <TableCell>
                  {row.dirty ? (
                    <span className="text-amber-700">변경됨</span>
                  ) : o.location ? (
                    <span className="text-emerald-700">설정됨</span>
                  ) : (
                    <span className="text-muted-foreground">미설정</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
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
