"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HealthNodeDetailView } from "@/components/admin/health/health-node-detail-view";
import { healthNodeTitle } from "@/lib/admin/health/health-ui-labels";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  nodeId: string | null;
  snapshot: Parameters<typeof HealthNodeDetailView>[0]["snapshot"];
  onClose: () => void;
};

export function HealthNodeDetailDialog({ nodeId, snapshot, onClose }: Props) {
  const open = Boolean(nodeId);
  const title = nodeId ? healthNodeTitle(nodeId) : "노드 상세";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className={cn(
          "flex max-h-[min(92dvh,85vh)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl",
          "top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2"
        )}
      >
        <DialogHeader className="shrink-0 border-b px-4 py-3">
          <DialogTitle className={cn(dashboardTypography.sectionTitle)}>
            {title}
          </DialogTitle>
          {nodeId ? (
            <DialogDescription className={dashboardTypography.meta}>
              {nodeId} · DAG 노드 상세
            </DialogDescription>
          ) : null}
        </DialogHeader>
        {nodeId ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-2">
            <HealthNodeDetailView
              nodeId={nodeId}
              snapshot={snapshot}
              variant="drawer"
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
