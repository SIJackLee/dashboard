import { TopBar } from "./top-bar";
import { getAdminOpsShellContext } from "@/lib/data/admin-ops-shell-data";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
};

/** 운영(/admin/ops) 전용 — TopBar overview만, LIVE farm-scoped 병렬 조회 없음 */
export async function AdminOpsPageShell({ children }: Props) {
  const [ctx, user] = await Promise.all([
    getAdminOpsShellContext(),
    getCurrentUser(),
  ]);

  return (
    <>
      <TopBar
        overview={ctx.overview}
        alarms={[]}
        weatherWarnings={[]}
        farmLocationOptions={[]}
        canEditLocation={false}
        user={{
          displayName: user?.displayName ?? null,
          email: user?.email ?? null,
          role: user?.role ?? null,
        }}
      />
      <main
        className={cn(
          dashboardUi.mainPadWide,
          "flex min-h-0 min-w-0 flex-col",
        )}
      >
        <div
          className={cn(
            dashboardUi.pageStackWide,
            "flex min-h-0 min-w-0 flex-1 flex-col",
          )}
        >
          {children}
        </div>
      </main>
    </>
  );
}
