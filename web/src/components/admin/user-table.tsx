"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { revokeAccess, updateUserRole } from "@/app/(dashboard)/admin/users/actions";
import type { ManagedUser } from "@/lib/admin/list-users";
import type { Role } from "@/lib/auth/get-current-user";
import { farmShortLabel } from "@/lib/data/farm-summaries";
import { SectionCard } from "@/components/common/section-card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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

const roleOptions: { value: Role; label: string }[] = [
  { value: "admin", label: "관리자" },
  { value: "operator", label: "운영자" },
  { value: "viewer", label: "뷰어" },
];

type Props = {
  users: ManagedUser[];
  selectedEmail?: string;
  onEmailSelect: (email: string) => void;
  currentUserId?: string;
};

export function UserTable({
  users,
  selectedEmail,
  onEmailSelect,
  currentUserId,
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const hay = [
        u.email,
        u.displayName,
        u.role ? roleLabel[u.role] : null,
        ...u.farmAccess.map((a) =>
          farmShortLabel({
            lsindRegistNo: a.lsindRegistNo,
            itemCode: a.itemCode,
          })
        ),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [users, query]);

  const handleRevoke = (e: React.FormEvent<HTMLFormElement>) => {
    if (
      !window.confirm(
        "선택한 농장 접근 권한을 회수할까요? 이 작업은 되돌릴 수 없습니다."
      )
    ) {
      e.preventDefault();
    }
  };

  return (
    <SectionCard
      title="사용자 목록"
      description={`총 ${users.length}명 · 표시 ${filtered.length}명`}
    >
      <div className="mb-4">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이메일, 이름, 역할, 농장으로 검색"
          className="h-11 max-w-xl text-xl"
          aria-label="사용자 검색"
        />
      </div>

      {filtered.length === 0 ? (
        <p className={cn("text-muted-foreground", dashboardUi.body)}>
          {users.length === 0
            ? "등록된 사용자가 없습니다."
            : "검색 조건에 맞는 사용자가 없습니다."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이메일</TableHead>
              <TableHead>이름</TableHead>
              <TableHead>역할</TableHead>
              <TableHead>농장 접근 권한</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u) => (
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
                  {u.displayName ? (
                    u.displayName
                  ) : (
                    <span className={dashboardUi.tableMeta}>—</span>
                  )}
                </TableCell>
                <TableCell>
                  <form action={updateUserRole} className="flex items-center gap-2">
                    <input type="hidden" name="user_id" value={u.id} />
                    <select
                      name="role"
                      defaultValue={(u.role as Role | null) ?? "viewer"}
                      className={cn(
                        "h-11 min-w-[8rem] rounded-lg border bg-background px-3",
                        dashboardUi.body
                      )}
                      disabled={u.id === currentUserId && u.role === "admin"}
                    >
                      {roleOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className={cn(
                        "rounded-lg border px-3 py-1.5 hover:bg-muted",
                        dashboardUi.body
                      )}
                    >
                      저장
                    </button>
                  </form>
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
                          <Badge variant="outline" className={dashboardUi.badgeMd}>
                            조회
                          </Badge>
                          {a.can_command && (
                            <Badge variant="secondary" className={dashboardUi.badgeMd}>
                              명령
                            </Badge>
                          )}
                          <form
                            action={revokeAccess}
                            className="inline"
                            onSubmit={handleRevoke}
                          >
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
      )}
    </SectionCard>
  );
}
