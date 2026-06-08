import { Trash2 } from "lucide-react";
import { revokeAccess } from "@/app/(dashboard)/admin/users/actions";
import type { ManagedUser } from "@/lib/admin/list-users";
import { SectionCard } from "@/components/common/section-card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const roleLabel: Record<string, string> = {
  admin: "관리자",
  operator: "운영자",
  viewer: "뷰어",
};

export function UserTable({ users }: { users: ManagedUser[] }) {
  return (
    <SectionCard title="사용자 목록" description={`총 ${users.length}명`}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>이메일</TableHead>
            <TableHead>역할</TableHead>
            <TableHead>농장 접근 권한</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">
                {u.email ?? "(이메일 없음)"}
              </TableCell>
              <TableCell>
                {u.role ? (
                  <Badge variant="secondary">{roleLabel[u.role] ?? u.role}</Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">미설정</span>
                )}
              </TableCell>
              <TableCell>
                {u.farmAccess.length === 0 ? (
                  <span className="text-xs text-muted-foreground">권한 없음</span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {u.farmAccess.map((a) => (
                      <span
                        key={a.id}
                        className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
                      >
                        농장 {a.farm_uid}
                        {a.can_command && (
                          <Badge variant="outline" className="h-4 px-1 text-[10px]">
                            명령
                          </Badge>
                        )}
                        <form action={revokeAccess} className="inline">
                          <input type="hidden" name="access_id" value={a.id} />
                          <button
                            type="submit"
                            className="text-muted-foreground hover:text-red-600"
                            title="권한 회수"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </form>
                      </span>
                    ))}
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionCard>
  );
}
