import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { HealthGroupDetailView } from "@/components/admin/health/health-group-detail-view";
import { fetchHealthSnapshot } from "@/lib/admin/health/fetch-snapshot";
import { requireAdmin } from "@/lib/auth/require-admin";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export const revalidate = 300;

export default async function AdminHealthGroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  await requireAdmin();
  const { groupId } = await params;

  const snapshot = await fetchHealthSnapshot();
  const group = snapshot.collectorGroups.find((g) => g.id === groupId);
  if (!group) notFound();

  return (
    <PageShell title={`${group.label} · 수집 그룹`}>
      <div className="flex flex-wrap gap-4">
        <Link
          href="/admin/health"
          className={cn(
            "inline-flex items-center text-muted-foreground hover:text-foreground",
            dashboardTypography.meta
          )}
        >
          ← 개요
        </Link>
        <Link
          href="/admin/health/collector"
          className={cn(
            "inline-flex items-center text-muted-foreground hover:text-foreground",
            dashboardTypography.meta
          )}
        >
          ← 수집 서버
        </Link>
      </div>
      <div className="mt-4">
        <HealthGroupDetailView group={group} snapshot={snapshot} />
      </div>
    </PageShell>
  );
}
