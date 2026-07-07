import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FarmContentSkeleton } from "@/components/common/loading-skeletons";
import { DashboardMetaShell } from "@/components/layout/dashboard-meta-shell";
import { DashboardViewportShell } from "@/components/layout/dashboard-viewport-shell";
import { FarmScopeProvider } from "@/components/layout/farm-scope-provider";
import { resolveFixedFarmKey } from "@/lib/auth/farm-access";
import { canCommand, getCurrentUser } from "@/lib/auth/get-current-user";
import { getControllerMetas } from "@/lib/data/controller-meta";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (!user.hasAccess) redirect("/pending");

  const controllerMetas = await getControllerMetas();

  return (
    <DashboardMetaShell metas={controllerMetas} canEdit={canCommand(user)}>
      <FarmScopeProvider
        isAdmin={user.isAdmin}
        fixedFarmKey={resolveFixedFarmKey(user)}
      >
        <DashboardViewportShell role={user.role}>
          <Suspense fallback={<FarmContentSkeleton />}>{children}</Suspense>
        </DashboardViewportShell>
      </FarmScopeProvider>
    </DashboardMetaShell>
  );
}
