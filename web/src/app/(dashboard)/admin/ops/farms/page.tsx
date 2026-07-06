import { Suspense } from "react";
import { AdminOpsTabShell } from "@/components/admin/admin-ops-tab-shell";
import { AdminFarmLocationPanel } from "@/components/settings/admin-farm-location-panel";
import { AdminOpsTabContentSkeleton } from "@/components/admin/admin-ops-loading-skeleton";
import { getEditableFarmLocationOptions } from "@/lib/data/farm-location";

async function FarmsTabContent() {
  const farmLocationOptions = await getEditableFarmLocationOptions();
  return (
    <AdminOpsTabShell>
      <AdminFarmLocationPanel options={farmLocationOptions} />
    </AdminOpsTabShell>
  );
}

export default function AdminOpsFarmsPage() {
  return (
    <Suspense fallback={<AdminOpsTabContentSkeleton label="농장 위치" />}>
      <FarmsTabContent />
    </Suspense>
  );
}
