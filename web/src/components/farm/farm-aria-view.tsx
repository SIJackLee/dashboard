"use client";

import { useCallback, useState } from "react";
import { AriaOrb } from "@/components/farm/aria-orb";
import { VoiceReportFab } from "@/components/farm/voice-report-fab";
import type { FarmKey } from "@/lib/data/farm-key";
import { farmShortLabel } from "@/lib/data/farm-summaries";
import {
  ARIA_FULL_NAME,
  ARIA_NAME,
  voiceStatusToAriaMode,
  type AriaOrbMode,
  type VoiceReportStatus,
} from "@/lib/aria/aria-mode";
import { dashboardAriaShell } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

type Props = {
  currentFarm?: FarmKey | null;
  isMobileStack?: boolean;
  className?: string;
};

/**
 * ARIA 탭 — 오브 중심 + 하단 도크 (셸 비주얼 = 갭4).
 * 프로토콜·음성 파이프라인 로직은 VoiceReportFab / lib/aria 소유.
 */
export function FarmAriaView({
  currentFarm = null,
  isMobileStack = false,
  className,
}: Props) {
  const [orbMode, setOrbMode] = useState<AriaOrbMode>("idle");
  const [orbLevel, setOrbLevel] = useState(0);

  const onVoiceStatus = useCallback(
    (status: VoiceReportStatus, meta: { micTesting: boolean }) => {
      setOrbMode(voiceStatusToAriaMode(status, meta));
      if (status !== "recording" && !meta.micTesting) {
        setOrbLevel(0);
      }
    },
    [],
  );

  const onMicLevel = useCallback((pct: number) => {
    setOrbLevel(Math.max(0, Math.min(1, pct / 100)));
  }, []);

  return (
    <div
      className={cn(
        "flex min-h-[min(72dvh,34rem)] flex-col",
        dashboardAriaShell.stage,
        motionClass.enterFade,
        className,
      )}
      data-testid="farm-aria-view"
    >
      <div className={dashboardAriaShell.stageGlow} aria-hidden />

      <header className="relative z-[1] flex flex-col items-center gap-1 px-4 pt-5 text-center md:pt-7">
        <p className={dashboardAriaShell.eyebrow}>농장 음성 어시스턴트</p>
        <h2 className={dashboardAriaShell.title} title={ARIA_FULL_NAME}>
          {ARIA_NAME}
        </h2>
        {currentFarm ? (
          <p className={dashboardAriaShell.farmMeta}>
            {farmShortLabel(currentFarm)}
          </p>
        ) : (
          <p className={dashboardAriaShell.warnMeta}>
            농장을 선택하면 음성 AI를 사용할 수 있습니다.
          </p>
        )}
      </header>

      <div className={dashboardAriaShell.orbZone}>
        <AriaOrb
          mode={currentFarm ? orbMode : "idle"}
          level={currentFarm ? orbLevel : 0}
        />
        <p className={dashboardAriaShell.hint}>
          말로 묻거나, 아래에서 텍스트로 질문하세요.
        </p>
      </div>

      {currentFarm != null ? (
        <div
          className={cn(
            dashboardAriaShell.dockSlot,
            isMobileStack && "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          )}
        >
          <VoiceReportFab
            currentFarm={currentFarm}
            layout="dock"
            onStatusChange={onVoiceStatus}
            onMicLevelChange={onMicLevel}
          />
        </div>
      ) : null}
    </div>
  );
}
