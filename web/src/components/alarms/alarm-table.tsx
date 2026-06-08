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

// 온도/습도 임계 초과 파생 알람 중심 (NH3/CO2 제외)
export function AlarmTable() {
  return (
    <SectionCard>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>시간</TableHead>
            <TableHead>축사</TableHead>
            <TableHead>컨트롤러</TableHead>
            <TableHead>알람유형</TableHead>
            <TableHead>심각도</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>상세</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 8 }).map((_, i) => (
            <TableRow key={i} className="cursor-pointer">
              <TableCell className="text-muted-foreground">--</TableCell>
              <TableCell>--</TableCell>
              <TableCell>--</TableCell>
              <TableCell>--</TableCell>
              <TableCell>
                <Badge variant="secondary">--</Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline">--</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">--</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionCard>
  );
}
