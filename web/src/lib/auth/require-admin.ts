import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";

// 관리자 전용 게이트: 미인증→/login, 비-admin→/farm
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/farm");
  return user;
}
