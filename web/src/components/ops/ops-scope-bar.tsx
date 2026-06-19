"use client";

import { ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { FarmSwitcher } from "@/components/layout/farm-switcher";
import {
  ScopePillReadOnly,
  ScopePillSelect,
  type ScopePillOption,
} from "@/components/layout/scope-pill-select";
import type { FarmKey } from "@/lib/data/farm-key";
import type { FarmSummaryRow } from "@/lib/data/farm-summaries";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export const OPS_SCOPE_ALL_SP = "";
export const OPS_SCOPE_ALL_STALL = "";

const ALL_SP_OPTION: ScopePillOption = { value: OPS_SCOPE_ALL_SP, label: "전체유형" };
const ALL_STALL_OPTION: ScopePillOption = {
  value: OPS_SCOPE_ALL_STALL,
  label: "전체번호",
};

export type OpsScopeBarProps = {
  sticky?: boolean;
  /** Admin — farm dropdown (전체 N개 농장 · FARMxx) */
  adminFarmSwitcher?: {
    farmOptions: FarmKey[];
    activeFarmKey: FarmKey | null;
    farmSummaries?: FarmSummaryRow[];
  };
  farmOptions?: ScopePillOption[];
  activeFarm?: string;
  onFarmChange?: (farmId: string) => void;
  spOptions?: ScopePillOption[];
  activeSp?: string;
  onSpChange?: (code: string) => void;
  stallOptions?: ScopePillOption[];
  activeStall?: string;
  onStallChange?: (stallKey: string) => void;
  controllerOptions?: ScopePillOption[];
  activeController?: string;
  onControllerChange?: (controllerKey: string) => void;
};

function ScopeSeparator() {
  return (
    <ChevronRight
      className={dashboardUi.scopePillSeparator}
      aria-hidden
    />
  );
}

/** farm › SP › stall — Active Pill + Popover, single sticky row */
export function OpsScopeBar({
  sticky = false,
  adminFarmSwitcher,
  farmOptions = [],
  activeFarm = "",
  onFarmChange,
  spOptions = [],
  activeSp = "",
  onSpChange,
  stallOptions = [],
  activeStall = "",
  onStallChange,
  controllerOptions = [],
  activeController = "",
  onControllerChange,
}: OpsScopeBarProps) {
  const multiFarm = farmOptions.length > 1;
  const farmLabel =
    farmOptions.find((f) => f.value === activeFarm)?.label ??
    farmOptions[0]?.label ??
    "—";

  const spOptionsWithAll = useMemo(
    () => [ALL_SP_OPTION, ...spOptions],
    [spOptions]
  );
  const stallOptionsWithAll = useMemo(
    () => [ALL_STALL_OPTION, ...stallOptions],
    [stallOptions]
  );

  const showScopedPills = Boolean(activeFarm || adminFarmSwitcher?.activeFarmKey);
  const showSp =
    showScopedPills && Boolean(onSpChange) && spOptionsWithAll.length > 0;
  const showStall =
    showScopedPills && Boolean(onStallChange) && stallOptionsWithAll.length > 0;
  const showController =
    showScopedPills &&
    Boolean(onControllerChange) &&
    controllerOptions.length > 0;
  const controllerLabel =
    controllerOptions.find((c) => c.value === activeController)?.label ??
    controllerOptions[0]?.label ??
    "컨트롤러";

  return (
    <div
      className={cn(
        dashboardUi.scopeBar,
        dashboardUi.opsScopeBar,
        sticky && dashboardUi.scopeBarSticky
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        {adminFarmSwitcher ? (
          <FarmSwitcher compact {...adminFarmSwitcher} />
        ) : multiFarm && onFarmChange ? (
          <ScopePillSelect
            label={farmLabel}
            ariaLabel="농장 선택"
            options={farmOptions}
            value={activeFarm}
            onChange={onFarmChange}
          />
        ) : activeFarm ? (
          <ScopePillReadOnly label={farmLabel} ariaLabel="농장" />
        ) : null}

        {showSp ? (
          <>
            <ScopeSeparator />
            <ScopePillSelect
              label={ALL_SP_OPTION.label}
              ariaLabel="축사유형 선택"
              options={spOptionsWithAll}
              value={activeSp}
              onChange={onSpChange!}
            />
          </>
        ) : null}

        {showStall ? (
          <>
            <ScopeSeparator />
            <ScopePillSelect
              label={ALL_STALL_OPTION.label}
              ariaLabel="축사번호 선택"
              options={stallOptionsWithAll}
              value={activeStall}
              onChange={onStallChange!}
            />
          </>
        ) : null}

        {showController ? (
          <>
            <ScopeSeparator />
            <ScopePillSelect
              label={controllerLabel}
              ariaLabel="컨트롤러 선택"
              options={controllerOptions}
              value={activeController}
              onChange={onControllerChange!}
              menuClassName="min-w-[22rem]"
              labelClassName="max-w-[24rem]"
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
