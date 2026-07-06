import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import type { OpsNotice } from "@/lib/admin/ops-notice";

function SkeletonBone({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/60", className)}
      aria-hidden
    />
  );
}

export function AdminOpsLoadingSkeleton() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-2 md:gap-3"
      aria-busy="true"
      aria-label="운영 페이지 불러오는 중"
    >
      <div className="flex shrink-0 gap-2 border-b pb-1">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonBone key={i} className="h-8 w-20 shrink-0" />
        ))}
      </div>
      <SkeletonBone className="h-24 w-full rounded-xl" />
      <SkeletonBone className="min-h-[12rem] flex-1 rounded-xl" />
    </div>
  );
}

export function AdminOpsNoticeBanner({ notice }: { notice: OpsNotice }) {
  return (
    <p
      className={
        notice.tone === "ok"
          ? "shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800"
          : "shrink-0 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800"
      }
    >
      {notice.text}
    </p>
  );
}

export function AdminOpsTabContentSkeleton({ label }: { label: string }) {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col rounded-xl border bg-muted/20 px-4 py-12 text-center"
      aria-busy="true"
    >
      <p className={cn("text-muted-foreground", dashboardUi.body)}>
        {label} 탭 불러오는 중…
      </p>
    </div>
  );
}
