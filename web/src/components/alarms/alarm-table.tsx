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
import type { AlarmRow } from "@/lib/data/alarms";

export function AlarmTable({ alarms }: { alarms: AlarmRow[] }) {
  return (
    <SectionCard title="알람 목록" description="LIVE readings 기준 파생 (온습도·통신)">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>시간</TableHead>
            <TableHead>축사</TableHead>
            <TableHead>컨트롤러</TableHead>
            <TableHead>알람유형</TableHead>
            <TableHead>심각도</TableHead>
            <TableHead>상세</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alarms.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                활성 알람 없음
              </TableCell>
            </TableRow>
          ) : (
            alarms.map((a) => (
              <TableRow key={a.id} className="cursor-pointer">
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(a.occurredAt).toLocaleString("ko-KR")}
                </TableCell>
                <TableCell>{a.stallNo ?? "--"}</TableCell>
                <TableCell>{a.eqpmnNo}</TableCell>
                <TableCell>{a.alarmType}</TableCell>
                <TableCell>
                  <Badge
                    variant={a.severity === "critical" ? "destructive" : "secondary"}
                  >
                    {a.severity === "critical" ? "심각" : "주의"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{a.detail}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </SectionCard>
  );
}
