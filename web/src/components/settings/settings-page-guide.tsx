import { SectionCard } from "@/components/common/section-card";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

const pages = [
  {
    page: "농장 (/farm)",
    items: ["지도 | 목록 탭", "축사 지도 배치(드래그)", "위치 초기화", "축사 카드 → 목록 탭+필터"],
  },
  {
    page: "축사 (/barns → /farm?view=list)",
    items: ["축사유형·축사·컨트롤러 계층 테이블", "축사유형 필터", "새로고침"],
  },
  {
    page: "컨트롤러 (/controllers)",
    items: [
      "농장·축사유형·컨트롤러 선택",
      "카드 이름 편집(연필)",
      "설정 온도·편차·환기 슬라이더",
      "저장(명령 전송)",
      "명령 이력",
    ],
  },
  {
    page: "알람 (/alarms)",
    items: ["활성 알람 목록·필터", "TopBar 알림 드롭다운", "임계값은 설정 → 알람 탭"],
  },
  {
    page: "설정 (/settings)",
    items: [
      "표시·수집·MQTT(표시 탭)",
      "축사 레이아웃·별칭(농장 탭)",
      "온·습도 알람 임계값(알람 탭)",
      "연결 복구·백필 이력(연결 복구 탭)",
    ],
  },
];

export function SettingsPageGuide() {
  return (
    <SectionCard
      title="페이지별 설정 가능 항목"
      description="각 화면에서 직접 조작할 수 있는 요소와, 이 설정 페이지에서 관리하는 항목을 구분합니다."
    >
      <div className="space-y-4">
        {pages.map((p) => (
          <div key={p.page} className="rounded-lg border p-4">
            <p className={cn("font-semibold", dashboardUi.cardTitle)}>{p.page}</p>
            <ul className={cn("mt-2 list-inside list-disc space-y-1 text-muted-foreground", dashboardUi.body)}>
              {p.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
