import { SectionCard } from "@/components/common/section-card";
import { Badge } from "@/components/ui/badge";

const sections = [
  { title: "1. 페이지 표시 설정", rows: ["표시 항목", "새로고침 주기", "시간 표시 형식"] },
  { title: "2. 데이터 수집 설정", rows: ["폴링 간격", "데이터 보관 기간"] },
  { title: "3. 알람 임계값 설정", rows: ["온도 상한 / 하한", "습도 상한 / 하한"] },
  { title: "4. MQTT / 서버 연결 설정", rows: ["MQTT 브로커", "포트", "연결 상태"] },
];

export function LiveSummaryPanel() {
  return (
    <SectionCard
      title="현재 적용 값 요약"
      action={<Badge variant="outline">실시간</Badge>}
    >
      <div className="space-y-5">
        {sections.map((s) => (
          <div key={s.title}>
            <p className="mb-2 text-sm font-semibold">{s.title}</p>
            <dl className="space-y-1.5">
              {s.rows.map((r) => (
                <div key={r} className="flex justify-between gap-2 text-sm">
                  <dt className="text-muted-foreground">{r}</dt>
                  <dd>--</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
