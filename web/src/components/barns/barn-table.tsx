import { ChevronRight, RefreshCw } from "lucide-react";
import { SectionCard } from "@/components/common/section-card";
import { SimpleSelect } from "@/components/common/filter-bar";
import { StatusBadge } from "@/components/common/status-badge";
import { EnvChip } from "@/components/common/env-chip";
import { FanIndicator } from "@/components/common/fan-indicator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// 평균 환경: 온도/습도 + 3팬(%) — NH3/CO2 제외
export function BarnTable() {
  return (
    <SectionCard
      title="축사 목록"
      action={
        <div className="flex items-center gap-2">
          <SimpleSelect placeholder="전체 농장" />
          <button className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted">
            <RefreshCw className="size-3.5" /> 새로고침
          </button>
        </div>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>축사명</TableHead>
            <TableHead>통신 상태</TableHead>
            <TableHead>온도</TableHead>
            <TableHead>습도</TableHead>
            <TableHead>송풍/배기/입기 (%)</TableHead>
            <TableHead>컨트롤러</TableHead>
            <TableHead>최근 업데이트</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 4 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell className="font-medium">축사 {i + 1}</TableCell>
              <TableCell>
                <StatusBadge tone="offline" label="--" />
              </TableCell>
              <TableCell>
                <EnvChip kind="temp" />
              </TableCell>
              <TableCell>
                <EnvChip kind="humidity" />
              </TableCell>
              <TableCell>
                <div className="flex gap-3">
                  <FanIndicator kind="supply" compact />
                  <FanIndicator kind="exhaust" compact />
                  <FanIndicator kind="intake" compact />
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">-- 대</TableCell>
              <TableCell className="text-muted-foreground">--:--</TableCell>
              <TableCell>
                <ChevronRight className="size-4 text-muted-foreground" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionCard>
  );
}
