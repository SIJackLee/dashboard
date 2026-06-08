import { Radio } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  online: boolean;
  moduleCount: number;
};

export function FarmMapGateway({ online, moduleCount }: Props) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col items-center justify-center overflow-hidden rounded-lg border bg-background px-2 py-2 text-center shadow-sm",
        "col-start-2 row-start-1 z-10"
      )}
    >
      <span
        className={cn(
          "mb-1 flex size-8 shrink-0 items-center justify-center rounded-full",
          online ? "bg-emerald-50 text-emerald-600" : "bg-muted text-muted-foreground"
        )}
      >
        <Radio className="size-4" />
      </span>
      <p className="w-full truncate text-[10px] font-semibold leading-tight">
        통신 게이트웨이
      </p>
      <p className="w-full truncate text-[9px] leading-tight text-muted-foreground">
        {online ? "온라인" : "오프라인"} · 모듈 {moduleCount}
      </p>
    </div>
  );
}
