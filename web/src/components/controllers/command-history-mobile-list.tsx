"use client";

import { Badge } from "@/components/ui/badge";
import { formatKst } from "@/lib/datetime/kst";
import { commandStatusLabel } from "@/lib/controllers/controller-settings";
import type { ThermoCommand } from "@/lib/data/commands";
import {
  formatCommandDetail,
  formatCommandTarget,
} from "@/lib/ui/controller-labels";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

const statusLabel: Record<string, string> = {
  pending: commandStatusLabel("pending"),
  sent: commandStatusLabel("sent"),
  applied: commandStatusLabel("applied"),
  failed: commandStatusLabel("failed"),
  cancelled: commandStatusLabel("cancelled"),
};

const statusVariant = (
  status: string
): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "applied") return "default";
  if (status === "sent") return "secondary";
  if (status === "failed") return "destructive";
  return "outline";
};

function fmtTime(iso: string) {
  return formatKst(iso, "short");
}

function fmtCommand(c: ThermoCommand) {
  return `환기 ${c.minVentPct}~${c.maxVentPct}% · ${c.setpointTemp}℃ +${c.tempDeviation}`;
}

type Props = {
  commands: ThermoCommand[];
};

export function CommandHistoryMobileList({ commands }: Props) {
  return (
    <ul className="space-y-2 md:hidden">
      {commands.map((c) => {
        const detail = formatCommandDetail(c.errorMsg, c.note);
        return (
          <li
            key={c.id}
            className="rounded-xl border bg-card px-3 py-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p className={cn(dashboardTypography.meta, "text-xs text-muted-foreground")}>
                {fmtTime(c.createdAt)}
              </p>
              <Badge variant={statusVariant(c.status)} className="text-xs">
                {statusLabel[c.status] ?? c.status}
              </Badge>
            </div>
            <p className={cn(dashboardTypography.body, "mt-1.5 text-sm font-medium")}>
              {fmtCommand(c)}
            </p>
            <p className={cn(dashboardTypography.meta, "mt-1 text-sm")}>
              {formatCommandTarget(c)}
            </p>
            {detail ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
