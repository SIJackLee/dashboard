"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  ADMIN_OPS_TABS,
  parseAdminOpsTab,
  type AdminOpsTabId,
} from "@/lib/admin/ops-tabs";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  serverTab: AdminOpsTabId;
  children: ReactNode;
};

function TabSkeleton({ tab }: { tab: AdminOpsTabId }) {
  const label =
    ADMIN_OPS_TABS.find((t) => t.id === tab)?.label ?? "운영";

  return (
    <div
      className="rounded-xl border bg-muted/20 px-4 py-12 text-center"
      aria-busy="true"
    >
      <p className={cn("text-muted-foreground", dashboardUi.body)}>
        {label} 탭 불러오는 중…
      </p>
    </div>
  );
}

export function AdminOpsTabPanel({ serverTab, children }: Props) {
  const searchParams = useSearchParams();
  const clientTab = parseAdminOpsTab(searchParams.get("tab"));

  if (clientTab !== serverTab) {
    return <TabSkeleton tab={clientTab} />;
  }

  return (
    <div
      key={`${serverTab}-${searchParams.get("view") ?? ""}-${searchParams.toString()}`}
      className="flex min-h-0 flex-1 flex-col"
    >
      {children}
    </div>
  );
}
