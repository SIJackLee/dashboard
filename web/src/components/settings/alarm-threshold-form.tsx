import { SectionCard } from "@/components/common/section-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// 임계값: 온도 / 습도 만 (NH3/CO2 제외)
const thresholds = [
  { key: "temp", label: "온도 (℃)" },
  { key: "humidity", label: "습도 (%RH)" },
];

export function AlarmThresholdForm() {
  return (
    <SectionCard title="3. 알람 임계값 설정">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {thresholds.map((t) => (
          <div key={t.key} className="space-y-2 rounded-lg border p-4">
            <p className="text-sm font-medium">{t.label}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">상한</Label>
                <Input type="number" placeholder="--" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">하한</Label>
                <Input type="number" placeholder="--" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
