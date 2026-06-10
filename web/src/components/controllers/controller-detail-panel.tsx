import { SectionCard } from "@/components/common/section-card";
import { ControllerNameLabel } from "@/components/common/controller-name-label";
import { StatusBadge } from "@/components/common/status-badge";
import { EnvChip } from "@/components/common/env-chip";
import { FanGaugeGroup } from "./fan-gauge-group";
import type { ControllerReading } from "@/lib/data/iot";

const fmtNum = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined ? "--" : v.toFixed(digits);

export function ControllerDetailPanel({
  reading,
}: {
  reading?: ControllerReading;
}) {
  return (
    <SectionCard
      title="선택된 컨트롤러"
      action={
        reading ? (
          <StatusBadge tone={reading.status} />
        ) : (
          <StatusBadge tone="offline" label="--" />
        )
      }
    >
      <div className="mb-4">
        <ControllerNameLabel
          className="text-lg"
          eqpmnNo={reading?.eqpmnNo}
          idx={reading?.idx}
        />
      </div>
      <FanGaugeGroup reading={reading} />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <EnvChip kind="temp" value={fmtNum(reading?.tempC)} />
        <EnvChip kind="humidity" value={fmtNum(reading?.humidityPct)} />
      </div>
      {(reading?.stallNo || reading?.stallTyCode) && (
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-muted-foreground">stallNo</dt>
            <dd>{reading?.stallNo ?? "--"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">stallTyCode</dt>
            <dd>{reading?.stallTyCode ?? "--"}</dd>
          </div>
        </dl>
      )}
      {reading?.wireVer != null && (
        <p className="mt-2 text-xs text-muted-foreground">
          wire 0x{reading.wireVer.toString(16)} · {reading.packetMode}
        </p>
      )}
    </SectionCard>
  );
}
