import { SectionCard } from "@/components/common/section-card";
import { ControllerNameLabel } from "@/components/common/controller-name-label";
import { StatusBadge } from "@/components/common/status-badge";
import { EnvChip } from "@/components/common/env-chip";
import { FanGaugeGroup } from "./fan-gauge-group";
import type { ControllerReading } from "@/lib/data/iot";
import { formatStallTypeLabel } from "@/lib/data/stall-type";
import {
  isDevDiagnosticsEnabled,
  wireDiagnosticsLine,
} from "@/lib/ui/controller-labels";
import { sensorValueForDisplay } from "@/lib/data/reading-display";

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
          label={reading?.label}
          stallNo={reading?.stallNo}
          eqpmnNo={reading?.eqpmnNo}
          controllerKey={reading?.controllerKey}
          idx={reading?.idx}
        />
      </div>
      <FanGaugeGroup reading={reading} />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <EnvChip
          kind="temp"
          value={fmtNum(sensorValueForDisplay(reading?.status, reading?.tempC))}
        />
        <EnvChip
          kind="humidity"
          value={fmtNum(
            sensorValueForDisplay(reading?.status, reading?.humidityPct)
          )}
        />
      </div>
      {(reading?.stallNo || reading?.stallTyCode) && (
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-muted-foreground">축사 번호</dt>
            <dd>{reading?.stallNo ?? "--"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">축사 유형</dt>
            <dd>
              {reading?.stallTyCode
                ? formatStallTypeLabel(reading.stallTyCode)
                : "--"}
            </dd>
          </div>
        </dl>
      )}
      {isDevDiagnosticsEnabled() && reading?.wireVer != null && (
        <p className="mt-2 text-xs text-muted-foreground">
          {wireDiagnosticsLine(reading.wireVer, reading.packetMode)}
        </p>
      )}
    </SectionCard>
  );
}
