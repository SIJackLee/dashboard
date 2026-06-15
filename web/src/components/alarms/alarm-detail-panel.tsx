import Link from "next/link";
import { AppNavLink } from "@/components/layout/app-nav-link";
import { SectionCard } from "@/components/common/section-card";
import { Badge } from "@/components/ui/badge";
import { buildControllerHref } from "@/lib/auth/farm-access";
import { formatControllerSlotLabel } from "@/lib/ui/controller-labels";
import type { AlarmRow } from "@/lib/data/alarms";
import { alarmTargetHref } from "@/lib/data/alarms";
import { formatKst } from "@/lib/datetime/kst";
import { formatStallTypeLabel } from "@/lib/data/stall-type";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export function AlarmDetailPanel({ alarm }: { alarm?: AlarmRow }) {
  if (!alarm) {
    return (
      <SectionCard title="알람 상세">
        <p className={cn("text-muted-foreground", dashboardUi.body)}>
          선택된 알람 없음
        </p>
        <AppNavLink
          href="/settings?tab=alarm"
          message="설정 페이지로 이동 중…"
          className={cn("mt-4 inline-block text-emerald-700", dashboardUi.body)}
        >
          임계값 설정 →
        </AppNavLink>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="알람 상세">
      <dl className={cn("space-y-3", dashboardUi.body)}>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">유형</dt>
          <dd className="font-medium">{alarm.alarmType}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">심각도</dt>
          <dd>
            <Badge
              variant={alarm.severity === "critical" ? "destructive" : "secondary"}
              className={dashboardUi.badgeMd}
            >
              {alarm.severity === "critical" ? "심각" : "주의"}
            </Badge>
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">축사유형</dt>
          <dd>
            {alarm.stallTyCode ? formatStallTypeLabel(alarm.stallTyCode) : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">컨트롤러</dt>
          <dd>
            <AppNavLink
              href={buildControllerHref({
                farmKey: alarm.farmKey,
                sp: alarm.stallTyCode,
                controllerKey: alarm.controllerKey,
              })}
              message="컨트롤러 페이지로 이동 중…"
              className="font-medium text-emerald-700 hover:underline"
            >
              {formatControllerSlotLabel({
                stallNo: alarm.stallNo,
                eqpmnNo: alarm.eqpmnNo,
                idx: alarm.idx,
              })}
            </AppNavLink>
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">발생</dt>
          <dd>{formatKst(alarm.occurredAt, "short")}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">상세</dt>
          <dd className="mt-1">{alarm.detail}</dd>
        </div>
      </dl>
      <div className="mt-5 flex flex-wrap gap-2">
        <AppNavLink
          href={buildControllerHref({
            farmKey: alarm.farmKey,
            sp: alarm.stallTyCode,
            controllerKey: alarm.controllerKey,
          })}
          message="컨트롤러 페이지로 이동 중…"
          className={cn(
            "inline-flex items-center rounded-lg border border-emerald-600/30 bg-emerald-50 px-4 py-2 text-emerald-800 hover:bg-emerald-100",
            dashboardUi.btnSmAction
          )}
        >
          컨트롤러 제어
        </AppNavLink>
        <Link
          href={alarmTargetHref(alarm)}
          className={cn(
            "inline-flex items-center rounded-lg border px-4 py-2 hover:bg-muted",
            dashboardUi.btnSmAction
          )}
        >
          목록에서 보기
        </Link>
        <AppNavLink
          href="/settings?tab=alarm"
          message="설정 페이지로 이동 중…"
          className={cn(
            "inline-flex items-center rounded-lg border px-4 py-2 hover:bg-muted",
            dashboardUi.btnSmAction
          )}
        >
          임계값 설정
        </AppNavLink>
      </div>
    </SectionCard>
  );
}
