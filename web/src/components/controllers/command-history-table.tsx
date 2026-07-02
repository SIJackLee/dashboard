import { HealthSectionCard } from "@/components/admin/health/health-section-card";
import { CommandHistoryMobileList } from "@/components/controllers/command-history-mobile-list";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatKst } from "@/lib/datetime/kst";
import { commandStatusLabel } from "@/lib/controllers/controller-settings";
import type { ThermoCommand } from "@/lib/data/commands";
import {
  formatCommandDetail,
  formatCommandTarget,
} from "@/lib/ui/controller-labels";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
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
  if (status === "pending") return "outline";
  return "outline";
};

function fmtTime(iso: string) {
  return formatKst(iso, "short");
}

function fmtCommand(c: ThermoCommand) {
  return `환기 ${c.minVentPct}~${c.maxVentPct}% · ${c.setpointTemp}℃ +${c.tempDeviation}`;
}

type Props = {
  commands?: ThermoCommand[];
};

export function CommandHistoryTable({ commands = [] }: Props) {
  return (
    <HealthSectionCard
      density="hub"
      title="명령 히스토리"
      className="w-full shrink-0"
    >
      {commands.length === 0 ? (
        <p className={cn("py-6 text-center", dashboardUi.body, "text-muted-foreground")}>
          등록된 명령이 없습니다.
        </p>
      ) : (
        <>
          <CommandHistoryMobileList commands={commands} />
          <div className="hidden md:block">
            <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1">
              <Table className={cn(dashboardUi.body, "min-w-[36rem]")}>
          <TableHeader>
            <TableRow>
              <TableHead>시간</TableHead>
              <TableHead>명령</TableHead>
              <TableHead>대상</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>상세</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {commands.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {fmtTime(c.createdAt)}
                </TableCell>
                <TableCell>{fmtCommand(c)}</TableCell>
                <TableCell>{formatCommandTarget(c)}</TableCell>
                <TableCell>
                  <Badge
                    variant={statusVariant(c.status)}
                    className={dashboardUi.badgeLg}
                  >
                    {statusLabel[c.status] ?? c.status}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[8rem] truncate text-muted-foreground">
                  {formatCommandDetail(c.errorMsg, c.note)}
                </TableCell>
              </TableRow>
            ))}
              </TableBody>
            </Table>
            </div>
          </div>
        </>
      )}
    </HealthSectionCard>
  );
}
