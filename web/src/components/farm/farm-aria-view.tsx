"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  startTransition,
} from "react";
import {
  fetchAriaFarmMetricsAction,
  type AriaMetricsSnapshot,
} from "@/app/(dashboard)/farm/aria-metrics-actions";
import { AriaMetricsSlides } from "@/components/farm/aria-metrics-slides";
import { AriaOrb } from "@/components/farm/aria-orb";
import {
  AriaStageLayout,
  ariaStageFocusFromOrbMode,
} from "@/components/farm/aria-stage-layout";
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

const METRICS_POLL_MS = 30_000;

function farmKeyId(farm: FarmKey): string {
  return `${farm.lsindRegistNo}/${farm.itemCode}`;
}

type Props = {
  currentFarm?: FarmKey | null;
  isMobileStack?: boolean;
  className?: string;
};

/** ARIA 탭 — 스테이지(오브↔지표 LIVE) + 하단 도크. */
export function FarmAriaView({
  currentFarm = null,
  isMobileStack = false,
  className,
}: Props) {
  const [orbMode, setOrbMode] = useState<AriaOrbMode>("idle");
  const [orbLevel, setOrbLevel] = useState(0);
  const [facts, setFacts] = useState<AriaMetricsSnapshot | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const requestGen = useRef(0);

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

  const loadMetrics = useCallback(async (farm: FarmKey, soft = false) => {
    const gen = ++requestGen.current;
    if (!soft) startTransition(() => setMetricsLoading(true));
    const result = await fetchAriaFarmMetricsAction(farm);
    if (gen !== requestGen.current) return;
    startTransition(() => {
      if (result.ok) {
        setFacts(result.facts);
        setMetricsError(null);
      } else {
        setMetricsError("지표를 불러오지 못했습니다.");
      }
      setMetricsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!currentFarm) {
      requestGen.current += 1;
      queueMicrotask(() => {
        startTransition(() => {
          setFacts(null);
          setMetricsError(null);
          setMetricsLoading(false);
        });
      });
      return;
    }
    queueMicrotask(() => {
      void loadMetrics(currentFarm);
    });
  }, [currentFarm, loadMetrics]);

  const focus = ariaStageFocusFromOrbMode(currentFarm ? orbMode : "idle");
  const metricsVisible =
    currentFarm != null &&
    (orbMode === "listen" || orbMode === "think" || orbMode === "speak");

  useEffect(() => {
    if (!currentFarm || !metricsVisible) return;
    queueMicrotask(() => {
      void loadMetrics(currentFarm, true);
    });
    const id = window.setInterval(() => {
      void loadMetrics(currentFarm, true);
    }, METRICS_POLL_MS);
    return () => window.clearInterval(id);
  }, [currentFarm, metricsVisible, loadMetrics]);

  const displayFacts =
    currentFarm && facts && farmKeyId(facts.farmKey) === farmKeyId(currentFarm)
      ? facts
      : null;

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

      <AriaStageLayout
        focus={focus}
        metricsVisible={metricsVisible}
        metrics={
          <AriaMetricsSlides
            facts={displayFacts}
            loading={metricsLoading}
            error={metricsError}
            emphasized={focus === "metrics"}
          />
        }
        orb={
          <AriaOrb
            mode={currentFarm ? orbMode : "idle"}
            level={currentFarm ? orbLevel : 0}
          />
        }
        hint={
          <p className={dashboardAriaShell.hint}>
            말로 묻거나, 아래에서 텍스트로 질문하세요.
          </p>
        }
      />

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
