import { AppNavLink } from "@/components/layout/app-nav-link";
import { SectionCard } from "@/components/common/section-card";
import { Badge } from "@/components/ui/badge";
import { formatKst } from "@/lib/datetime/kst";
import type { LiveSummary } from "@/lib/data/iot-live";
import {
  isDevDiagnosticsEnabled,
  liveSummaryBadge,
} from "@/lib/ui/controller-labels";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

function fmtTime(iso: string | null) {
  return formatKst(iso, "short");
}

/** 프로토콜·수신 메타만 표시. 농장 KPI는 /farm 페이지 참조 */
export function LiveSummaryPanel({ summary }: { summary?: LiveSummary }) {
  const head = summary?.modules[0];

  return (
    <SectionCard
      title="LIVE 수신 메타"
      action={
        <Badge
          variant={head?.wireVer != null ? "default" : "outline"}
          className={dashboardUi.badgeMd}
        >
          {liveSummaryBadge(head?.wireVer)}
        </Badge>
      }
    >
      <dl className={cn("space-y-3", dashboardUi.body)}>
        {isDevDiagnosticsEnabled() && (
          <>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">프로토콜 버전</dt>
              <dd>
                {head?.wireVer != null
                  ? `0x${head.wireVer.toString(16)}`
                  : "--"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">LUT 버전</dt>
              <dd>{head?.lutVer ?? "--"}</dd>
            </div>
          </>
        )}
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">최신 mesure_dt</dt>
          <dd className="text-right">{fmtTime(head?.mesureDt ?? null)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">최신 수신</dt>
          <dd className="text-right">{fmtTime(head?.receivedAt ?? null)}</dd>
        </div>
      </dl>
      <p className={cn("mt-4", dashboardUi.tableMeta)}>
        농장 수·통신박스·컨트롤러 집계는{" "}
        <AppNavLink
          href="/farm"
          message="농장 현황으로 이동 중…"
          className="font-medium text-emerald-700 hover:underline"
        >
          농장 현황
        </AppNavLink>
        에서 확인하세요. 통신 재연결 시 이전 구간 데이터가 채워집니다.
      </p>
    </SectionCard>
  );
}
