import { AppHeaderAccount } from "@/components/layout/app-header-account";
import { AppHeaderBrand } from "@/components/layout/app-header-brand";
import { AppHeaderNav } from "@/components/layout/app-header-nav";
import { TopBarAlarmSlot } from "@/components/layout/top-bar-alarm-slot";
import { GlobalContextStrip } from "@/components/layout/global-context-strip";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import type { AlarmRow } from "@/lib/data/alarms";
import type { WeatherWarningRow } from "@/lib/data/weather-warnings";
import type { FarmOverview } from "@/lib/data/iot";
import type { EditableFarmOption } from "@/lib/data/farm-location";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";

type Role = "admin" | "operator" | "viewer";

type TopBarProps = {
  overview?: FarmOverview;
  alarms?: AlarmRow[];
  weatherWarnings?: WeatherWarningRow[];
  isAdmin?: boolean;
  /** Admin 전국 뷰 — 데스크톱 GlobalContextStrip 숨김 */
  hideScopeKpi?: boolean;
  farmLocationOptions?: EditableFarmOption[];
  canEditLocation?: boolean;
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
  weatherWarnings = [],
  hideScopeKpi = false,
  farmLocationOptions = [],
  canEditLocation = false,
  user,
}: TopBarProps) {
  const showMobileKpi = overview != null;

  return (
    <header className={dashboardUi.topBar}>
      <div className="flex w-full min-w-0 items-center gap-1.5 md:gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 md:flex-wrap md:gap-3">
          <AppHeaderBrand />
          <TopBarDivider />
          <AppHeaderNav role={user.role} />
        </div>

        {showMobileKpi ? (
          <div className="ml-auto shrink-0 overflow-visible max-lg:block lg:hidden">
            <GlobalContextStrip overview={overview} headerInline />
          </div>
        ) : null}

        <div className="hidden min-w-0 flex-1 lg:flex">
          <GlobalContextStrip
            overview={overview}
            alarmCount={alarms.length + weatherWarnings.length}
            hidden={hideScopeKpi}
            compact={hideScopeKpi}
          />
        </div>

        <div className="flex shrink-0 items-center justify-end gap-1.5 md:gap-3">
          <ThemeToggle />
          <TopBarAlarmSlot
            alarms={alarms}
            weatherWarnings={weatherWarnings}
          />
          <AppHeaderAccount
            user={user}
            receipts={overview?.receipts}
            farmLocationOptions={farmLocationOptions}
            canEditLocation={canEditLocation}
          />
        </div>
      </div>
    </header>
  );
}
