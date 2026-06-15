"use client";

import { useMemo, useState, useTransition } from "react";
import { SectionCard } from "@/components/common/section-card";
import { Checkbox } from "@/components/ui/checkbox";
import { PageActionButton } from "@/components/common/page-action-button";
import { saveDisplaySettingsAction } from "@/app/(dashboard)/settings/actions";
import {
  DISPLAY_SETTING_GROUPS,
  type DisplaySettingKey,
  type DisplaySettings,
} from "@/lib/data/display-settings-shared";
import {
  displayKeyPageId,
  getVisibleDisplayPageIds,
} from "@/lib/dashboard-sections";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { PIGGY_PLAY_ENABLED } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

type Props = {
  initialSettings: DisplaySettings;
};

export function DisplaySettingsForm({ initialSettings }: Props) {
  const [settings, setSettings] = useState<DisplaySettings>(initialSettings);
  const [pending, startTransition] = useTransition();

  const groups = useMemo(() => {
    const visiblePages = getVisibleDisplayPageIds();
    return DISPLAY_SETTING_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.key === "global.piggyMenu" && !PIGGY_PLAY_ENABLED) {
          return false;
        }
        return visiblePages.has(displayKeyPageId(item.key));
      }),
    })).filter((group) => group.items.length > 0);
  }, []);

  const toggle = (key: DisplaySettingKey, checked: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: checked }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => {
      void saveDisplaySettingsAction(formData);
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="hidden" name="settings_json" value={JSON.stringify(settings)} />
      <SectionCard
        title="페이지 표시 설정"
        description="각 페이지 UI 요소의 표시 여부를 선택합니다. 저장 후 전체 페이지에 즉시 반영됩니다."
        action={
          <PageActionButton type="submit" variant="primary" disabled={pending}>
            {pending ? "저장 중…" : "저장"}
          </PageActionButton>
        }
      >
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.pageId} className="rounded-xl border p-5">
              <p className={dashboardUi.cardTitle}>{group.page}</p>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {group.items.map((item) => (
                  <label
                    key={item.key}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border bg-muted/20 px-4 py-3"
                  >
                    <Checkbox
                      checked={settings[item.key]}
                      onCheckedChange={(v) => toggle(item.key, v === true)}
                    />
                    <span className={dashboardUi.body}>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </form>
  );
}
