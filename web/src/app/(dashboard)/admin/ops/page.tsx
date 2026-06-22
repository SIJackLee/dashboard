import type { ReactNode } from "react";
import { Suspense } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { AdminOpsTabPanel } from "@/components/admin/admin-ops-tab-panel";
import { AdminOpsTabShell } from "@/components/admin/admin-ops-tab-shell";
import { AdminOpsTabs } from "@/components/admin/admin-ops-tabs";
import { AdminUsersView } from "@/components/admin/admin-users-view";
import { HealthSystemShell } from "@/components/admin/health/health-system-shell";
import { AdminFarmLocationPanel } from "@/components/settings/admin-farm-location-panel";
import { DisplaySettingsForm } from "@/components/settings/display-settings-form";
import { CommandHistoryTable } from "@/components/controllers/command-history-table";
import { listManagedUsers, type ManagedUser } from "@/lib/admin/list-users";
import { getThermoCommandHistory } from "@/lib/data/commands";
import { parseAdminOpsTab } from "@/lib/admin/ops-tabs";
import { fetchHealthSnapshot } from "@/lib/admin/health/fetch-snapshot";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getDisplaySettings } from "@/lib/data/display-settings";
import { getEditableFarmLocationOptions } from "@/lib/data/farm-location";
import { getLiveReadings } from "@/lib/data/iot";
import {
  farmShortLabel,
  uniqueFarmKeysFromReadings,
} from "@/lib/data/farm-summaries";

export const revalidate = 300;

const noticeByCode: Record<string, { tone: "ok" | "error"; text: string }> = {
  granted: { tone: "ok", text: "권한을 부여했습니다." },
  bulk_granted: { tone: "ok", text: "농장 권한을 일괄 부여했습니다." },
  revoked: { tone: "ok", text: "권한을 회수했습니다." },
  role_updated: { tone: "ok", text: "역할을 변경했습니다." },
  notfound: { tone: "error", text: "해당 이메일의 가입자를 찾을 수 없습니다." },
  invalid: { tone: "error", text: "입력값이 올바르지 않습니다." },
  forbidden: { tone: "error", text: "관리자 권한이 필요합니다." },
  self_demote: {
    tone: "error",
    text: "본인 계정의 관리자 역할은 해제할 수 없습니다.",
  },
  saved: { tone: "ok", text: "저장했습니다." },
  save: { tone: "error", text: "저장에 실패했습니다. 권한을 확인하세요." },
};

export default async function AdminOpsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    view?: string;
    ok?: string;
    error?: string;
    count?: string;
  }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const tab = parseAdminOpsTab(params.tab);
  const { ok, error, count } = params;

  let notice = ok ? noticeByCode[ok] : error ? noticeByCode[error] : null;
  if (ok === "bulk_granted" && count) {
    notice = {
      tone: "ok",
      text: `${count}개 농장 권한을 일괄 부여했습니다.`,
    };
  }

  const pageBody = (content: ReactNode) => (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Suspense fallback={null}>
        <AdminOpsTabs active={tab} />
      </Suspense>
      {notice ? (
        <p
          className={
            notice.tone === "ok"
              ? "shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800"
              : "shrink-0 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800"
          }
        >
          {notice.text}
        </p>
      ) : null}
      <Suspense fallback={null}>
        <AdminOpsTabPanel serverTab={tab}>{content}</AdminOpsTabPanel>
      </Suspense>
    </div>
  );

  if (tab === "users") {
    let users: ManagedUser[] = [];
    let configError = false;
    try {
      users = await listManagedUsers();
    } catch {
      configError = true;
    }

    const readings = await getLiveReadings();
    const farmOptions = uniqueFarmKeysFromReadings(readings).map((farmKey) => ({
      farmKey,
      label: farmShortLabel(farmKey),
    }));

    return (
      <PageShell wide>
        {pageBody(
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
        )}
      </PageShell>
    );
  }

  if (tab === "farms") {
    const farmLocationOptions = await getEditableFarmLocationOptions();

    return (
      <PageShell wide>
        {pageBody(
          <AdminOpsTabShell>
            <Suspense fallback={null}>
              <AdminFarmLocationPanel options={farmLocationOptions} />
            </Suspense>
          </AdminOpsTabShell>
        )}
      </PageShell>
    );
  }

  if (tab === "display") {
    const displaySettings = await getDisplaySettings();

    return (
      <PageShell wide>
        {pageBody(
          <AdminOpsTabShell>
            <DisplaySettingsForm initialSettings={displaySettings} />
          </AdminOpsTabShell>
        )}
      </PageShell>
    );
  }

  if (tab === "commands") {
    const commands = await getThermoCommandHistory(100);

    return (
      <PageShell wide>
        {pageBody(
          <AdminOpsTabShell>
            <CommandHistoryTable commands={commands} />
          </AdminOpsTabShell>
        )}
      </PageShell>
    );
  }

  const snapshot = await fetchHealthSnapshot();

  return (
    <PageShell wide>
      {pageBody(<HealthSystemShell snapshot={snapshot} />)}
    </PageShell>
  );
}
