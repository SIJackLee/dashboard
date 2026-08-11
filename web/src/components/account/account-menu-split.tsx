"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { AccountMenuPins } from "@/components/account/account-menu-pins";
import { FarmAddressInput } from "@/components/settings/farm-address-input";
import { FarmSwitcher } from "@/components/layout/farm-switcher";
import { isValidFarmKey } from "@/lib/data/barn-catalog";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import type { EditableFarmOption } from "@/lib/data/farm-location";
import type { FarmSummaryRow } from "@/lib/data/farm-summaries";
import { formatKst } from "@/lib/datetime/kst";
import type { AlarmRow } from "@/lib/data/alarms";
import type { ModuleReceipt, FarmOverview } from "@/lib/data/iot";
import {
  accountMenuLayout,
  CONTROLLER_STATUS_LABEL,
} from "@/lib/ui/account-menu-layout";
import { cn } from "@/lib/utils";

type Props = {
  farmLabel?: string | null;
  activeFarmKey?: FarmKey | null;
  receipts?: ModuleReceipt[];
  overview?: FarmOverview;
  alarms?: AlarmRow[];
  farmKey?: FarmKey | null;
  farmOptions?: FarmKey[];
  farmSummaries?: FarmSummaryRow[];
  activeFarmLocation?: EditableFarmOption | null;
  canEditLocation?: boolean;
  deferAddressFocus?: boolean;
  onCloseMenu?: () => void;
  onFarmSaved?: () => void;
};

function statusDotClass(status: ModuleReceipt["status"] | undefined) {
  if (status === "caution") return accountMenuLayout.liveStatusDotWarn;
  if (status === "offline") return accountMenuLayout.liveStatusDotOffline;
  return accountMenuLayout.liveStatusDot;
}

export function AccountMenuSplitBody({
  farmLabel,
  activeFarmKey = null,
  receipts = [],
  overview,
  alarms = [],
  farmKey = null,
  farmOptions = [],
  farmSummaries = [],
  activeFarmLocation = null,
  canEditLocation = false,
  deferAddressFocus = false,
  onCloseMenu,
  onFarmSaved,
}: Props) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const showFarmSwitcher = farmOptions.length > 1;

  const liveStatus = useMemo(() => {
    const valid = receipts.filter((r) => isValidFarmKey(r.farmKey));
    const scoped =
      activeFarmKey != null
        ? valid.find((r) => farmKeyId(r.farmKey) === farmKeyId(activeFarmKey))
        : valid[0];
    const receipt = scoped ?? valid[0];
    if (!receipt) return null;
    return {
      status: receipt.status,
      statusLabel: CONTROLLER_STATUS_LABEL[receipt.status],
      timeLabel: formatKst(receipt.receivedAt, "short"),
    };
  }, [activeFarmKey, receipts]);

  const offline = overview?.offlineCount ?? 0;

  const liveLine = useMemo(() => {
    if (!liveStatus) return null;
    const parts: string[] = [];
    if (liveStatus.status === "offline" && offline > 0) {
      parts.push(`오프라인 ${offline}`);
    } else {
      parts.push(liveStatus.statusLabel);
      if (offline > 0) {
        parts.push(`오프라인 ${offline}`);
      }
    }
    parts.push(liveStatus.timeLabel);
    return parts.join(" · ");
  }, [liveStatus, offline]);

  return (
    <>
      <div className={accountMenuLayout.splitBody} data-tour-id="account-menu-hub">
        <div
          className={accountMenuLayout.zoneContext}
          data-tour-id="account-menu-summary"
        >
          {farmLabel ? (
            showFarmSwitcher ? (
              <button
                type="button"
                className={cn(
                  accountMenuLayout.contextFarmBtn,
                  "inline-flex min-w-0 max-w-full items-center gap-1",
                )}
                aria-expanded={switcherOpen}
                onClick={() => setSwitcherOpen((v) => !v)}
              >
                <span className="min-w-0 break-words">{farmLabel}</span>
                <ChevronDown
                  className={cn(
                    "size-3 shrink-0 text-muted-foreground transition-transform",
                    switcherOpen && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>
            ) : (
              <p className={cn(accountMenuLayout.contextFarm, "break-words")}>
                {farmLabel}
              </p>
            )
          ) : null}

          {switcherOpen && showFarmSwitcher ? (
            <div
              className={accountMenuLayout.switcherInset}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <FarmSwitcher
                farmOptions={farmOptions}
                activeFarmKey={activeFarmKey}
                farmSummaries={farmSummaries}
                compact
                variant="inline"
                inlineListClassName="p-0"
                onNavigated={() => {
                  setSwitcherOpen(false);
                  onCloseMenu?.();
                }}
              />
            </div>
          ) : null}

          {liveLine ? (
            <p className={accountMenuLayout.liveStrip}>
              <span
                className={statusDotClass(liveStatus?.status)}
                aria-hidden
              />
              <span className="min-w-0 break-words">{liveLine}</span>
            </p>
          ) : null}
        </div>

        <div
          className={accountMenuLayout.zoneAction}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <AccountMenuPins
            variant="tile"
            overview={overview}
            alarms={alarms}
            farmKey={farmKey}
            onCloseMenu={onCloseMenu}
          />
        </div>
      </div>

      {activeFarmLocation ? (
        <div
          className={accountMenuLayout.addressRow}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <FarmAddressInput
            key={farmKeyId(activeFarmLocation.farmKey)}
            farmKey={activeFarmLocation.farmKey}
            location={activeFarmLocation.location}
            disabled={!canEditLocation}
            compact
            saveOnly
            deferFocusUntilTap={deferAddressFocus}
            onSaved={onFarmSaved}
          />
        </div>
      ) : null}
    </>
  );
}
