import type { ReactNode } from "react";
import { Suspense } from "react";
import { AdminOpsPageShell } from "@/components/layout/admin-ops-page-shell";
import { AdminOpsNoticeFromUrl } from "@/components/admin/admin-ops-notice-from-url";
import { requireAdmin } from "@/lib/auth/require-admin";

export const revalidate = 300;

export default async function AdminOpsLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdmin();

  return (
    <AdminOpsPageShell>
      <div className="flex min-h-0 flex-1 flex-col gap-2 md:gap-3">
        <Suspense fallback={null}>
          <AdminOpsNoticeFromUrl />
        </Suspense>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </AdminOpsPageShell>
  );
}
