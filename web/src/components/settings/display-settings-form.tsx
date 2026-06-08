import { SectionCard } from "@/components/common/section-card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SimpleSelect } from "@/components/common/filter-bar";

const displayItems = [
  "환경 센서",
  "컨트롤러 상태",
  "명령 이력",
  "축사 요약 카드",
  "상태 정보",
  "명령 버튼",
  "환경 트렌드",
];

export function DisplaySettingsForm() {
  return (
    <SectionCard title="1. 페이지 표시 설정">
      <p className="mb-2 text-sm font-medium">표시 항목 선택</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {displayItems.map((item) => (
          <label key={item} className="flex items-center gap-2 text-sm">
            <Checkbox defaultChecked />
            {item}
          </label>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">새로고침 주기</Label>
          <SimpleSelect placeholder="5초" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">시간 표시 형식</Label>
          <SimpleSelect placeholder="24시간 (HH:mm:ss)" />
        </div>
      </div>
    </SectionCard>
  );
}
