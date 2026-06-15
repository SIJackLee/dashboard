"use client";

import { RefreshCw } from "lucide-react";
import { PageActionButton } from "@/components/common/page-action-button";
import { cn } from "@/lib/utils";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";

export type ContextOption = { value: string; label: string };

type Props = {
  lsindRegistNo: string;
  stallTypeLabel: string;
  spOptions: ContextOption[];
  activeSp: string;
  stallOptions?: ContextOption[];
  activeStall?: string;
  onStallChange?: (stallKey: string) => void;
  farmOptions?: ContextOption[];
  activeFarm?: string;
  onSpChange: (code: string) => void;
  onFarmChange?: (farmId: string) => void;
  onRefresh?: () => void;
};

/** 농장 → 축사유형 → 축사번호 컨텍스트 */
export function ControllerContextBar({
  lsindRegistNo,
  stallTypeLabel,
  spOptions,
  activeSp,
  stallOptions = [],
  activeStall = "",
  onStallChange,
  farmOptions = [],
  activeFarm,
  onSpChange,
  onFarmChange,
  onRefresh,
}: Props) {
  const multiFarm = farmOptions.length > 1;
  const showSpChips = Boolean(activeFarm) && spOptions.length > 1;
  const showStallRow =
    Boolean(activeFarm) && Boolean(activeSp) && stallOptions.length > 0;

  return (
    <div className={dashboardUi.contextPanel}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className={cn("min-w-0 flex-1", dashboardUi.body)}>
          {multiFarm ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className={dashboardUi.label}>축산업등록번호</span>
              {farmOptions.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => onFarmChange?.(f.value)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 font-medium transition-colors",
                    activeFarm === f.value
                      ? "bg-emerald-100 text-emerald-900"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          ) : (
            <p>
              <span className="text-muted-foreground">축산업등록번호 : </span>
              <span className="font-medium">{lsindRegistNo}</span>
              {!showSpChips && (
                <>
                  <span className="mx-3 text-muted-foreground">·</span>
                  <span className="text-muted-foreground">축사유형 : </span>
                  <span className="font-medium">{stallTypeLabel}</span>
                </>
              )}
            </p>
          )}
        </div>
        {onRefresh && (
          <PageActionButton
            onClick={onRefresh}
            icon={<RefreshCw className={dashboardUi.iconSm} aria-hidden />}
            className="shrink-0"
          >
            새로고침
          </PageActionButton>
        )}
      </div>

      {showSpChips && (
        <div
          className={cn(
            "mt-4 border-t pt-4",
            "flex flex-wrap",
            dashboardUi.chipStripGap
          )}
        >
          <span className={cn("w-full", dashboardUi.label)}>축사유형</span>
          {spOptions.map((sp) => (
            <button
              key={sp.value}
              type="button"
              onClick={() => onSpChange(sp.value)}
              className={cn(
                dashboardUi.spChip,
                "transition-colors",
                activeSp === sp.value
                  ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {sp.label}
            </button>
          ))}
        </div>
      )}

      {showStallRow && (
        <div
          className={cn(
            showSpChips ? "mt-3" : "mt-4 border-t pt-4",
            "flex flex-wrap",
            dashboardUi.chipStripGap
          )}
        >
          <span className={cn("w-full", dashboardUi.label)}>축사번호</span>
          {stallOptions.map((stall) => (
            <button
              key={stall.value}
              type="button"
              onClick={() => onStallChange?.(stall.value)}
              className={cn(
                dashboardUi.spChip,
                "transition-colors",
                activeStall === stall.value
                  ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {stall.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
