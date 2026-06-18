import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { HealthFarmDetailView } from "@/components/admin/health/health-farm-detail-view";
import {
  fetchHealthSnapshot,
} from "@/lib/admin/health/fetch-snapshot";
import { requireAdmin } from "@/lib/auth/require-admin";
import { parseFarmKeyUrlSlug } from "@/lib/data/farm-key";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export const revalidate = 300;

export default async function AdminHealthFarmPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  await requireAdmin();
  const { key } = await params;

  if (!parseFarmKeyUrlSlug(key)) notFound();

  const snapshot = await fetchHealthSnapshot();
  const farmKey = parseFarmKeyUrlSlug(key)!;
  const title = `${snapshot.modules.find((m) => m.farmId === `${farmKey.lsindRegistNo}/${farmKey.itemCode}`)?.farmLabel ?? farmKey.lsindRegistNo} · 농장`;

  return (
    <PageShell title={title}>
      <Link
        href="/admin/health"
        className={cn(
          "inline-flex items-center text-muted-foreground hover:text-foreground",
          dashboardTypography.meta
        )}
      >
        ← 개요
      </Link>
      <div className="mt-4">
        <HealthFarmDetailView farmSlug={key} snapshot={snapshot} />
      </div>
    </PageShell>
  );
}
