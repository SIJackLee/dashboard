import { redirect } from "next/navigation";

/** 레거시 탭 → 통합 홈 디렉터리 구역 */
export default function AdminOpsUsersRedirectPage() {
  redirect("/admin/ops#directory");
}
