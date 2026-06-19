import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export function AdminControllerPlaceholder() {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center",
        dashboardUi.body
      )}
    >
      <p className="font-medium">농장을 선택하세요</p>
      <p className={cn("mt-2 text-muted-foreground", dashboardUi.tableMeta)}>
        전체 농장 모드에서는 좌측 농장목록에서 농장·축사·컨트롤러를 펼친 뒤
        선택하세요.
      </p>
    </div>
  );
}
