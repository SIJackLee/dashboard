"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import {
  getLiveFarmHubView,
  resolveFarmHubView,
  subscribeLiveFarmHubView,
} from "@/lib/farm/farm-view-url";
import { cn } from "@/lib/utils";

/**
 * 허브 본문은 항상 셸 남은 높이를 쓸 수 있게 flex-1.
 * 차트 탭 overflow-hidden 은 화면 탭 상태(라이브)를 따른다 — URL만 보면
 * 진입 직후 드래그 시 그래프가 내용 높이로 줄어든다.
 */
export function FarmPageViewport({
  children,
  initialView,
}: {
  children: ReactNode;
  initialView?: string | null;
}) {
  const view = useSyncExternalStore(
    subscribeLiveFarmHubView,
    getLiveFarmHubView,
    () => resolveFarmHubView(initialView),
  );
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col space-y-4 md:space-y-5",
        view === "chart" && "overflow-hidden",
      )}
    >
      {children}
    </div>
  );
}
