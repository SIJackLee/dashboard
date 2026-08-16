"use client";

import type { ReactNode } from "react";
import { HealthNodeInspector } from "@/components/admin/health/health-node-inspector";
import {
  OpsInspectorProvider,
  useOpsInspector,
} from "@/components/admin/ops-inspector-context";
import { opsLayout } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { useMobileLayout } from "@/lib/ui/use-mobile-layout";
import { cn } from "@/lib/utils";

function OpsInspectorFrameInner({ children }: { children: ReactNode }) {
  const isMobileLayout = useMobileLayout();
  const { nodeId, snapshot, close } = useOpsInspector();
  const open = nodeId != null && snapshot != null && !isMobileLayout;

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-6",
          opsLayout.stack,
        )}
      >
        {children}
      </div>
      <div
        className={cn(
          "hidden h-full min-h-0 shrink-0 overflow-hidden md:block",
          motionClass.transitionLayout,
          open ? "w-[min(26rem,36vw)]" : "w-0",
        )}
      >
        {snapshot ? (
          <HealthNodeInspector
            nodeId={nodeId}
            snapshot={snapshot}
            placement="page"
            onClose={close}
          />
        ) : null}
      </div>
    </div>
  );
}

export function OpsInspectorFrame({ children }: { children: ReactNode }) {
  return (
    <OpsInspectorProvider>
      <OpsInspectorFrameInner>{children}</OpsInspectorFrameInner>
    </OpsInspectorProvider>
  );
}
