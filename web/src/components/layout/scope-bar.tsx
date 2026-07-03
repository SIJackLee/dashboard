"use client";

import { RefreshCw } from "lucide-react";
import { PageActionButton } from "@/components/common/page-action-button";
import { FarmSwitcher } from "@/components/layout/farm-switcher";
import type { FarmKey } from "@/lib/data/farm-key";
import type { FarmSummaryRow } from "@/lib/data/farm-summaries";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export type ScopeChipOption = { value: string; label: string };

export type ScopeBarProps = {
  /** controllers 등 — 스크롤 시 상단 고정 */
  sticky?: boolean;
  lsindRegistNo?: string;
  stallTypeLabel?: string;
  farmOptions?: ScopeChipOption[];
  activeFarm?: string;
  onFarmChange?: (farmId: string) => void;
  spOptions?: ScopeChipOption[];
  activeSp?: string;
  onSpChange?: (code: string) => void;
  stallOptions?: ScopeChipOption[];
  activeStall?: string;
  onStallChange?: (stallKey: string) => void;
  onRefresh?: () => void;
  /** Admin — TopBar FarmSwitcher → ScopeBar 통합 (alarms 등 farm-only 페이지) */
  adminFarmSwitcher?: {
    farmOptions: FarmKey[];
    activeFarmKey: FarmKey | null;
    farmSummaries?: FarmSummaryRow[];
    compact?: boolean;
  };
};

function ScopeChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        dashboardUi.scopeChip,
        "transition-colors",
        active
          ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

/** farm · SP · stall · Refresh — controllers / alarms / farm 공통 */
export function ScopeBar({
  sticky = false,
  lsindRegistNo,
  stallTypeLabel,
  farmOptions = [],
  activeFarm,
  onFarmChange,
  spOptions = [],
  activeSp = "",
  onSpChange,
  stallOptions = [],
  activeStall = "",
  onStallChange,
  onRefresh,
  adminFarmSwitcher,
}: ScopeBarProps) {
  const multiFarm = farmOptions.length > 1;
  const showSpChips = Boolean(activeFarm) && spOptions.length > 1 && onSpChange;
  const showStallRow =
    Boolean(activeFarm) &&
    Boolean(activeSp) &&
    stallOptions.length > 0 &&
    onStallChange;
  const showFarmMeta =
    !adminFarmSwitcher &&
    !multiFarm &&
    (lsindRegistNo || stallTypeLabel) &&
    !showSpChips;

  return (
    <div
      className={cn(
        dashboardUi.scopeBar,
        sticky && dashboardUi.scopeBarSticky
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className={cn("min-w-0 flex-1 space-y-3", dashboardUi.body)}>
          {adminFarmSwitcher ? (
            <FarmSwitcher {...adminFarmSwitcher} compact={adminFarmSwitcher.compact} />
          ) : null}

          {multiFarm && onFarmChange ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className={dashboardUi.scopeLabel}>농장</span>
              {farmOptions.map((f) => (
                <ScopeChip
                  key={f.value}
                  label={f.label}
                  active={activeFarm === f.value}
                  onClick={() => onFarmChange(f.value)}
                />
              ))}
            </div>
          ) : null}

          {showFarmMeta ? (
            <p className="text-muted-foreground">
              {lsindRegistNo ? (
                <>
                  <span>축산업등록번호 </span>
                  <span className="font-medium text-foreground">{lsindRegistNo}</span>
                </>
              ) : null}
              {lsindRegistNo && stallTypeLabel ? (
                <span className="mx-2">·</span>
              ) : null}
              {stallTypeLabel ? (
                <>
                  <span>축사유형 </span>
                  <span className="font-medium text-foreground">{stallTypeLabel}</span>
                </>
              ) : null}
            </p>
          ) : null}

          {showSpChips ? (
            <div className={cn("flex flex-wrap items-center", dashboardUi.chipStripGap)}>
              <span className={cn("w-full sm:w-auto", dashboardUi.scopeLabel)}>축사유형</span>
              {spOptions.map((sp) => (
                <ScopeChip
                  key={sp.value}
                  label={sp.label}
                  active={activeSp === sp.value}
                  onClick={() => onSpChange(sp.value)}
                />
              ))}
            </div>
          ) : null}

          {showStallRow ? (
            <div className={cn("flex flex-wrap items-center", dashboardUi.chipStripGap)}>
              <span className={cn("w-full sm:w-auto", dashboardUi.scopeLabel)}>축사번호</span>
              {stallOptions.map((stall) => (
                <ScopeChip
                  key={stall.value}
                  label={stall.label}
                  active={activeStall === stall.value}
                  onClick={() => onStallChange(stall.value)}
                />
              ))}
            </div>
          ) : null}
        </div>

        {onRefresh ? (
          <PageActionButton
            onClick={onRefresh}
            icon={<RefreshCw className={dashboardUi.iconSm} aria-hidden />}
            className="shrink-0"
          >
            새로고침
          </PageActionButton>
        ) : null}
      </div>
    </div>
  );
}
