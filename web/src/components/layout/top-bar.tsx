import { LogOut } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { TopBarAlarmSlot } from "@/components/layout/top-bar-alarm-slot";
import { GlobalContextStrip } from "@/components/layout/global-context-strip";
import { FarmSwitcher } from "@/components/layout/farm-switcher";
import type { AlarmRow } from "@/lib/data/alarms";
import type { FarmKey } from "@/lib/data/farm-key";
import type { FarmSummaryRow } from "@/lib/data/farm-summaries";
import type { FarmOverview } from "@/lib/data/iot";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type TopBarProps = {
  title: string;
  overview?: FarmOverview;
  alarms?: AlarmRow[];
  isAdmin?: boolean;
  farmOptions?: FarmKey[];
  activeFarmKey?: FarmKey | null;
  farmSummaries?: FarmSummaryRow[];
};

export function TopBar({
  title,
  overview,
  alarms = [],
  isAdmin = false,
  farmOptions = [],
  activeFarmKey = null,
  farmSummaries = [],
}: TopBarProps) {
  const showFarmSwitcher = isAdmin && farmOptions.length > 0;

  return (
    <header className={cn(dashboardUi.topBar, "gap-3 md:gap-4")}>
      <div className="flex min-w-0 shrink-0 flex-col gap-2">
        <h1
          className={cn(
            dashboardUi.pageTitle,
            "max-w-[12rem] truncate md:max-w-none"
          )}
        >
          {title}
        </h1>
        {showFarmSwitcher ? (
          <FarmSwitcher
            farmOptions={farmOptions}
            activeFarmKey={activeFarmKey}
            farmSummaries={farmSummaries}
          />
        ) : null}
      </div>

      <GlobalContextStrip overview={overview} alarmCount={alarms.length} />

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 md:gap-3">
        <TopBarAlarmSlot alarms={alarms} />
        <form action={signOut}>
          <button type="submit" className={dashboardUi.topLogoutBtn}>
            <LogOut className={dashboardUi.topLogoutIcon} />
            <span className="hidden sm:inline">로그아웃</span>
          </button>
        </form>
      </div>
    </header>
  );
}
