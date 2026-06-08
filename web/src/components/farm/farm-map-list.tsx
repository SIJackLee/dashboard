import Link from "next/link";
import { Settings } from "lucide-react";
import type { BarnMapSnapshot } from "@/lib/data/iot";
import { FarmMapCard } from "./farm-map-card";

type Props = {
  barns: BarnMapSnapshot[];
};

/** 모바일 폴백: 그리드 대신 세로 카드 리스트 */
export function FarmMapList({ barns }: Props) {
  if (barns.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center md:hidden">
        <p className="text-sm text-muted-foreground">
          축사가 설정되지 않았습니다.
        </p>
        <Link
          href="/settings?tab=barn"
          className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
        >
          <Settings className="size-4" />
          축사 설정으로 이동
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:hidden">
      {barns.map((b) => (
        <FarmMapCard key={b.meta.id} snapshot={b} layout="stack" />
      ))}
    </div>
  );
}
