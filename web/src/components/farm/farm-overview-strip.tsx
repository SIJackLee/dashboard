import type { FarmOverview } from "@/lib/data/iot";
import { RecentActivityList } from "@/components/farm/recent-activity-list";

type Props = {
  overview: FarmOverview;
};

/** /farm 본문 — drill-down 전용 (KPI·환경 평균은 TopBar·패널에만) */
export function FarmOverviewStrip({ overview }: Props) {
  return <RecentActivityList receipts={overview.receipts} variant="compact" />;
}
