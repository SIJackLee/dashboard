"use client";

import { useState, useTransition } from "react";
import { FileText, Loader2 } from "lucide-react";
import { fetchDailyReportPayloadAction } from "@/app/(dashboard)/farm/actions";
import { CommandPipelineOverlay } from "@/components/farm/command-pipeline-overlay";
import type { FarmKey } from "@/lib/data/farm-key";
import { buildAndDownloadDailyReportPdf } from "@/lib/report/build-daily-report-pdf";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  farmKey: FarmKey | null;
  alarmCount?: number;
};

export function DailyReportButton({ farmKey, alarmCount = 0 }: Props) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [overlay, setOverlay] = useState({
    visible: false,
    phase: "loading" as "loading" | "success" | "error",
    title: "",
    detail: undefined as string | undefined,
  });

  const disabled = !farmKey || busy || pending;

  const run = () => {
    if (!farmKey || busy) return;
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
          const payload = await fetchDailyReportPayloadAction(farmKey, {
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
            detail: `${farmKey.lsindRegistNo}_${farmKey.itemCode}_일보_${payload.reportDate}.pdf`,
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
        disabled={disabled}
        onClick={run}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin md:size-5" aria-hidden />
        ) : (
          <FileText className="size-4 md:size-5" aria-hidden />
        )}
      </button>
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
