"use client";

import { useTransition } from "react";
import { acknowledgeCommandHealthCheckpoint } from "@/app/(dashboard)/admin/ops/health-actions";
import { HealthStatusBadge } from "@/components/admin/health/health-status-badge";
import type { CommandFailureItem } from "@/lib/admin/health/types";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type HealthCommandFailurePanelProps = {
  failures: CommandFailureItem[];
  checkpointCount: number;
  compact?: boolean;
};

export function HealthCommandFailurePanel({
  failures,
  checkpointCount,
  compact = false,
}: HealthCommandFailurePanelProps) {
  const [pending, startTransition] = useTransition();

  if (failures.length === 0 && checkpointCount === 0) {
    return (
      <p className={dashboardTypography.meta}>
        {compact ? "실패 없음" : "활성 C 실패 이력 없음 (24h 기준)"}
      </p>
    );
  }

  if (compact) {
    return (
      <div className="space-y-1">
        {checkpointCount > 0 ? (
          <p className={dashboardTypography.meta}>무시 {checkpointCount}건</p>
        ) : null}
        {failures.length === 0 ? (
          <p className={cn(dashboardTypography.meta, "text-emerald-700")}>
            미체크 없음
          </p>
        ) : (
          <ul className="space-y-0.5">
            {failures.slice(0, 5).map((f) => (
              <li key={f.commandId} className="flex items-center gap-1.5">
                <span className={cn(dashboardTypography.meta, "min-w-0 flex-1 truncate")}>
                  {f.farmLabel}
                  {f.reason ? ` · ${f.reason}` : ""}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {f.ageSec < 60
                    ? `${Math.round(f.ageSec)}초`
                    : `${Math.round(f.ageSec / 60)}분`}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  className="shrink-0 rounded border px-1.5 py-0.5 text-muted-foreground hover:bg-muted disabled:opacity-50"
                  onClick={() => {
                    startTransition(async () => {
                      await acknowledgeCommandHealthCheckpoint(f.commandId);
                    });
                  }}
                >
                  무시
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className={dashboardTypography.meta}>
        C downlink 실패는 COL uplink rollup에 포함되지 않습니다. 검토한 항목은
        체크포인트로 무시(S4·C 상태에서 제외)됩니다.
        {checkpointCount > 0 ? ` · 무시 중 ${checkpointCount}건` : ""}
      </p>

      {failures.length === 0 ? (
        <p className={cn(dashboardTypography.body, "text-emerald-700")}>
          미체크 실패 없음 — 체크포인트만 {checkpointCount}건
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                {["농장", "대상", "상태", "사유", "age", ""].map((h) => (
                  <th
                    key={h || "action"}
                    className={cn("px-4 py-3", dashboardTypography.tableHead)}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {failures.map((f) => (
                <tr key={f.commandId} className="border-b last:border-b-0">
                  <td className={cn("px-4 py-3", dashboardTypography.tableCell)}>
                    {f.farmLabel}
                  </td>
                  <td className={cn("px-4 py-3 font-mono text-sm", dashboardTypography.tableCell)}>
                    {f.targetLabel}
                  </td>
                  <td className="px-4 py-3">
                    <HealthStatusBadge status="warn" />
                    <span className="ml-2 text-sm">{f.status}</span>
                  </td>
                  <td className={cn("px-4 py-3", dashboardTypography.tableCell)}>
                    {f.reason}
                  </td>
                  <td className={cn("px-4 py-3 tabular-nums", dashboardTypography.tableCell)}>
                    {Math.round(f.ageSec)}s
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={pending}
                      className="rounded-lg border bg-card px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
                      onClick={() => {
                        startTransition(async () => {
                          await acknowledgeCommandHealthCheckpoint(f.commandId);
                        });
                      }}
                    >
                      체크포인트
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
