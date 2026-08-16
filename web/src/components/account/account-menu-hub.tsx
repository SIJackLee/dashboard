"use client";

import type { ReactNode } from "react";
import { accountMenuLayout } from "@/lib/ui/account-menu-layout";

type Props = {
  name: string;
  initial: string;
  email: string | null;
  roleLabel?: string | null;
  trailing?: ReactNode;
};

export function AccountMenuHub({
  name,
  initial,
  email,
  roleLabel,
  trailing,
}: Props) {
  return (
    <div className={accountMenuLayout.sheetHeader}>
      <span className={accountMenuLayout.hubAvatar}>{initial}</span>
      <div className="min-w-0 flex-1">
        <p id="account-menu-sheet-title" className={accountMenuLayout.hubName}>
          {name}
        </p>
        {email ? <p className={accountMenuLayout.hubMeta}>{email}</p> : null}
        {roleLabel ? (
          <p className={accountMenuLayout.hubMeta}>{roleLabel}</p>
        ) : null}
      </div>
      {trailing ? (
        <div className={accountMenuLayout.sheetHeaderActions}>{trailing}</div>
      ) : null}
    </div>
  );
}
