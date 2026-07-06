"use client";

import { useSearchParams } from "next/navigation";
import { AdminOpsNoticeBanner } from "@/components/admin/admin-ops-loading-skeleton";
import { resolveOpsNotice } from "@/lib/admin/ops-notice";

export function AdminOpsNoticeFromUrl() {
  const searchParams = useSearchParams();
  const notice = resolveOpsNotice({
    ok: searchParams.get("ok") ?? undefined,
    error: searchParams.get("error") ?? undefined,
    count: searchParams.get("count") ?? undefined,
  });
  if (!notice) return null;
  return <AdminOpsNoticeBanner notice={notice} />;
}
