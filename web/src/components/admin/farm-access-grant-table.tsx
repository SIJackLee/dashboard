"use client";

import { useState, useTransition } from "react";
import {
  toggleFarmCommandInline,
  toggleFarmReadInline,
} from "@/app/(dashboard)/admin/ops/users-actions";
import { PageActionButton } from "@/components/common/page-action-button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FarmKey } from "@/lib/data/farm-key";
import { dashboardTypography, dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export type GrantFarmOption = {
  farmKey: FarmKey;
  label: string;
};

export type FarmAccessState = {
  can_read: boolean;
  can_command: boolean;
};

type Props = {
  options: GrantFarmOption[];
  mode: "bulk" | "single";
  email: string;
  selectedIds: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
  farmValue: (fk: FarmKey) => string;
  accessByFarmId: Map<string, FarmAccessState>;
  onAccessChange: (farmId: string, access: FarmAccessState) => void;
};

type ToggleCellState = "idle" | "pending";

function PermissionToggleButton({
  email,
  farmKey,
  farmId,
  kind,
  enabled,
  currentAccess,
  onAccessChange,
}: {
  email: string;
  farmKey: FarmKey;
  farmId: string;
  kind: "read" | "command";
  enabled: boolean;
  currentAccess: FarmAccessState;
  onAccessChange: (farmId: string, access: FarmAccessState) => void;
}) {
  const [state, setState] = useState<ToggleCellState>("idle");
  const [isPending, startTransition] = useTransition();

  const applying = state === "pending" || isPending;
  const nextEnabled = !enabled;

  const grantLabel = kind === "read" ? "조회권한" : "명령권한";
  const revokeLabel = kind === "read" ? "조회회수" : "명령회수";

  const handleClick = () => {
    if (!email.trim() || applying) return;
    setState("pending");
    startTransition(async () => {
      const action =
        kind === "read" ? toggleFarmReadInline : toggleFarmCommandInline;
      const result = await action({
        email,
        farmKey,
        enabled: nextEnabled,
      });
      if (result.ok) {
        if (kind === "read") {
          onAccessChange(
            farmId,
            nextEnabled
              ? { can_read: true, can_command: currentAccess.can_command }
              : { can_read: false, can_command: false }
          );
        } else {
          onAccessChange(
            farmId,
            nextEnabled
              ? { can_read: true, can_command: true }
              : { can_read: true, can_command: false }
          );
        }
      }
      setState("idle");
    });
  };

  let buttonLabel = enabled ? revokeLabel : grantLabel;
  if (applying) buttonLabel = "적용중…";

  return (
    <PageActionButton
      type="button"
      variant={enabled ? "danger" : kind === "command" ? "primary" : "outline"}
      disabled={!email.trim() || applying}
      onClick={handleClick}
    >
      {buttonLabel}
    </PageActionButton>
  );
}

export function FarmAccessGrantTable({
  options,
  mode,
  email,
  selectedIds,
  onToggle,
  farmValue,
  accessByFarmId,
  onAccessChange,
}: Props) {
  if (options.length === 0) {
    return (
      <p className={cn("py-8 text-center text-muted-foreground", dashboardUi.body)}>
        검색 조건에 맞는 농장이 없습니다.
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-2 md:hidden">
        {options.map((o) => {
          const id = farmValue(o.farmKey);
          const checked = selectedIds.has(id);
          const access = accessByFarmId.get(id) ?? {
            can_read: false,
            can_command: false,
          };

          return (
            <li key={id} className="rounded-xl border bg-card px-3 py-3">
              <div className="flex items-start gap-3">
                {mode === "bulk" ? (
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => onToggle(id, v === true)}
                    aria-label={`${o.label} 선택`}
                    className="mt-1"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className={cn(dashboardTypography.body, "text-sm font-semibold")}>
                    {o.label}
                  </p>
                  <p className={cn(dashboardTypography.meta, "text-xs")}>{id}</p>
                  {mode === "bulk" ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {checked ? "선택됨" : "미선택"}
                    </p>
                  ) : (
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <PermissionToggleButton
                        email={email}
                        farmKey={o.farmKey}
                        farmId={id}
                        kind="read"
                        enabled={access.can_read}
                        currentAccess={access}
                        onAccessChange={onAccessChange}
                      />
                      <PermissionToggleButton
                        email={email}
                        farmKey={o.farmKey}
                        farmId={id}
                        kind="command"
                        enabled={access.can_command}
                        currentAccess={access}
                        onAccessChange={onAccessChange}
                      />
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto md:block">
    <Table>
      <TableHeader>
        <TableRow>
          {mode === "bulk" ? <TableHead className="w-14">선택</TableHead> : null}
          <TableHead>농장</TableHead>
          <TableHead>코드</TableHead>
          <TableHead className={mode === "single" ? "min-w-[20rem]" : "min-w-[9rem]"}>
            {mode === "bulk" ? "상태" : "권한 부여"}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {options.map((o) => {
          const id = farmValue(o.farmKey);
          const checked = selectedIds.has(id);
          const access = accessByFarmId.get(id) ?? {
            can_read: false,
            can_command: false,
          };

          return (
            <TableRow key={id}>
              {mode === "bulk" ? (
                <TableCell>
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => onToggle(id, v === true)}
                    aria-label={`${o.label} 선택`}
                  />
                </TableCell>
              ) : null}
              <TableCell className="font-medium">{o.label}</TableCell>
              <TableCell className={dashboardTypography.meta}>{id}</TableCell>
              <TableCell>
                {mode === "bulk" ? (
                  <span
                    className={cn(
                      checked ? "text-emerald-700" : "text-muted-foreground"
                    )}
                  >
                    {checked ? "선택됨" : "—"}
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <PermissionToggleButton
                      email={email}
                      farmKey={o.farmKey}
                      farmId={id}
                      kind="read"
                      enabled={access.can_read}
                      currentAccess={access}
                      onAccessChange={onAccessChange}
                    />
                    <PermissionToggleButton
                      email={email}
                      farmKey={o.farmKey}
                      farmId={id}
                      kind="command"
                      enabled={access.can_command}
                      currentAccess={access}
                      onAccessChange={onAccessChange}
                    />
                  </div>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
      </div>
    </>
  );
}
