import { AppNavLink } from "@/components/layout/app-nav-link";
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
import { formatKst } from "@/lib/datetime/kst";
import { farmShortLabel } from "@/lib/data/farm-summaries";
import type { LogEvent } from "@/lib/data/iot-replay";

function fmtTime(iso: string) {
  return formatKst(iso, "short");
}

export function LogTable({ events }: { events: LogEvent[] }) {
  return (
    <SectionCard
      title="REPLAY 백필 이력"
      description="통신 재연결 시 이전 구간 데이터가 채워진 기록"
      action={
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted"
          disabled
        >
          <Download className="size-3.5" /> CSV 다운로드
        </button>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>시간</TableHead>
            <TableHead>유형</TableHead>
            <TableHead>농장/모듈</TableHead>
            <TableHead>내용</TableHead>
            <TableHead>상세</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                이벤트 없음
              </TableCell>
            </TableRow>
          ) : (
            events.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-muted-foreground text-xs">
                  {fmtTime(e.occurredAt)}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {e.eventType === "replay_burst" ? "REPLAY" : e.eventType}
                  </Badge>
                </TableCell>
                <TableCell>
                  {farmShortLabel(e.farmKey)} / {e.moduleUid}
                </TableCell>
                <TableCell className="font-medium">{e.title}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {e.linkHref ? (
                    <AppNavLink
                      href={e.linkHref}
                      message="관련 페이지로 이동 중…"
                      className="text-emerald-700 hover:underline"
                    >
                      {e.detail}
                    </AppNavLink>
                  ) : (
                    e.detail
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </SectionCard>
  );
}
