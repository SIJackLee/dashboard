import { PageShell } from "@/components/layout/page-shell";
import { EmptyState } from "@/components/common/empty-state";

export default function DashboardPage() {
  return (
    <PageShell title="대시보드">
      <EmptyState
        title="대시보드 (구성 예정)"
        description="목업이 없는 통합 대시보드 페이지입니다. 구성안 확정 후 위젯을 배치합니다."
      />
    </PageShell>
  );
}
