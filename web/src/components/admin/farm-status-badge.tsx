import { StatusBadge } from "@/components/common/status-badge";
import type { FarmSummaryRow } from "@/lib/data/farm-summaries";
import { farmSummaryStatus } from "@/lib/ui/status-tone";

export function FarmStatusBadge({ farm }: { farm: FarmSummaryRow }) {
  const { tone, label } = farmSummaryStatus(farm);
  return <StatusBadge tone={tone} label={label} />;
}
