"use client";

import { Trash2 } from "lucide-react";
import { revokeAccess } from "@/app/(dashboard)/admin/users/actions";
import type { ManagedUser } from "@/lib/admin/list-users";
import { farmShortLabel } from "@/lib/data/farm-summaries";
import { SectionCard } from "@/components/common/section-card";
import { Badge } from "@/components/ui/badge";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
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

type Props = {
  users: ManagedUser[];
  selectedEmail?: string;
  onEmailSelect: (email: string) => void;
};

export function UserTable({ users, selectedEmail, onEmailSelect }: Props) {
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
                {u.email ? (
                  <button
                    type="button"
                    onClick={() => onEmailSelect(u.email!)}
                    className={cn(
                      "text-left hover:text-emerald-700 hover:underline",
                      selectedEmail === u.email &&
                        "text-emerald-700 underline decoration-emerald-600/60"
                    )}
                    title="클릭하면 위 권한 부여 폼에 이메일이 채워집니다"
                  >
                    {u.email}
                  </button>
                ) : (
                  "(이메일 없음)"
                )}
              </TableCell>
              <TableCell>
                {u.role ? (
                  <Badge variant="secondary" className={dashboardUi.badgeMd}>
                    {roleLabel[u.role] ?? u.role}
                  </Badge>
                ) : (
                  <span className={dashboardUi.tableMeta}>미설정</span>
                )}
              </TableCell>
              <TableCell>
                {u.farmAccess.length === 0 ? (
                  <span className={dashboardUi.tableMeta}>권한 없음</span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {u.farmAccess.map((a) => (
                      <span
                        key={a.id}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5",
                          dashboardUi.body
                        )}
                      >
                        {farmShortLabel({
                          lsindRegistNo: a.lsindRegistNo,
                          itemCode: a.itemCode,
                        })}
                        {a.can_command && (
                          <Badge variant="outline" className={dashboardUi.badgeMd}>
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
                            <Trash2 className={dashboardUi.iconSm} />
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
