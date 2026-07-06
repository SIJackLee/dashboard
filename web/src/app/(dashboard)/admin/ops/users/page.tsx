import { Suspense } from "react";
import { AdminOpsTabShell } from "@/components/admin/admin-ops-tab-shell";
import { AdminUsersView } from "@/components/admin/admin-users-view";
import { AdminOpsTabContentSkeleton } from "@/components/admin/admin-ops-loading-skeleton";
import { listManagedUsers } from "@/lib/admin/list-users";
import { compareFarmKey, farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import { fetchFarmOverviewRows } from "@/lib/data/iot-live-fetch";
import { farmShortLabel } from "@/lib/data/farm-summaries";

async function UsersTabContent() {
  let users: Awaited<ReturnType<typeof listManagedUsers>> = [];
  let configError = false;
  try {
    users = await listManagedUsers();
  } catch {
    configError = true;
  }

  const overviewRows = await fetchFarmOverviewRows();
  const seen = new Map<string, { farmKey: FarmKey; label: string }>();
  for (const row of overviewRows) {
    const farmKey: FarmKey = {
      lsindRegistNo: row.lsind_regist_no,
      itemCode: row.item_code,
    };
    const id = farmKeyId(farmKey);
    if (!seen.has(id)) {
      seen.set(id, { farmKey, label: farmShortLabel(farmKey) });
    }
  }
  const farmOptions = [...seen.values()].sort((a, b) =>
    compareFarmKey(a.farmKey, b.farmKey),
  );

  return (
    <AdminOpsTabShell>
      {configError ? (
        <p className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.{" "}
          <code>web/.env.local</code>에 service_role 키를 입력해야 사용자
          목록/권한 부여가 동작합니다.
        </p>
      ) : null}
      <AdminUsersView users={users} farmOptions={farmOptions} />
    </AdminOpsTabShell>
  );
}

export default function AdminOpsUsersPage() {
  return (
    <Suspense fallback={<AdminOpsTabContentSkeleton label="사용자" />}>
      <UsersTabContent />
    </Suspense>
  );
}
