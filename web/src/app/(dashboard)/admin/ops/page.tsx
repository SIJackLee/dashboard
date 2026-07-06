import { Suspense } from "react";
import { HealthSystemShell } from "@/components/admin/health/health-system-shell";
import { AdminOpsTabContentSkeleton } from "@/components/admin/admin-ops-loading-skeleton";
import { fetchHealthSnapshot } from "@/lib/admin/health/fetch-snapshot";

async function SystemTabContent() {
  const snapshot = await fetchHealthSnapshot();
  return <HealthSystemShell snapshot={snapshot} />;
}

export default function AdminOpsSystemPage() {
  return (
    <Suspense
      fallback={<AdminOpsTabContentSkeleton label="시스템" />}
    >
      <SystemTabContent />
    </Suspense>
  );
}
