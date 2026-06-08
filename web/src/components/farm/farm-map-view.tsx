import { MapPin } from "lucide-react";
import { SectionCard } from "@/components/common/section-card";

// 농장 지도(isometric) 골격. 실제 좌표/마커 데이터는 추후 매칭.
export function FarmMapView() {
  return (
    <SectionCard
      title="농장 지도"
      description="전체 시스템 연결 상태 및 환경 요약"
    >
      <div className="relative flex h-[360px] items-center justify-center rounded-md border border-dashed bg-muted/30">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <MapPin className="size-7" />
          <span className="text-xs">농장 지도 / 축사 마커 영역 (데이터 추후 매칭)</span>
        </div>
      </div>
    </SectionCard>
  );
}
