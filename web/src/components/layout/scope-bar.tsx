"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { RefreshActionButton } from "@/components/common/refresh-action-button";
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
  refreshBusy?: boolean;
  refreshShowSpinner?: boolean;
  /** Admin — TopBar FarmSwitcher → ScopeBar 통합 (alarms 등 farm-only 페이지) */
  adminFarmSwitcher?: {
    farmOptions: FarmKey[];
    activeFarmKey: FarmKey | null;
    farmSummaries?: FarmSummaryRow[];
    compact?: boolean;
  };
};

type PendingChip =
  | { kind: "farm"; value: string }
  | { kind: "sp"; value: string }
  | { kind: "stall"; value: string };

function ScopeChip({
  label,
  active,
  busy,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      aria-current={active ? "true" : undefined}
      className={cn(
        dashboardUi.scopeChip,
        "inline-flex items-center gap-1.5 transition-colors disabled:cursor-wait disabled:opacity-80",
        active
          ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {busy ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
      ) : null}
      {busy ? `${label}…` : label}
    </button>
  );
}

function ScopeRefreshButton({
  onRefresh,
  refreshBusy,
  refreshShowSpinner,
}: {
  onRefresh: () => void;
  refreshBusy: boolean;
  refreshShowSpinner: boolean;
}) {
  return (
    <RefreshActionButton
      onClick={onRefresh}
      loading={refreshBusy}
      showSpinner={refreshShowSpinner}
      className="shrink-0"
    />
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
  refreshBusy = false,
  refreshShowSpinner = false,
  adminFarmSwitcher,
}: ScopeBarProps) {
  const [pendingChip, setPendingChip] = useState<PendingChip | null>(null);
  const [chipPending, startChipTransition] = useTransition();

  useEffect(() => {
    if (!pendingChip) return;
    if (pendingChip.kind === "farm" && activeFarm === pendingChip.value) {
      setPendingChip(null);
    } else if (pendingChip.kind === "sp" && activeSp === pendingChip.value) {
      setPendingChip(null);
    } else if (
      pendingChip.kind === "stall" &&
      activeStall === pendingChip.value
    ) {
      setPendingChip(null);
    }
  }, [activeFarm, activeSp, activeStall, pendingChip]);

  // active prop이 안 바뀌는 경우(동일 값·외부 동기화 지연) busy 고착 방지
  useEffect(() => {
    if (!pendingChip) return;
    const t = window.setTimeout(() => setPendingChip(null), 2500);
    return () => window.clearTimeout(t);
  }, [pendingChip]);

  const selectChip = (chip: PendingChip, run: () => void) => {
    if (chipPending || pendingChip) return;
    setPendingChip(chip);
    startChipTransition(() => {
      run();
    });
  };

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

  const refreshSlot =
    onRefresh != null ? (
      <ScopeRefreshButton
        onRefresh={onRefresh}
        refreshBusy={refreshBusy}
        refreshShowSpinner={refreshShowSpinner}
      />
    ) : null;

  const titleRow =
    adminFarmSwitcher != null ? (
      <FarmSwitcher {...adminFarmSwitcher} compact={adminFarmSwitcher.compact} />
    ) : multiFarm && onFarmChange ? (
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <span className={dashboardUi.scopeLabel}>농장</span>
        {farmOptions.map((f) => (
          <ScopeChip
            key={f.value}
            label={f.label}
            active={activeFarm === f.value}
            busy={
              pendingChip?.kind === "farm" && pendingChip.value === f.value
            }
            disabled={Boolean(pendingChip) && pendingChip?.value !== f.value}
            onClick={() => {
              if (activeFarm === f.value) return;
              selectChip({ kind: "farm", value: f.value }, () =>
                onFarmChange(f.value),
              );
            }}
          />
        ))}
      </div>
    ) : showFarmMeta ? (
      <p className="min-w-0 text-muted-foreground">
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
    ) : null;

  return (
    <div
      className={cn(
        dashboardUi.scopeBar,
        sticky && dashboardUi.scopeBarSticky,
      )}
    >
      <div className={cn("min-w-0 space-y-3", dashboardUi.body)}>
        {titleRow || refreshSlot ? (
          <div className="flex items-start justify-between gap-2">
            {titleRow ? (
              <div className="min-w-0 flex-1">{titleRow}</div>
            ) : (
              <div className="min-w-0 flex-1" />
            )}
            {refreshSlot}
          </div>
        ) : null}

        {showSpChips ? (
          <div
            className={cn("flex flex-wrap items-center", dashboardUi.chipStripGap)}
          >
            <span className={cn("w-full sm:w-auto", dashboardUi.scopeLabel)}>
              축사유형
            </span>
            {spOptions.map((sp) => (
              <ScopeChip
                key={sp.value}
                label={sp.label}
                active={activeSp === sp.value}
                busy={pendingChip?.kind === "sp" && pendingChip.value === sp.value}
                disabled={Boolean(pendingChip) && pendingChip?.value !== sp.value}
                onClick={() => {
                  if (activeSp === sp.value) return;
                  selectChip({ kind: "sp", value: sp.value }, () =>
                    onSpChange!(sp.value),
                  );
                }}
              />
            ))}
          </div>
        ) : null}

        {showStallRow ? (
          <div
            className={cn("flex flex-wrap items-center", dashboardUi.chipStripGap)}
          >
            <span className={cn("w-full sm:w-auto", dashboardUi.scopeLabel)}>
              축사번호
            </span>
            {stallOptions.map((stall) => (
              <ScopeChip
                key={stall.value}
                label={stall.label}
                active={activeStall === stall.value}
                busy={
                  pendingChip?.kind === "stall" &&
                  pendingChip.value === stall.value
                }
                disabled={
                  Boolean(pendingChip) && pendingChip?.value !== stall.value
                }
                onClick={() => {
                  if (activeStall === stall.value) return;
                  selectChip({ kind: "stall", value: stall.value }, () =>
                    onStallChange!(stall.value),
                  );
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
