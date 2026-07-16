import { AppHeaderAccount } from "@/components/layout/app-header-account";
import { AppHeaderBrand } from "@/components/layout/app-header-brand";
import { AppHeaderNav } from "@/components/layout/app-header-nav";
import { ConnectivityStatusButton } from "@/components/layout/connectivity-status-button";
import { MobileViewPreviewToggle } from "@/components/layout/mobile-view-preview-toggle";
import { TopBarAlarmSlot } from "@/components/layout/top-bar-alarm-slot";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import type { AlarmRow } from "@/lib/data/alarms";
import type { WeatherWarningRow } from "@/lib/data/weather-warnings";
import type { FarmOverview } from "@/lib/data/iot";
import type { EditableFarmOption } from "@/lib/data/farm-location";
import type { FarmKey } from "@/lib/data/farm-key";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";

type Role = "admin" | "operator" | "viewer";

type TopBarProps = {
  overview?: FarmOverview;
  alarms?: AlarmRow[];
  weatherWarnings?: WeatherWarningRow[];
  isAdmin?: boolean;
  farmLocationOptions?: EditableFarmOption[];
  farmOptions?: FarmKey[];
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
  farmLocationOptions = [],
  farmOptions = [],
  canEditLocation = false,
  user,
}: TopBarProps) {
  const showConnectivity = overview != null;

  return (
    <header className={dashboardUi.topBar} data-app-header>
      <div className="flex w-full min-w-0 items-center gap-1.5 md:gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 md:flex-wrap md:gap-3">
          <AppHeaderBrand />
          {user.role === "admin" ? (
            <>
              <TopBarDivider />
              <AppHeaderNav role={user.role} />
            </>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-1.5 md:gap-3">
          <MobileViewPreviewToggle />
          <ThemeToggle />
          {showConnectivity ? (
            <ConnectivityStatusButton overview={overview} />
          ) : null}
          <TopBarAlarmSlot
            alarms={alarms}
            weatherWarnings={weatherWarnings}
          />
          <AppHeaderAccount
            user={user}
            receipts={overview?.receipts}
            farmLocationOptions={farmLocationOptions}
            farmOptions={farmOptions}
            canEditLocation={canEditLocation}
          />
        </div>
      </div>
    </header>
  );
}
