import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";
import { listManagedUsers, type ManagedUser } from "@/lib/admin/list-users";
import { AdminUsersView } from "@/components/admin/admin-users-view";
import { getLiveReadings } from "@/lib/data/iot";
import {
  farmShortLabel,
  uniqueFarmKeysFromReadings,
} from "@/lib/data/farm-summaries";

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
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; count?: string }>;
}) {
  const admin = await requireAdmin();

  const { ok, error, count } = await searchParams;
  let notice = ok ? noticeByCode[ok] : error ? noticeByCode[error] : null;
  if (ok === "bulk_granted" && count) {
    notice = {
      tone: "ok",
      text: `${count}개 농장 권한을 일괄 부여했습니다.`,
    };
  }

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
    <PageShell title="사용자 관리">
      {configError && (
        <p className="rounded-xl bg-amber-50 px-5 py-4 text-[1.75rem] text-amber-800">
          SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다. <code>web/.env.local</code>에
          service_role 키를 입력해야 사용자 목록/권한 부여가 동작합니다.
        </p>
      )}
      {notice && (
        <p
          className={
            notice.tone === "ok"
              ? "rounded-xl bg-emerald-50 px-5 py-4 text-[1.75rem] text-emerald-700"
              : "rounded-xl bg-red-50 px-5 py-4 text-[1.75rem] text-red-700"
          }
        >
          {notice.text}
        </p>
      )}
      <AdminUsersView
        users={users}
        farmOptions={farmOptions}
        currentUserId={admin.id}
      />
    </PageShell>
  );
}
