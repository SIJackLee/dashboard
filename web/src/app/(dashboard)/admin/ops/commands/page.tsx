import { redirect } from "next/navigation";

/** 레거시 탭 → 통합 홈 명령 구역 */
export default function AdminOpsCommandsRedirectPage() {
  redirect("/admin/ops#commands");
}
