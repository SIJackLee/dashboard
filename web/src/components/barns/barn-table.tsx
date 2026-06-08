import { ChevronRight, RefreshCw } from "lucide-react";
import { SectionCard } from "@/components/common/section-card";
import { SimpleSelect } from "@/components/common/filter-bar";
import { StatusBadge } from "@/components/common/status-badge";
import { EnvChip } from "@/components/common/env-chip";
import { FanIndicator } from "@/components/common/fan-indicator";
import type { BarnReading } from "@/lib/data/iot";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  return d.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
}

const fmtNum = (v: number | null, digits = 1) =>
  v === null ? "--" : v.toFixed(digits);

// 평균 환경: 온도/습도 + 3팬(%) — NH3/CO2 제외
// 축사 지정 메타데이터 도입 전까지 컨트롤러(idx) 단위로 표시.
export function BarnTable({ rows = [] }: { rows?: BarnReading[] }) {
  return (
    <SectionCard
      title="축사 목록"
      description="축사 지정 전까지 컨트롤러 단위로 표시"
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
            <TableHead>컨트롤러</TableHead>
            <TableHead>통신 상태</TableHead>
            <TableHead>온도</TableHead>
            <TableHead>습도</TableHead>
            <TableHead>송풍/배기/입기 (%)</TableHead>
            <TableHead>모듈</TableHead>
            <TableHead>최근 업데이트</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={8}
                className="py-10 text-center text-sm text-muted-foreground"
              >
                표시할 데이터가 없습니다. (접근 권한 또는 수집 데이터를 확인하세요)
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell className="font-medium">{r.label}</TableCell>
                <TableCell>
                  <StatusBadge tone={r.status} />
                </TableCell>
                <TableCell>
                  <EnvChip kind="temp" value={fmtNum(r.tempC)} />
                </TableCell>
                <TableCell>
                  <EnvChip kind="humidity" value={fmtNum(r.humidityPct)} />
                </TableCell>
                <TableCell>
                  <div className="flex gap-3">
                    <FanIndicator kind="supply" value={r.fanSupply} compact />
                    <FanIndicator kind="exhaust" value={r.fanExhaust} compact />
                    <FanIndicator kind="intake" value={r.fanIntake} compact />
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  농장 {r.farmUid} · 모듈 {r.moduleUid}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {fmtTime(r.receivedAt)}
                </TableCell>
                <TableCell>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </SectionCard>
  );
}
