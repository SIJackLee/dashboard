import { SectionCard } from "@/components/common/section-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SimpleSelect } from "@/components/common/filter-bar";

export function DataCollectionForm() {
  return (
    <SectionCard title="2. 데이터 수집 설정">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            폴링 간격 (컨트롤러 → 서버, 초)
          </Label>
          <Input type="number" placeholder="5" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">데이터 보관 기간</Label>
          <SimpleSelect placeholder="90일" />
        </div>
      </div>
    </SectionCard>
  );
}
