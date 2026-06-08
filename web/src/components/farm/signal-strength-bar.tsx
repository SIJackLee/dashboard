import { SignalHigh } from "lucide-react";

// 신호 강도(평균) 골격. dBm 값은 추후 매칭.
export function SignalStrengthBar() {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-background p-4">
      <SignalHigh className="size-5 text-emerald-500" />
      <div className="flex-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">신호 강도 (평균)</span>
          <span className="font-semibold">-- dBm</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-0 rounded-full bg-emerald-500" />
        </div>
      </div>
    </div>
  );
}
