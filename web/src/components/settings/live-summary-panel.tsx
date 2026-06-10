import { SectionCard } from "@/components/common/section-card";
import { Badge } from "@/components/ui/badge";
import { FIRMWARE_CTRL_COUNT } from "@/lib/data/iot-firmware";
import type { LiveSummary } from "@/lib/data/iot-live";

function fmtTime(iso: string | null) {
  if (!iso) return "--";
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

export function LiveSummaryPanel({ summary }: { summary?: LiveSummary }) {
  const head = summary?.modules[0];

  return (
    <SectionCard
      title="LIVE 수신 요약"
      action={
        head?.wireVer === 6 ? (
          <Badge variant="default">wire v0x06</Badge>
        ) : (
          <Badge variant="outline">LIVE</Badge>
        )
      }
    >
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">통신박스</dt>
          <dd>{summary?.modules.length ?? 0}대</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">LIVE 컨트롤러</dt>
          <dd>
            {summary?.totalControllers ?? 0}건 (v0x06: {FIRMWARE_CTRL_COUNT})
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">wire_ver</dt>
          <dd>
            {head?.wireVer != null ? `0x${head.wireVer.toString(16)}` : "--"}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">lut_ver</dt>
          <dd>{head?.lutVer ?? "--"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">최신 mesure_dt</dt>
          <dd className="text-right">{fmtTime(head?.mesureDt ?? null)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">최신 수신</dt>
          <dd className="text-right">{fmtTime(head?.receivedAt ?? null)}</dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-muted-foreground">
        SW 버튼 1회=그룹 BUFFERING, 2회=REPLAY→LIVE — 백필(REPLAY) 메뉴에서 ctrl별 이력 확인
      </p>
    </SectionCard>
  );
}
