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

// ctrl_thermo_command 이력 (status: pending/sent/failed/cancelled)
export function CommandHistoryTable() {
  return (
    <SectionCard
      title="명령 히스토리"
      action={
        <button className="text-xs text-muted-foreground hover:text-foreground">
          더보기
        </button>
      }
    >
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
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell className="text-muted-foreground">--:--</TableCell>
              <TableCell>--</TableCell>
              <TableCell>--</TableCell>
              <TableCell>
                <Badge variant="secondary">--</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">--</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionCard>
  );
}
