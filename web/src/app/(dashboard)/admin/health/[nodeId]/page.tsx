import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import {
  HealthCollectorView,
  HealthNodeDetailView,
} from "@/components/admin/health/health-overview-view";
import {
  fetchHealthSnapshot,
  isKnownHealthNode,
  nodeTitle,
} from "@/lib/admin/health/fetch-snapshot";
import { requireAdmin } from "@/lib/auth/require-admin";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export const revalidate = 300;

const P0_DETAIL_NODES = new Set([
  "collector",
  "collector-rs",
  "storage",
  "dashboard",
]);

const P1_DETAIL_NODES = new Set([
  ...P0_DETAIL_NODES,
  "field-controller",
  "field-module",
  "collector-c",
]);

const P2_DETAIL_NODES = new Set([
  ...P1_DETAIL_NODES,
  "collector-mqtt",
  "collector-ekape",
  "collector-ftp",
  "external",
]);

export default async function AdminHealthNodePage({
  params,
}: {
  params: Promise<{ nodeId: string }>;
}) {
  await requireAdmin();
  const { nodeId } = await params;

  if (!isKnownHealthNode(nodeId)) notFound();

  const snapshot = await fetchHealthSnapshot();
  const title = nodeTitle(nodeId);
  const backHref =
    nodeId === "collector-rs" ? "/admin/health/collector" : "/admin/health";

  return (
    <PageShell title={title}>
      <Link
        href={backHref}
        className={cn(
          "inline-flex items-center text-muted-foreground hover:text-foreground",
          dashboardTypography.meta
        )}
      >
        ← {nodeId === "collector-rs" ? "수집 서버" : "개요"}
      </Link>

      {nodeId === "collector" ? (
        <div className="mt-4">
          <HealthCollectorView snapshot={snapshot} />
        </div>
      ) : P2_DETAIL_NODES.has(nodeId) ? (
        <div className="mt-4">
          <HealthNodeDetailView nodeId={nodeId} snapshot={snapshot} />
        </div>
      ) : (
        <p className={cn("mt-6", dashboardTypography.meta)}>
          {title} 상세를 불러올 수 없습니다. 개요에서 rollup 상태를 확인하세요.
        </p>
      )}
    </PageShell>
  );
}
