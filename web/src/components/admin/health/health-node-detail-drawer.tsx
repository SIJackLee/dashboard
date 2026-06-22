"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { HealthNodeDetailView } from "@/components/admin/health/health-node-detail-view";
import { healthNodeTitle } from "@/lib/admin/health/health-ui-labels";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  nodeId: string | null;
  snapshot: Parameters<typeof HealthNodeDetailView>[0]["snapshot"];
  onClose: () => void;
};

export function HealthNodeDetailDrawer({ nodeId, snapshot, onClose }: Props) {
  const open = Boolean(nodeId);
  const title = nodeId ? healthNodeTitle(nodeId) : "노드 상세";

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col overflow-hidden sm:max-w-2xl lg:max-w-3xl"
      >
        <SheetHeader className="shrink-0">
          <SheetTitle className={cn(dashboardTypography.sectionTitle)}>
            {title}
          </SheetTitle>
          {nodeId ? (
            <SheetDescription className={dashboardTypography.meta}>
              {nodeId} · DAG 노드 상세
            </SheetDescription>
          ) : null}
        </SheetHeader>
        {nodeId ? (
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-6">
            <HealthNodeDetailView
              nodeId={nodeId}
              snapshot={snapshot}
              variant="drawer"
            />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
