import { AppHeaderAccount } from "@/components/layout/app-header-account";
import { AppHeaderBrand } from "@/components/layout/app-header-brand";
import { AppHeaderNav } from "@/components/layout/app-header-nav";
import { TopBarAlarmSlot } from "@/components/layout/top-bar-alarm-slot";
import { GlobalContextStrip } from "@/components/layout/global-context-strip";
import type { AlarmRow } from "@/lib/data/alarms";
import type { FarmOverview } from "@/lib/data/iot";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";

type Role = "admin" | "operator" | "viewer";

type TopBarProps = {
  overview?: FarmOverview;
  alarms?: AlarmRow[];
  isAdmin?: boolean;
  /** Admin 전국 뷰 — GlobalContextStrip 숨김 */
  hideScopeKpi?: boolean;
  user: {
    displayName: string | null;
    email: string | null;
    role: Role | null;
  };
};

function TopBarDivider() {
  return (
    <div className="hidden h-8 w-px shrink-0 bg-border md:block" aria-hidden />
  );
}

export function TopBar({
  overview,
  alarms = [],
  hideScopeKpi = false,
  user,
}: TopBarProps) {
  return (
    <header className={dashboardUi.topBar}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 md:gap-3">
        <AppHeaderBrand />
        <TopBarDivider />
        <AppHeaderNav role={user.role} />
      </div>

      <GlobalContextStrip
        overview={overview}
        alarmCount={alarms.length}
        hidden={hideScopeKpi}
      />

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 md:gap-3">
        <TopBarAlarmSlot alarms={alarms} />
        <AppHeaderAccount user={user} />
      </div>
    </header>
  );
}
