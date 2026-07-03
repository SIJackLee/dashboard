"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  parseMonitoringTab,
  type MonitoringTabId,
} from "@/lib/monitoring/monitoring-tabs";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  /** 서버 RSC가 렌더한 탭 */
  serverTab: MonitoringTabId;
  children: ReactNode;
};

function TabSkeleton({ tab }: { tab: MonitoringTabId }) {
  const label =
    tab === "map" ? "현황" : "컨트롤러";

  return (
    <div
      className="rounded-xl border bg-muted/20 px-4 py-12 text-center"
      aria-busy="true"
      aria-live="polite"
    >
      <p className={cn("text-muted-foreground", dashboardUi.body)}>
        {label} 탭 불러오는 중…
      </p>
    </div>
  );
}

/**
 * soft navigation 중 클라이언트 URL(tab)과 서버 RSC(tab) 불일치 시
 * 이전 탭 콘텐츠(그리드·장비·이상)가 잠깐 보이는 현상 방지.
 */
export function MonitoringTabPanel({ serverTab, children }: Props) {
  const searchParams = useSearchParams();
  const clientTab = parseMonitoringTab(searchParams.get("tab"));

  if (clientTab !== serverTab) {
    return <TabSkeleton tab={clientTab} />;
  }

  return (
    <div key={serverTab}>{children}</div>
  );
}
