import {
  LayoutGrid,
  Tractor,
  Warehouse,
  Cpu,
  Bell,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";

// 설정 탭(골격). 탭 전환 로직은 데이터/상태 매칭 단계에서 구현.
const tabs = [
  { label: "대시보드 설정", icon: LayoutGrid, active: true },
  { label: "농장 설정", icon: Tractor },
  { label: "축사 설정", icon: Warehouse },
  { label: "컨트롤러 설정", icon: Cpu },
  { label: "알람 설정", icon: Bell },
  { label: "로그 설정", icon: ScrollText },
];

export function SettingsTabNav() {
  return (
    <div className="flex flex-wrap gap-1 border-b">
      {tabs.map((t) => (
        <button
          key={t.label}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            t.active
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <t.icon className="size-4" />
          {t.label}
        </button>
      ))}
    </div>
  );
}
