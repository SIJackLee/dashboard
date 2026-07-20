import type { ThermoCommand, ThermoCommandStatus } from "@/lib/data/commands";
import { farmKeyId } from "@/lib/data/farm-key";
import { formatCommandTarget } from "@/lib/ui/controller-labels";
import { commandStatusLabel } from "@/lib/controllers/controller-settings";

/** all | 개별 상태 | other(sent·applied·cancelled) */
export type CommandHistoryStatusFilter =
  | "all"
  | ThermoCommandStatus
  | "other";

const OTHER_STATUSES: ReadonlySet<ThermoCommandStatus> = new Set([
  "sent",
  "applied",
  "cancelled",
]);

export function matchesCommandStatusFilter(
  status: ThermoCommandStatus,
  filter: CommandHistoryStatusFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "other") return OTHER_STATUSES.has(status);
  return status === filter;
}

export function filterThermoCommands(
  commands: ThermoCommand[],
  opts: { query: string; status: CommandHistoryStatusFilter },
): ThermoCommand[] {
  const needle = opts.query.trim().toLowerCase();
  return commands.filter((c) => {
    if (!matchesCommandStatusFilter(c.status, opts.status)) return false;
    if (!needle) return true;
    const hay = [
      formatCommandTarget(c),
      farmKeyId(c.farmKey),
      c.id,
      c.stallNo,
      c.eqpmnNo,
      c.stallTyCode,
      c.controllerKey,
      c.note,
      c.errorMsg,
      commandStatusLabel(c.status),
      String(c.minVentPct),
      String(c.maxVentPct),
      String(c.setpointTemp),
      String(c.tempDeviation),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(needle);
  });
}
