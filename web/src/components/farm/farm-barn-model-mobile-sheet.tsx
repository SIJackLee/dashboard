"use client";

import type { ReactNode } from "react";
import { BarnPanelBottomSheet } from "@/components/farm/barn-panel-bottom-sheet";
import { cn } from "@/lib/utils";

export type BarnModelMobileSheetPage = "palette" | "chart";

type Props = {
  peek: boolean;
  onPeek: () => void;
  onExpand: () => void;
  page: BarnModelMobileSheetPage;
  onPageChange: (page: BarnModelMobileSheetPage) => void;
  chartReady: boolean;
  palette: ReactNode;
  chart: ReactNode;
};

export function FarmBarnModelMobileSheet({
  peek,
  onPeek,
  onExpand,
  page,
  onPageChange,
  chartReady,
  palette,
  chart,
}: Props) {
  return (
    <BarnPanelBottomSheet
      open
      peek={peek}
      onClose={onPeek}
      onPeek={onPeek}
      onExpand={onExpand}
      peekAriaLabel="모델 시트 열기"
      title="모델"
      auditRegion="barn-model-mobile-sheet"
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      suppressFocusOutClose
    >
      <div
        className="mx-3 mt-1 mb-2 inline-flex shrink-0 rounded-xl border bg-muted/40 p-1"
        role="tablist"
        aria-label="모델 시트"
      >
        <button
          type="button"
          role="tab"
          aria-selected={page === "palette"}
          className={cn(
            "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium",
            page === "palette"
              ? "bg-background text-foreground"
              : "text-muted-foreground",
          )}
          onClick={() => onPageChange("palette")}
        >
          축사
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={page === "chart"}
          disabled={!chartReady}
          className={cn(
            "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium",
            page === "chart"
              ? "bg-background text-foreground"
              : "text-muted-foreground",
            !chartReady && "opacity-40",
          )}
          onClick={() => {
            if (chartReady) onPageChange("chart");
          }}
        >
          차트
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {page === "palette" ? palette : chart}
      </div>
    </BarnPanelBottomSheet>
  );
}
