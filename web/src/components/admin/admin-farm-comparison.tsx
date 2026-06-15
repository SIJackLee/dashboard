import { AppNavLink } from "@/components/layout/app-nav-link";
import { SectionCard } from "@/components/common/section-card";
import { ReceivedAgoText } from "@/components/common/received-ago-text";
import { HorizontalBarChart } from "@/components/common/horizontal-bar-chart";
import { buildFarmAlarmsHref } from "@/lib/auth/farm-access";
import {
  farmLabel,
  farmShortLabel,
  formatHumidityPct,
  formatTempC,
  type FarmSummaryRow,
} from "@/lib/data/farm-summaries";
import { farmKeyId } from "@/lib/data/farm-key";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function chartBarItemsTopN(
  farms: FarmSummaryRow[],
  pick: (farm: FarmSummaryRow) => number,
  topN = 5
) {
  const sorted = [...farms].sort((a, b) => pick(b) - pick(a));
  const top = sorted.slice(0, topN);
  const rest = sorted.slice(topN);
  const items = top.map((farm) => ({
    label: farmShortLabel(farm.farmKey),
    value: pick(farm),
  }));
  const restSum = rest.reduce((sum, farm) => sum + pick(farm), 0);
  if (rest.length > 0 && restSum > 0) {
    items.push({ label: `기타 ${rest.length}개`, value: restSum });
  }
  return items;
}

export function AdminFarmComparison({ farms }: { farms: FarmSummaryRow[] }) {
  const offlineItems = chartBarItemsTopN(farms, (f) => f.offlineCount);
  const alarmItems = chartBarItemsTopN(farms, (f) => f.alarmCount);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard
          title="농장별 오프라인 컨트롤러"
          description="LIVE 기준 · 농장별 오프라인 대수"
        >
          <HorizontalBarChart
            items={offlineItems}
            unit="대"
            barClassName="bg-red-500"
            emptyLabel="오프라인 컨트롤러 없음"
          />
        </SectionCard>
        <SectionCard
          title="농장별 활성 알람"
          description="LIVE 기준 · 농장별 알람 건수"
        >
          <HorizontalBarChart
            items={alarmItems}
            unit="건"
            barClassName="bg-amber-500"
            emptyLabel="활성 알람 없음"
          />
        </SectionCard>
      </div>

      <SectionCard title="전체 농장 비교" description="클릭 시 해당 농장 알람">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>농장</TableHead>
              <TableHead className="text-right">컨트롤러</TableHead>
              <TableHead className="text-right">오프라인</TableHead>
              <TableHead className="text-right">알람</TableHead>
              <TableHead className="text-right">평균 온도</TableHead>
              <TableHead className="text-right">평균 습도</TableHead>
              <TableHead>최근 수신</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {farms.map((farm) => {
              const href = buildFarmAlarmsHref(farm.farmKey);
              const warn = farm.offlineCount > 0 || farm.alarmCount > 0;
              return (
                <TableRow
                  key={farmKeyId(farm.farmKey)}
                  className={cn(warn && "bg-amber-50/40 dark:bg-amber-950/15")}
                >
                  <TableCell>
                    <AppNavLink
                      href={href}
                      message="알람 페이지로 이동 중…"
                      className={cn("font-medium hover:underline", dashboardUi.body)}
                    >
                      {farmLabel(farm.farmKey)}
                    </AppNavLink>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {farm.controllerCount}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      farm.offlineCount > 0 && "font-semibold text-red-600"
                    )}
                  >
                    {farm.offlineCount}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      farm.alarmCount > 0 && "font-semibold text-amber-700"
                    )}
                  >
                    {farm.alarmCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatTempC(farm.avgTempC)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatHumidityPct(farm.avgHumidityPct)}
                  </TableCell>
                  <TableCell className={dashboardUi.tableMeta}>
                    <ReceivedAgoText iso={farm.latestReceivedAt} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  );
}
