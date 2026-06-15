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
import type { ReplayControllerRow } from "@/lib/data/iot-replay";
import type { FarmKey } from "@/lib/data/farm-key";
import {
  REPLAY_EMPTY_HINT,
  REPLAY_PANEL_DESCRIPTION,
  replayPanelTitle,
} from "@/lib/ui/controller-labels";
import { ctrlUi } from "@/lib/ui/controller-page-ui";
import { cn } from "@/lib/utils";

function fmtNum(v: number | null) {
  return v === null ? "--" : v.toFixed(1);
}

export function ReplayHistoryPanel({
  rows,
  controllerKey,
  stallNo,
  eqpmnNo,
}: {
  rows: ReplayControllerRow[];
  farmKey: FarmKey;
  moduleUid: number;
  controllerKey: string;
  stallNo?: string | null;
  eqpmnNo?: string;
}) {
  return (
    <SectionCard
      size="lg"
      title={replayPanelTitle(controllerKey, { stallNo, eqpmnNo })}
      description={REPLAY_PANEL_DESCRIPTION}
      action={
        <Badge variant="outline" className={cn(ctrlUi.badgeLg, "text-amber-700")}>
          연결 복구
        </Badge>
      }
    >
      <Table className={ctrlUi.body}>
        <TableHeader>
          <TableRow>
            <TableHead>측정 시각</TableHead>
            <TableHead>온도 ℃</TableHead>
            <TableHead>습도 %</TableHead>
            <TableHead>수신 시각</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className={cn(
                  "py-6 text-center text-muted-foreground",
                  ctrlUi.body
                )}
              >
                {REPLAY_EMPTY_HINT}
              </TableCell>
            </TableRow>
          ) : (
            rows.slice(0, 20).map((r) => (
              <TableRow key={`${r.decodedId}-${r.mesureDt}`}>
                <TableCell>{r.mesureDt ?? "--"}</TableCell>
                <TableCell>{fmtNum(r.tempC)}</TableCell>
                <TableCell>{fmtNum(r.humidityPct)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatKst(r.receivedAt, "short")}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </SectionCard>
  );
}
