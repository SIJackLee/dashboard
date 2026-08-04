import { AppHeaderAccount } from "@/components/layout/app-header-account";
import { AppHeaderBrand } from "@/components/layout/app-header-brand";
import { HeaderToolsMenu } from "@/components/layout/header-tools-menu";
import type { AlarmRow } from "@/lib/data/alarms";
import type { FarmOverview } from "@/lib/data/iot";
import type { EditableFarmOption } from "@/lib/data/farm-location";
import type { FarmKey } from "@/lib/data/farm-key";
import type { FarmSummaryRow } from "@/lib/data/farm-summaries";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";

type Role = "admin" | "operator" | "viewer";

type TopBarProps = {
  overview?: FarmOverview;
  alarms?: AlarmRow[];
  isAdmin?: boolean;
  farmLocationOptions?: EditableFarmOption[];
  farmOptions?: FarmKey[];
  activeFarmKey?: FarmKey | null;
  farmSummaries?: FarmSummaryRow[];
  canEditLocation?: boolean;
  user: {
    displayName: string | null;
    email: string | null;
    role: Role | null;
  };
};

export function TopBar({
  overview,
  alarms = [],
  farmLocationOptions = [],
  farmOptions = [],
  activeFarmKey = null,
  farmSummaries = [],
  canEditLocation = false,
  user,
}: TopBarProps) {
  const isAdmin = user.role === "admin";

  return (
    <header className={dashboardUi.topBar} data-app-header data-tour-id="app-header">
      <div className="flex w-full min-w-0 items-center gap-1.5 md:gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
          <AppHeaderBrand />
        </div>

        <div className="ml-auto flex shrink-0 items-center justify-end gap-1 md:gap-3">
          <div
            data-tour-id="header-actions"
            className="flex shrink-0 items-center gap-4 md:gap-3"
          >
            <HeaderToolsMenu
              overview={overview}
              alarms={alarms}
              isAdmin={isAdmin}
              farmKey={activeFarmKey}
              variant="header"
            />
            <AppHeaderAccount
              user={user}
              receipts={overview?.receipts}
              farmLocationOptions={farmLocationOptions}
              farmOptions={farmOptions}
              activeFarmKey={activeFarmKey}
              farmSummaries={farmSummaries}
              canEditLocation={canEditLocation}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
