"use client";

import type { BarnMapSnapshot } from "@/lib/data/iot";
import { parseBarnCatalogKey } from "@/lib/data/barn-catalog";
import { FarmMapCard } from "./farm-map-card";

type Props = {
  barns: BarnMapSnapshot[];
  bulkMode?: boolean;
  selectedSps?: Set<string>;
  onToggleSp?: (sp: string) => void;
  onOpenGraph?: (sp: string) => void;
};

/** 모바일 폴백: 그리드 대신 세로 카드 리스트 */
export function FarmMapList({
  barns,
  bulkMode = false,
  selectedSps,
  onToggleSp,
  onOpenGraph,
}: Props) {
  if (barns.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          LIVE 데이터 수신 대기 중입니다.
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-3 p-3" data-audit-region="farm-map-list">
      {barns.map((b) => {
        const spCode = parseBarnCatalogKey(b.meta.id)?.stallTyCode ?? "";
        const selectable = bulkMode && Boolean(spCode);
        const selected = selectable && Boolean(selectedSps?.has(spCode));
        const onSelect =
          bulkMode && onToggleSp && spCode
            ? () => onToggleSp(spCode)
            : onOpenGraph && spCode
              ? () => onOpenGraph(spCode)
              : undefined;

        return (
          <FarmMapCard
            key={b.meta.id}
            snapshot={b}
            layout="stack"
            selectable={selectable}
            selected={selected}
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
}
