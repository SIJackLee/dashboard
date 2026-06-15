import Link from "next/link";
import { Map } from "lucide-react";
import { SectionCard } from "@/components/common/section-card";
import type { StallCatalogEntry } from "@/lib/data/stall-catalog";

type Props = {
  stallCatalog: StallCatalogEntry[];
};

export function BarnLayoutInfo({ stallCatalog }: Props) {
  return (
    <SectionCard
      title="축사 지도"
      description="LIVE 데이터에서 축사유형별 카드를 자동 생성합니다"
    >
      <p className="text-sm text-muted-foreground">
        같은 <code className="text-xs">stallTyCode</code>(후보돈사·임신사·자돈사
        등) 데이터를 한 카드로 묶어 표시합니다. 명칭은 축평원 정보연계
        인터페이스 §3.3을 따릅니다. 카드 위치만 드래그로 저장됩니다.
      </p>
      <p className="mt-3 text-sm">
        현재 LIVE 축사(stallNo) 조합:{" "}
        <span className="font-medium text-emerald-700">
          {stallCatalog.length}개
        </span>
      </p>
      <Link
        href="/farm"
        className="mt-4 inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
      >
        <Map className="size-4" />
        농장 지도 보기
      </Link>
    </SectionCard>
  );
}
