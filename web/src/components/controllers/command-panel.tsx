import { Send } from "lucide-react";
import { SectionCard } from "@/components/common/section-card";
import { RoleGuard } from "@/components/common/role-guard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// 명령(intent): 최저환기 / 최고환기 / 설정온도 / 온도편차
// → ctrl_thermo_command (min_vent_pct, max_vent_pct, setpoint_temp, temp_deviation)
const fields = [
  { key: "min_vent_pct", label: "최저환기", unit: "%" },
  { key: "max_vent_pct", label: "최고환기", unit: "%" },
  { key: "setpoint_temp", label: "설정온도", unit: "℃" },
  { key: "temp_deviation", label: "온도편차", unit: "℃" },
];

export function CommandPanel() {
  return (
    <SectionCard title="원격 제어 명령">
      <RoleGuard requireCommand>
        <div className="grid grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {f.label} ({f.unit})
              </Label>
              <Input type="number" placeholder="--" />
            </div>
          ))}
        </div>
        <button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-700">
          <Send className="size-4" /> 명령 전송
        </button>
        <p className="mt-2 text-xs text-muted-foreground">
          명령 결과 / 최근 전송 시각 (데이터 추후 매칭)
        </p>
      </RoleGuard>
    </SectionCard>
  );
}
