import { FanIndicator, type FanKind } from "@/components/common/fan-indicator";
import { Sparkline } from "@/components/common/sparkline";

const fans: FanKind[] = ["supply", "exhaust", "intake"];

// 송풍/배기/입기 팬 % 게이지 + 10-포인트 추이 스파크라인
export function FanGaugeGroup() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {fans.map((kind) => (
        <div key={kind} className="space-y-2 rounded-lg border p-4">
          <FanIndicator kind={kind} />
          <Sparkline />
        </div>
      ))}
    </div>
  );
}
