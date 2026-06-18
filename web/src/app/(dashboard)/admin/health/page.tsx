import { PageShell } from "@/components/layout/page-shell";
import { HealthOverviewView } from "@/components/admin/health/health-overview-view";
import { fetchHealthSnapshot } from "@/lib/admin/health/fetch-snapshot";
import { requireAdmin } from "@/lib/auth/require-admin";

export const revalidate = 300;

export default async function AdminHealthPage() {
  await requireAdmin();
  const snapshot = await fetchHealthSnapshot();

  return (
    <PageShell title="시스템 상태">
      <HealthOverviewView snapshot={snapshot} />
    </PageShell>
  );
}
