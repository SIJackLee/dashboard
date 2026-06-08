import { Download } from "lucide-react";
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

export function LogTable() {
  return (
    <SectionCard
      title="로그 목록"
      action={
        <button className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted">
          <Download className="size-3.5" /> CSV 다운로드
        </button>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>시간</TableHead>
            <TableHead>이벤트 유형</TableHead>
            <TableHead>컨트롤러</TableHead>
            <TableHead>이벤트 내용</TableHead>
            <TableHead>상세 정보</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>사용자/시스템</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 10 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell className="text-muted-foreground">--</TableCell>
              <TableCell>
                <Badge variant="secondary">--</Badge>
              </TableCell>
              <TableCell>--</TableCell>
              <TableCell className="text-muted-foreground">--</TableCell>
              <TableCell className="text-muted-foreground">--</TableCell>
              <TableCell>--</TableCell>
              <TableCell className="text-muted-foreground">--</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionCard>
  );
}
