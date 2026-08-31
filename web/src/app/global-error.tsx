"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * 루트 레이아웃까지 무너지는 예외의 최종 폴백. 자체 html/body를 렌더한다.
 * (globals.css를 직접 import해 토큰 변수를 확보)
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="ko">
      <body className="min-h-full bg-background antialiased">
        <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-lg font-semibold text-foreground">
            문제가 발생했습니다
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            앱을 불러오는 중 오류가 발생했습니다. 다시 시도해 주세요.
          </p>
          {error.digest ? (
            <p className="text-xs text-muted-foreground/70">
              오류 코드: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => reset()}
            className="mt-1 inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80"
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
