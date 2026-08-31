import Link from "next/link";

/** 404 폴백. 잘못된 경로 진입 시 홈 복귀 안내. */
export default function NotFound() {
  return (
    <div className="flex min-h-[60dvh] w-full flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex flex-col items-center gap-1.5">
        <p className="text-lg font-semibold text-foreground">
          페이지를 찾을 수 없습니다
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          요청하신 페이지가 이동되었거나 존재하지 않습니다.
        </p>
      </div>
      <Link
        href="/farm"
        className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80"
      >
        홈으로
      </Link>
    </div>
  );
}
