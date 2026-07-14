import { redirect } from "next/navigation";
import { adminOpsHref } from "@/lib/admin/ops-tabs";
import { requireAdmin } from "@/lib/auth/require-admin";

/** Health UI는 /admin/ops 시스템 탭으로 통합 — 레거시 URL 호환 */
export default async function AdminHealthGroupPage() {
  await requireAdmin();
  redirect(adminOpsHref("system"));
}
