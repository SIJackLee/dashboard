"use client";

import type { BarnMapSnapshot } from "@/lib/data/iot";
import { DisplayGate } from "@/components/display/display-settings-provider";
import { FarmMapCard } from "./farm-map-card";

type Props = {
  barns: BarnMapSnapshot[];
};

/** 모바일 폴백: 그리드 대신 세로 카드 리스트 */
export function FarmMapList({ barns }: Props) {
  return (
    <DisplayGate setting="farm.mapList">
      {barns.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center md:hidden">
          <p className="text-sm text-muted-foreground">
            LIVE 데이터 수신 대기 중입니다.
          </p>
        </div>
      ) : (
        <div className="space-y-3 md:hidden">
          {barns.map((b) => (
            <FarmMapCard key={b.meta.id} snapshot={b} layout="stack" />
          ))}
        </div>
      )}
    </DisplayGate>
  );
}
