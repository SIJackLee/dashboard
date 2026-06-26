"use client";

import type { BarnMapSnapshot } from "@/lib/data/iot";
import { FarmMapCard } from "./farm-map-card";

type Props = {
  barns: BarnMapSnapshot[];
};

/** 모바일 폴백: 그리드 대신 세로 카드 리스트 */
export function FarmMapList({ barns }: Props) {
  if (barns.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center lg:hidden">
        <p className="text-sm text-muted-foreground">
          LIVE 데이터 수신 대기 중입니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 lg:hidden" data-audit-region="farm-map-list">
      {barns.map((b) => (
        <FarmMapCard key={b.meta.id} snapshot={b} layout="stack" />
      ))}
    </div>
  );
}
