import { SectionCard } from "@/components/common/section-card";
import type { BarnMapSnapshot } from "@/lib/data/iot";
import { FarmMapCanvas } from "./farm-map-canvas";
import { FarmMapList } from "./farm-map-list";
import { FarmMapResetButton } from "./farm-map-reset-button";

type Props = {
  barns: BarnMapSnapshot[];
  gridCols?: number;
  gridRows?: number;
};

export function FarmMapView({
  barns,
  gridCols = 4,
  gridRows = 4,
}: Props) {
  return (
    <SectionCard
      title="농장 지도"
      description={`⋮⋮ 드래그로 위치 변경 · ${gridCols}×${gridRows}`}
      action={<FarmMapResetButton />}
      className="overflow-hidden"
    >
      {barns.length === 0 ? (
        <div className="flex min-h-[24rem] flex-col items-center justify-center gap-3 rounded-md border border-dashed bg-muted/30">
          <p className="text-sm text-muted-foreground">
            LIVE 데이터에 stallNo가 포함된 축사가 없습니다.
          </p>
          <p className="text-xs text-muted-foreground">
            통신모듈 수신 후 자동으로 지도에 표시됩니다.
          </p>
        </div>
      ) : (
        <>
          <FarmMapCanvas
            initialBarns={barns}
            gridCols={gridCols}
            gridRows={gridRows}
          />
          <FarmMapList barns={barns} />
        </>
      )}
    </SectionCard>
  );
}
