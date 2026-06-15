import type { MapZoomStage } from "@/lib/geo/farm-map-zoom";
import { MAP_ZOOM_STAGE } from "@/lib/geo/farm-map-zoom";
import { RISK_STYLE } from "@/lib/geo/farm-map-marker-scale";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  stage: MapZoomStage;
  sigunguControllerSum?: number | null;
  farmControllerSum?: number | null;
};

const RISK_LEGEND = [
  { key: "normal" as const, label: "정상" },
  { key: "caution" as const, label: "경계" },
  { key: "warning" as const, label: "주의" },
  { key: "critical" as const, label: "긴급" },
];

const STAGE_MARKER_HINT: Record<MapZoomStage, string> = {
  0: "투명 원 · 컨트롤러 수 · 지역명",
  1: "투명 사각 · 컨트롤러 수 · 지역명",
  2: "군·구 fitBounds · 컨트롤러 수 · 지역명",
  3: "농장 카드 · 왼쪽 컨트롤러 · 오른쪽 알람 클릭 (툴팁은 참고용)",
};

/** 4단계 줌 범례 + 위험도 색상 */
export function FarmGeoMapLegend({
  stage,
  sigunguControllerSum = null,
  farmControllerSum = null,
}: Props) {
  const safeStage = stage in MAP_ZOOM_STAGE ? stage : 0;
  const stageMeta = MAP_ZOOM_STAGE[safeStage];

  return (
    <div
      className={cn(
        "pointer-events-none absolute bottom-3 left-3 z-[1000] rounded-lg border border-emerald-200/80 bg-white/95 px-3 py-2",
        dashboardUi.tableMeta
      )}
      aria-label="지도 줌 단계 및 범례"
    >
      <p className="mb-1 font-semibold text-emerald-900">
        줌 {safeStage + 1}/4 · {stageMeta.label}
      </p>
      <p className="mb-2 text-[10px] text-muted-foreground">
        {STAGE_MARKER_HINT[safeStage]}
      </p>
      <p className="mb-1 text-[10px] font-semibold text-emerald-800">위험도</p>
      <ul className="space-y-1">
        {RISK_LEGEND.map((item) => (
          <li key={item.key} className="flex items-center gap-2 text-muted-foreground">
            <span
              className="inline-flex h-3.5 w-3.5 shrink-0 rounded-full border-2"
              style={{
                borderColor: RISK_STYLE[item.key].border,
                background: RISK_STYLE[item.key].fill,
              }}
              aria-hidden
            />
            {item.label}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground">
        크기 · 글자 = (지역 컨트롤러 ÷ 전체) 비율, 동일 줌 최대값 기준 선형
      </p>
      {safeStage === 3 &&
      sigunguControllerSum != null &&
      farmControllerSum != null ? (
        <p
          className={cn(
            "mt-2 text-[10px] font-semibold",
            sigunguControllerSum === farmControllerSum
              ? "text-emerald-700"
              : "text-red-600"
          )}
        >
          컨트롤러 합계 · 군·구 {sigunguControllerSum} = 농장{" "}
          {farmControllerSum}
          {sigunguControllerSum === farmControllerSum ? " ✓" : " ✗"}
        </p>
      ) : null}
    </div>
  );
}
