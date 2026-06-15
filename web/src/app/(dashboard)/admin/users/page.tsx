import { PageShell } from "@/components/layout/page-shell";
import { requireAdmin } from "@/lib/auth/require-admin";
import { listManagedUsers, type ManagedUser } from "@/lib/admin/list-users";
import { AdminUsersView } from "@/components/admin/admin-users-view";

const noticeByCode: Record<string, { tone: "ok" | "error"; text: string }> = {
  granted: { tone: "ok", text: "권한을 부여했습니다." },
  revoked: { tone: "ok", text: "권한을 회수했습니다." },
  notfound: { tone: "error", text: "해당 이메일의 가입자를 찾을 수 없습니다." },
  invalid: { tone: "error", text: "입력값이 올바르지 않습니다." },
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdmin();

  const { ok, error } = await searchParams;
  const notice = ok ? noticeByCode[ok] : error ? noticeByCode[error] : null;

  let users: ManagedUser[] = [];
  let configError = false;
  try {
    users = await listManagedUsers();
  } catch {
    configError = true;
  }

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
      <AdminUsersView users={users} />
    </PageShell>
  );
}
