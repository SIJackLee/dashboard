import { Radio, Wifi, Boxes, Cpu, ChevronRight } from "lucide-react";
import { SectionCard } from "@/components/common/section-card";
import type { FarmOverview } from "@/lib/data/iot";

export function ConnectionFlow({ overview }: { overview?: FarmOverview }) {
  const steps = [
    { label: "게이트웨이", icon: Radio, value: "--" },
    { label: "네트워크", icon: Wifi, value: "--" },
    {
      label: "통신박스",
      icon: Boxes,
      value: overview ? `${overview.moduleCount}개` : "--",
    },
    {
      label: "컨트롤러",
      icon: Cpu,
      value: overview ? `${overview.controllerCount}개` : "--",
    },
  ];

  return (
    <SectionCard title="연결 상태">
      <div className="flex items-center justify-between">
        {steps.map((s, i) => (
          <div key={s.label} className="flex flex-1 items-center">
            <div className="flex flex-1 flex-col items-center gap-2">
              <span className="flex size-12 items-center justify-center rounded-lg border bg-muted/40">
                <s.icon className="size-5 text-muted-foreground" />
              </span>
              <span className="text-xs font-medium">{s.label}</span>
              <span className="text-[10px] text-muted-foreground">{s.value}</span>
            </div>
            {i < steps.length - 1 && (
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
