import { redirect } from "next/navigation";
import { setAdminOpsTabParam } from "@/lib/admin/ops-tabs";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; count?: string }>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) qs.set(key, value);
  }
  setAdminOpsTabParam(qs, "users");
  const q = qs.toString();
  redirect(q ? `/admin/ops?${q}` : "/admin/ops?tab=users");
}
