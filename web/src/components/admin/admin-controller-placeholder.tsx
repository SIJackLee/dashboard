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
        전체 농장 모드에서는 상단 Pill 또는 이상 농장 바로가기를 눌러 컨트롤러를
        제어합니다.
      </p>
    </div>
  );
}
