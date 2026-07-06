import { redirect } from "next/navigation";
import { adminOpsHref } from "@/lib/admin/ops-tabs";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; count?: string }>;
}) {
  const params = await searchParams;
  redirect(adminOpsHref("users", params));
}
