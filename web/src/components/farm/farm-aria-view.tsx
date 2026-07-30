"use client";

import type { FarmKey } from "@/lib/data/farm-key";
import { farmShortLabel } from "@/lib/data/farm-summaries";
import { cn } from "@/lib/utils";

type Props = {
  currentFarm?: FarmKey | null;
  isMobileStack?: boolean;
  className?: string;
};

/**
 * Hotfix stub — main 빌드용.
 * 정식 오브/도크 UI는 로컬 `farm-aria-view.full.local.bak` 및 [프로토콜] 브랜치에서 교체.
 */
export function FarmAriaView({
  currentFarm = null,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex min-h-[min(72dvh,34rem)] flex-col items-center justify-center gap-2 px-4 text-center",
        className,
      )}
      data-testid="farm-aria-view"
    >
      <h2 className="text-lg font-semibold tracking-tight">ARIA</h2>
      {currentFarm ? (
        <p className="text-sm text-muted-foreground">
          {farmShortLabel(currentFarm)} · 음성 어시스턴트
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          농장을 선택하면 음성 AI를 사용할 수 있습니다.
        </p>
      )}
      <p className="max-w-sm text-xs text-muted-foreground">
        탭·URL 연동은 활성화되어 있습니다. 오브·도크 UI는 후속 배포에서 제공됩니다.
      </p>
    </div>
  );
}
