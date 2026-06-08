import Link from "next/link";
import { Settings } from "lucide-react";
import { SectionCard } from "@/components/common/section-card";
import type { BarnMapSnapshot } from "@/lib/data/iot";
import { FarmMapCanvas } from "./farm-map-canvas";
import { FarmMapList } from "./farm-map-list";

type Props = {
  barns: BarnMapSnapshot[];
  gatewayOnline?: boolean;
  moduleCount?: number;
};

export function FarmMapView({
  barns,
  gatewayOnline = false,
  moduleCount = 0,
}: Props) {
  return (
    <SectionCard
      title="농장 지도"
      description="축사별 환경 요약 · 드래그로 배치 변경"
    >
      {barns.length === 0 ? (
        <div className="flex min-h-[20rem] flex-col items-center justify-center gap-3 rounded-md border border-dashed bg-muted/30">
          <p className="text-sm text-muted-foreground">
            축사가 설정되지 않았습니다. 설정에서 축사를 추가하면 지도에 표시됩니다.
          </p>
          <Link
            href="/settings?tab=barn"
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Settings className="size-4" />
            축사 설정으로 이동
          </Link>
        </div>
      ) : (
        <>
          <FarmMapCanvas
            initialBarns={barns}
            gatewayOnline={gatewayOnline}
            moduleCount={moduleCount}
          />
          <FarmMapList barns={barns} />
        </>
      )}
    </SectionCard>
  );
}
