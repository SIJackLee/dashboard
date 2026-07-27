"use client";

import { useCallback, useState, useSyncExternalStore, useTransition } from "react";
import { FileText, Loader2 } from "lucide-react";
import { fetchDailyReportPayloadAction } from "@/app/(dashboard)/farm/actions";
import { CommandPipelineOverlay } from "@/components/farm/command-pipeline-overlay";
import {
  InlineStatusToast,
  type InlineStatusTone,
} from "@/components/common/inline-status-toast";
import { parseFarmKeyFromQuery, type FarmKey } from "@/lib/data/farm-key";
import {
  currentFarmSearchParams,
  getFarmUrlEpoch,
  getFarmUrlEpochServer,
  subscribeFarmUrlEpoch,
} from "@/lib/farm/farm-view-url";
import { buildAndDownloadDailyReportPdf } from "@/lib/report/build-daily-report-pdf";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  /** SSR PageShell 값 — shallow 농장 전환 시 stale 할 수 있음 */
  farmKey: FarmKey | null;
  alarmCount?: number;
};

const NO_FARM_TOAST =
  "농장을 선택한 뒤 오늘의 리포트를 받을 수 있습니다.";

function resolveReportFarmKey(serverFarmKey: FarmKey | null): FarmKey | null {
  const params = currentFarmSearchParams();
  const fromUrl = parseFarmKeyFromQuery(params.get("lsind"), params.get("item"));
  return fromUrl ?? serverFarmKey;
}

export function DailyReportButton({ farmKey: serverFarmKey, alarmCount = 0 }: Props) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    tone: InlineStatusTone;
  } | null>(null);
  const [overlay, setOverlay] = useState({
    visible: false,
    phase: "loading" as "loading" | "success" | "error",
    title: "",
    detail: undefined as string | undefined,
  });

  /** shallow hub 농장 전환은 TopBar(SSR)를 갱신하지 않음 → URL epoch로 동기화 */
  const urlEpoch = useSyncExternalStore(
    subscribeFarmUrlEpoch,
    getFarmUrlEpoch,
    getFarmUrlEpochServer,
  );
  const farmKey = resolveReportFarmKey(serverFarmKey);
  void urlEpoch;

  const needsFarm = !farmKey;
  const busyLocked = busy || pending;
  /** 네이티브 disabled면 클릭이 막혀 토스트를 못 띄움 — 농장 미선택만 aria-disabled. */
  const nativeDisabled = busyLocked;

  const dismissToast = useCallback(() => setToast(null), []);

  const run = () => {
    if (busyLocked) return;
    const key = resolveReportFarmKey(serverFarmKey);
    if (!key) {
      setToast({ message: NO_FARM_TOAST, tone: "warn" });
      return;
    }
    setToast(null);
    setBusy(true);
    setOverlay({
      visible: true,
      phase: "loading",
      title: "보고서 작성 중…",
      detail: "데이터 수집 중",
    });

    startTransition(() => {
      void (async () => {
        try {
          const payload = await fetchDailyReportPayloadAction(key, {
            alarmCount,
          });
          if (!payload.barns.length) {
            throw new Error("출력할 축사 데이터가 없습니다.");
          }
          setOverlay((o) => ({
            ...o,
            detail: `표지 + 축사 ${payload.barns.length}곳 PDF 구성 중`,
          }));
          await buildAndDownloadDailyReportPdf(payload, (p) => {
            setOverlay({
              visible: true,
              phase: "loading",
              title: "보고서 작성 중…",
              detail: `${p.message} (${p.current}/${p.total})`,
            });
          });
          setOverlay({
            visible: true,
            phase: "success",
            title: "PDF 다운로드 완료",
            detail: `${key.lsindRegistNo}_${key.itemCode}_일보_${payload.reportDate}.pdf`,
          });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "보고서 생성에 실패했습니다.";
          setOverlay({
            visible: true,
            phase: "error",
            title: "보고서 작성 실패",
            detail: message,
          });
        } finally {
          setBusy(false);
        }
      })();
    });
  };

  return (
    <>
      <button
        type="button"
        className={cn(
          dashboardUi.topHeaderActionBtn,
          dashboardUi.topHeaderActionBtnReport,
          needsFarm && "opacity-40",
        )}
        data-tour-id="header-daily-report"
        aria-label={
          farmKey
            ? "오늘의 리포트 PDF 다운로드"
            : "오늘의 리포트 (농장 선택 필요)"
        }
        title={
          farmKey
            ? "오늘의 리포트"
            : "농장을 선택한 뒤 리포트를 받을 수 있습니다"
        }
        aria-disabled={needsFarm || undefined}
        disabled={nativeDisabled}
        onClick={run}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin md:size-5" aria-hidden />
        ) : (
          <FileText className="size-4 md:size-5" aria-hidden />
        )}
      </button>
      <InlineStatusToast
        message={toast?.message ?? null}
        tone={toast?.tone ?? "warn"}
        onDismiss={dismissToast}
      />
      <CommandPipelineOverlay
        visible={overlay.visible}
        phase={overlay.phase}
        title={overlay.title}
        detail={overlay.detail}
        autoDismiss={overlay.phase !== "loading"}
        onDismiss={
          overlay.phase === "loading"
            ? undefined
            : () => setOverlay((o) => ({ ...o, visible: false }))
        }
      />
    </>
  );
}
