"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Route segment 에러 폴백. 예외 발생 시 페이지 붕괴 대신 복구 UI 제공.
 * reset()으로 세그먼트 재렌더 재시도.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] w-full flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex flex-col items-center gap-1.5">
        <p className="text-lg font-semibold text-foreground">
          화면을 불러오지 못했습니다
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          일시적인 오류가 발생했습니다. 다시 시도하거나 잠시 후 새로고침해 주세요.
        </p>
        {error.digest ? (
          <p className="mt-1 text-xs text-muted-foreground/70">
            오류 코드: {error.digest}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={() => reset()}>다시 시도</Button>
        <Button
          variant="outline"
          onClick={() => {
            window.location.href = "/farm";
          }}
        >
          홈으로
        </Button>
      </div>
    </div>
  );
}
