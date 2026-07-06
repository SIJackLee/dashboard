import { redirect } from "next/navigation";
import { adminOpsHref } from "@/lib/admin/ops-tabs";

export default async function AdminHealthPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  redirect(adminOpsHref("system", params));
}
