"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { resetBarnLayoutsAction } from "@/app/(dashboard)/farm/actions";
import { PageActionButton } from "@/components/common/page-action-button";
import { DisplayGate } from "@/components/display/display-settings-provider";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export function FarmMapResetButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const handleReset = () => {
    if (
      !window.confirm(
        "농장 지도 카드 위치를 초기화할까요?\n축사유형 순서대로 자동 배치됩니다."
      )
    ) {
      return;
    }
    setMessage(null);
    startTransition(() => {
      void resetBarnLayoutsAction().then((res) => {
        if (res.ok) {
          router.refresh();
        } else {
          setMessage("초기화에 실패했습니다.");
        }
      });
    });
  };

  return (
    <DisplayGate setting="farm.resetButton">
      <div className="flex items-center gap-2">
      {message && (
        <span className={cn("text-red-600", dashboardUi.tableMeta)}>{message}</span>
      )}
      <PageActionButton
        disabled={pending}
        onClick={handleReset}
        icon={
          <RotateCcw
            className={cn(dashboardUi.iconSm, pending && "animate-spin")}
            aria-hidden
          />
        }
      >
        위치 초기화
      </PageActionButton>
      </div>
    </DisplayGate>
  );
}
