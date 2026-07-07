import { Leaf } from "lucide-react";
import { LoginFormWithNav } from "@/components/login/login-form-with-nav";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const errorMessages: Record<string, string> = {
  credentials: "이메일 또는 비밀번호가 올바르지 않습니다.",
  missing: "이메일과 비밀번호를 입력해 주세요.",
  auth: "로그인에 실패했습니다. 다시 시도해 주세요.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? (errorMessages[error] ?? errorMessages.auth) : null;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-muted/40 p-4 dark:bg-background">
      <div className="absolute right-4 top-4">
        <ThemeToggle className="bg-background/80 backdrop-blur" />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <Leaf className="size-6" />
          </div>
          <CardTitle className="text-xl">스마트 축사 IoT</CardTitle>
          <CardDescription>모니터링 · 제어 대시보드 로그인</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LoginFormWithNav initialError={message} />
          <p className="text-center text-xs text-muted-foreground">
            계정이 없거나 접근 권한이 필요하면 관리자에게 문의하세요.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
