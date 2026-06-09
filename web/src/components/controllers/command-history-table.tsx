import { SectionCard } from "@/components/common/section-card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ThermoCommand } from "@/lib/data/commands";

const statusLabel: Record<string, string> = {
  pending: "대기",
  sent: "전송됨",
  failed: "실패",
  cancelled: "취소",
};

const statusVariant = (
  status: string
): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "sent") return "default";
  if (status === "failed") return "destructive";
  if (status === "pending") return "secondary";
  return "outline";
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtCommand(c: ThermoCommand) {
  return `환기 ${c.minVentPct}~${c.maxVentPct}% · ${c.setpointTemp}℃ ±${c.tempDeviation}`;
}

type Props = {
  commands?: ThermoCommand[];
};

export function CommandHistoryTable({ commands = [] }: Props) {
  return (
    <SectionCard title="명령 히스토리">
      {commands.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          등록된 명령이 없습니다.
        </p>
      ) : (
        <Table>
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
                <TableCell className="text-xs">{fmtCommand(c)}</TableCell>
                <TableCell className="text-xs">
                  농장{c.farmUid}/통신박스{c.moduleUid} #{c.ctrlIdx + 1}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(c.status)}>
                    {statusLabel[c.status] ?? c.status}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[8rem] truncate text-xs text-muted-foreground">
                  {c.errorMsg ?? c.note ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  );
}
