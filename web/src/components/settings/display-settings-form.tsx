"use client";

import { useMemo, useState, useTransition } from "react";
import { HealthSectionCard } from "@/components/admin/health/health-section-card";
import { Checkbox } from "@/components/ui/checkbox";
import { PageActionButton } from "@/components/common/page-action-button";
import { saveDisplaySettingsAction } from "@/lib/actions/app-settings-actions";
import {
  DISPLAY_SETTING_GROUPS,
  type DisplaySettingKey,
  type DisplaySettings,
} from "@/lib/data/display-settings-shared";
import {
  displayKeyPageId,
  getVisibleDisplayPageIds,
} from "@/lib/dashboard-sections";
import { dashboardTypography, dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { PIGGY_PLAY_ENABLED } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

type Props = {
  initialSettings: DisplaySettings;
  /** ops 컨트롤러 탭 표시/농장 패널 — 모바일 compact + sticky 저장 */
  variant?: "page" | "panel";
};

const FORM_ID = "display-settings-form";

export function DisplaySettingsForm({ initialSettings, variant = "page" }: Props) {
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

  const isPanel = variant === "panel";

  return (
    <>
      <form
        id={FORM_ID}
        onSubmit={handleSubmit}
        className={cn(
          isPanel && "pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pb-0"
        )}
      >
        <input type="hidden" name="settings_json" value={JSON.stringify(settings)} />
        <HealthSectionCard
          density="hub"
          title="페이지 표시 설정"
          description={
            isPanel
              ? undefined
              : "각 페이지 UI 요소의 표시 여부를 선택합니다. 저장 후 전체 페이지에 즉시 반영됩니다."
          }
          action={
            <PageActionButton
              type="submit"
              variant="primary"
              disabled={pending}
              className={cn(isPanel && "hidden lg:inline-flex")}
            >
              {pending ? "저장 중…" : "저장"}
            </PageActionButton>
          }
          className="w-full shrink-0"
        >
          <div className={cn("space-y-5", isPanel && "space-y-3")}>
            {groups.map((group) => (
              <div
                key={group.pageId}
                className={cn("rounded-xl border p-3", isPanel ? "md:p-4" : "md:p-5")}
              >
                <p className={cn(dashboardTypography.sectionTitle, isPanel && "text-sm")}>
                  {group.page}
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
                  {group.items.map((item) => (
                    <label
                      key={item.key}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2.5",
                        isPanel ? "text-sm" : "px-4 py-3"
                      )}
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
        {isPanel ? (
          <div className="mt-4 border-t pt-3 lg:hidden">
            <PageActionButton
              type="button"
              variant="primary"
              disabled={pending}
              className="w-full"
              onClick={() => {
                const el = document.getElementById(FORM_ID);
                if (el instanceof HTMLFormElement) el.requestSubmit();
              }}
            >
              {pending ? "저장 중…" : "저장"}
            </PageActionButton>
          </div>
        ) : null}
      </HealthSectionCard>
    </form>
    </>
  );
}
