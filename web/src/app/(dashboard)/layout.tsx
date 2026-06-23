import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { DashboardMetaShell } from "@/components/layout/dashboard-meta-shell";
import { NavigationPendingProvider } from "@/components/layout/navigation-pending-provider";
import { FarmScopeProvider } from "@/components/layout/farm-scope-provider";
import { DisplaySettingsProvider } from "@/components/display/display-settings-provider";
import { resolveFixedFarmKey } from "@/lib/auth/farm-access";
import { canCommand, getCurrentUser } from "@/lib/auth/get-current-user";
import { getControllerMetas } from "@/lib/data/controller-meta";
import { getDisplaySettings } from "@/lib/data/display-settings";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (!user.hasAccess) redirect("/pending");

  const [displaySettings, controllerMetas] = await Promise.all([
    getDisplaySettings(),
    getControllerMetas(),
  ]);

  return (
    <DisplaySettingsProvider settings={displaySettings}>
      <DashboardMetaShell
        metas={controllerMetas}
        canEdit={canCommand(user)}
      >
        <FarmScopeProvider
          isAdmin={user.isAdmin}
          fixedFarmKey={resolveFixedFarmKey(user)}
        >
          <NavigationPendingProvider>
            <div className="flex h-screen flex-col overflow-hidden">
              <Suspense fallback={null}>{children}</Suspense>
              <Suspense fallback={null}>
                <MobileBottomNav role={user.role} />
              </Suspense>
            </div>
          </NavigationPendingProvider>
        </FarmScopeProvider>
      </DashboardMetaShell>
    </DisplaySettingsProvider>
  );
}
