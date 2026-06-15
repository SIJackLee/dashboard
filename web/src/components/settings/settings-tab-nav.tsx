"use client";

import { Bell, LayoutGrid, MapPin, type LucideIcon } from "lucide-react";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { getVisibleSettingsTabIds } from "@/lib/dashboard-sections";
import { cn } from "@/lib/utils";

export type SettingsTabId = "dashboard" | "farm" | "alarm";

const TAB_META: Record<SettingsTabId, { label: string; icon: LucideIcon }> = {
  dashboard: { label: "표시", icon: LayoutGrid },
  farm: { label: "농장", icon: MapPin },
  alarm: { label: "알람", icon: Bell },
};

type Props = {
  active: SettingsTabId;
  onChange: (id: SettingsTabId) => void;
};

export function SettingsTabNav({ active, onChange }: Props) {
  const visibleIds = getVisibleSettingsTabIds();
  const tabs = visibleIds.map((id) => ({
    id,
    ...TAB_META[id],
  }));

  return (
    <div className="flex flex-wrap gap-2 border-b pb-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            "flex items-center gap-2 border-b-2 transition-colors",
            dashboardUi.tabNav,
            active === t.id
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <t.icon className={dashboardUi.iconSm} />
          {t.label}
        </button>
      ))}
    </div>
  );
}
