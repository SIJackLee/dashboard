"use client";

import {
  LayoutGrid,
  Tractor,
  Warehouse,
  Cpu,
  Bell,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SettingsTabId =
  | "dashboard"
  | "farm"
  | "barn"
  | "controller"
  | "alarm"
  | "log";

const tabs: { id: SettingsTabId; label: string; icon: typeof LayoutGrid }[] = [
  { id: "dashboard", label: "대시보드 설정", icon: LayoutGrid },
  { id: "farm", label: "농장 설정", icon: Tractor },
  { id: "barn", label: "축사 설정", icon: Warehouse },
  { id: "controller", label: "컨트롤러 설정", icon: Cpu },
  { id: "alarm", label: "알람 설정", icon: Bell },
  { id: "log", label: "로그 설정", icon: ScrollText },
];

type Props = {
  active: SettingsTabId;
  onChange: (id: SettingsTabId) => void;
};

export function SettingsTabNav({ active, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1 border-b">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            active === t.id
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
