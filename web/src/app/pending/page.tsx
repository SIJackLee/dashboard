import { redirect } from "next/navigation";
import { Clock, LogOut } from "lucide-react";
import { NavContentReadyMarker } from "@/components/layout/nav-content-ready-marker";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { signOut } from "@/app/auth/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function PendingPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (user.hasAccess) redirect("/farm");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <NavContentReadyMarker />
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
            <Clock className="size-6" />
          </div>
          <CardTitle className="text-xl">접근 권한 대기 중</CardTitle>
          <CardDescription>
            아직 데이터 접근 권한이 부여되지 않았습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-background p-4 text-sm">
            <p className="text-muted-foreground">
              아래 이메일을 관리자에게 알려주시면 접근 권한을 부여받을 수 있습니다.
            </p>
            <p className="mt-2 font-medium">{user.email ?? "(이메일 없음)"}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-md border py-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              <LogOut className="size-4" />
              로그아웃
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
