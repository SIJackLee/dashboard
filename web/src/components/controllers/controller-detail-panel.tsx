import { SectionCard } from "@/components/common/section-card";
import { ControllerNameLabel } from "@/components/common/controller-name-label";
import { StatusBadge } from "@/components/common/status-badge";
import { EnvChip } from "@/components/common/env-chip";
import { FanGaugeGroup } from "./fan-gauge-group";

export function ControllerDetailPanel() {
  return (
    <SectionCard
      title="선택된 컨트롤러"
      action={<StatusBadge tone="offline" label="--" />}
    >
      <div className="mb-4">
        <ControllerNameLabel className="text-lg" />
      </div>
      <FanGaugeGroup />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <EnvChip kind="temp" />
        <EnvChip kind="humidity" />
      </div>
    </SectionCard>
  );
}
