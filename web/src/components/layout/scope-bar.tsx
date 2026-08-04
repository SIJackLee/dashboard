"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { FarmSwitcher } from "@/components/layout/farm-switcher";
import { useHydrationSafeDashboardCompact } from "@/components/layout/dashboard-viewport-context";
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

/** farm · SP · stall — controllers / alarms / farm 공통 (새로고침·레이어는 TopBar) */
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
  adminFarmSwitcher,
}: ScopeBarProps) {
  const compact = useHydrationSafeDashboardCompact();
  const [pendingChip, setPendingChip] = useState<PendingChip | null>(null);
  const [chipPending, startChipTransition] = useTransition();

  // 선택 반영되면 busy 칩 해제
  if (
    pendingChip &&
    ((pendingChip.kind === "farm" && activeFarm === pendingChip.value) ||
      (pendingChip.kind === "sp" && activeSp === pendingChip.value) ||
      (pendingChip.kind === "stall" && activeStall === pendingChip.value))
  ) {
    setPendingChip(null);
  }

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

  const titleRow =
    adminFarmSwitcher != null ? (
      /* 모바일: 농장 선택은 계정 메뉴 · 여기엔 보기 토글만 */
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        {!compact ? (
          <div className="min-w-0 shrink">
            <FarmSwitcher
              {...adminFarmSwitcher}
              compact={adminFarmSwitcher.compact}
            />
          </div>
        ) : null}
        {/* FarmPageContent 보기 토글(그리드/목록/차트) portal 대상 */}
        <div
          data-farm-view-toggle-slot
          className={cn(
            "flex min-w-0 shrink-0 items-center",
            compact ? "w-full" : "sm:ml-auto",
          )}
        />
      </div>
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
      <div className="flex min-w-0 flex-1 items-center gap-2">
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
      </div>
    ) : null;

  return (
    <div
      className={cn(
        dashboardUi.scopeBar,
        sticky && dashboardUi.scopeBarSticky,
      )}
    >
      <div className={cn("min-w-0 space-y-3", dashboardUi.body)}>
        {titleRow ? (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">{titleRow}</div>
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
