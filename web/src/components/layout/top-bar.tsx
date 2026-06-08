import { Bell, Wifi, Radio, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { signOut } from "@/app/auth/actions";

type TopBarProps = {
  title: string;
};

export function TopBar({ title }: TopBarProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <h1 className="text-xl font-bold">{title}</h1>

      <div className="flex items-center gap-3">
        <Badge variant="outline" className="gap-1 text-emerald-600">
          <span className="size-2 rounded-full bg-emerald-500" /> ONLINE
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Radio className="size-3.5" /> MQTT 연결
        </Badge>
        <Badge variant="outline" className="gap-1 text-sky-600">
          <Wifi className="size-3.5" /> 마지막 수신 --
        </Badge>

        <button className="relative rounded-md p-2 hover:bg-muted">
          <Bell className="size-5" />
          <span className="absolute right-1 top-1 size-2 rounded-full bg-red-500" />
        </button>
        <form action={signOut}>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-4" />
            로그아웃
          </button>
        </form>
      </div>
    </header>
  );
}
