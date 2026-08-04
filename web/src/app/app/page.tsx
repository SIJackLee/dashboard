import Image from "next/image";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  getAppApkVersionLabel,
  isAppInstallConfigured,
  isInstallUnlocked,
} from "@/lib/app-install/gate";
import { unlockAppInstall } from "./actions";

const errorMessages: Record<string, string> = {
  password: "비밀번호가 올바르지 않습니다.",
  auth: "먼저 비밀번호를 입력해 주세요.",
  missing:
    "설치 파일이 아직 준비되지 않았습니다. 관리자에게 문의해 주세요.",
};

export default async function AppInstallPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? (errorMessages[error] ?? null) : null;
  const configured = isAppInstallConfigured();
  const unlocked = configured && (await isInstallUnlocked());
  const version = getAppApkVersionLabel();

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-muted/40 p-4 dark:bg-background">
      <div className="absolute right-4 top-4">
        <ThemeToggle className="bg-background/80 backdrop-blur" />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <Image
            src="/app_logo2.png"
            alt="SUNG-IL"
            width={96}
            height={96}
            priority
            className="mb-3 size-20 rounded-2xl"
          />
          <CardTitle className="text-2xl">SUNG-IL IoT 앱 설치</CardTitle>
          <p className="text-sm text-muted-foreground">
            Android 알람 수신용 앱 · 버전 {version}
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {message ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-center text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {message}
            </p>
          ) : null}

          {!configured ? (
            <p className="text-center text-sm text-muted-foreground">
              설치 페이지가 아직 설정되지 않았습니다.
            </p>
          ) : unlocked ? (
            <div className="space-y-4">
              <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                <li>아래 버튼으로 APK를 받습니다.</li>
                <li>
                  설치가 막히면 설정에서 &quot;알 수 없는 앱&quot; 설치를
                  허용합니다.
                </li>
                <li>앱 실행 후 안내받은 계정으로 로그인하고 알림을 허용합니다.</li>
              </ol>
              <a
                href="/app/download"
                className="flex h-11 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                APK 다운로드
              </a>
            </div>
          ) : (
            <form action={unlockAppInstall} className="space-y-3">
              <label className="block space-y-1.5 text-sm">
                <span className="text-muted-foreground">설치 비밀번호</span>
                <input
                  type="password"
                  name="password"
                  required
                  autoComplete="current-password"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <button
                type="submit"
                className="flex h-11 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                확인
              </button>
            </form>
          )}

          <p className="text-center text-xs text-muted-foreground">
            로그인·계정은 관리자에게 별도로 받으세요.{" "}
            <Link href="/login" className="underline underline-offset-2">
              웹 로그인
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
