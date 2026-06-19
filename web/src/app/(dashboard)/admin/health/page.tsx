import { redirect } from "next/navigation";
import { setAdminOpsTabParam } from "@/lib/admin/ops-tabs";

export default async function AdminHealthPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) qs.set(key, value);
  }
  setAdminOpsTabParam(qs, "system");
  const q = qs.toString();
  redirect(q ? `/admin/ops?${q}` : "/admin/ops");
}
