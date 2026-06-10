import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { StatCard } from "@/components/common/stat-card";
import { SectionCard } from "@/components/common/section-card";
import { FarmSummaryGrid } from "@/components/farm/farm-summary-grid";
import { Cpu, History, Tractor } from "lucide-react";
import { getLiveReadings, summarizeFarm } from "@/lib/data/iot";
import { FIRMWARE_CTRL_COUNT, formatReplayIdxRange } from "@/lib/data/iot-firmware";
import { getLiveSummary } from "@/lib/data/iot-live";
import { getReplayBurstSummary } from "@/lib/data/iot-replay";
import { deriveAlarmsFromReadings, summarizeAlarms } from "@/lib/data/alarms";
import { appendFarmKeyParams, farmKeyId } from "@/lib/data/farm-key";

export default async function DashboardPage() {
  const [readings, liveSummary, bursts] = await Promise.all([
    getLiveReadings(),
    getLiveSummary(),
    getReplayBurstSummary(5),
  ]);
  const overview = summarizeFarm(readings);
  const alarms = summarizeAlarms(deriveAlarmsFromReadings(readings));

  return (
    <PageShell title="대시보드">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <FarmSummaryGrid overview={overview} />
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="LIVE 컨트롤러"
              icon={Cpu}
              value={String(liveSummary.totalControllers)}
              sub={`v0x06: ${FIRMWARE_CTRL_COUNT} (idx 0~${FIRMWARE_CTRL_COUNT - 1})`}
            />
            <StatCard
              label="활성 알람"
              icon={Tractor}
              accent="red"
              value={String(alarms.total)}
            />
          </div>
          <SectionCard title="최근 REPLAY burst" description="SW 그룹 BUFFERING → 백필">
            {bursts.length === 0 ? (
              <p className="text-sm text-muted-foreground">REPLAY burst 없음</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {bursts.map((b) => {
                  const params = appendFarmKeyParams(new URLSearchParams(), b.farmKey);
                  params.set("module", String(b.moduleUid));
                  params.set("burst", String(b.burstNo));
                  return (
                    <li key={`${farmKeyId(b.farmKey)}-${b.moduleUid}-${b.burstNo}`}>
                      <Link
                        href={`/replay?${params.toString()}`}
                        className="text-emerald-700 hover:underline"
                      >
                        burst #{b.burstNo}
                      </Link>
                      {" — "}
                      {b.farmKey.lsindRegistNo}/{b.farmKey.itemCode} / box {b.moduleUid},{" "}
                      {formatReplayIdxRange(b.idxMin, b.idxMax)} · {b.totalCtrlRows}건
                    </li>
                  );
                })}
              </ul>
            )}
            <Link
              href="/replay"
              className="mt-3 inline-block text-sm text-muted-foreground hover:text-foreground"
            >
              전체 보기 →
            </Link>
          </SectionCard>
        </div>
        <SectionCard title="빠른 이동">
          <div className="grid gap-2 text-sm">
            <Link href="/farm" className="rounded-md border px-3 py-2 hover:bg-muted">
              농장 현황
            </Link>
            <Link href="/barns" className="rounded-md border px-3 py-2 hover:bg-muted">
              축사 현황
            </Link>
            <Link href="/controllers" className="rounded-md border px-3 py-2 hover:bg-muted">
              컨트롤러 제어
            </Link>
            <Link
              href="/replay"
              className="inline-flex items-center gap-2 rounded-md border px-3 py-2 hover:bg-muted"
            >
              <History className="size-4" /> 백필 (REPLAY)
            </Link>
            <Link href="/alarms" className="rounded-md border px-3 py-2 hover:bg-muted">
              알람 ({alarms.total})
            </Link>
          </div>
        </SectionCard>
      </div>
    </PageShell>
  );
}
