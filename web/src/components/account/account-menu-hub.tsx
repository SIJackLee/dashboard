"use client";

import type { ReactNode } from "react";
import { accountMenuLayout } from "@/lib/ui/account-menu-layout";

type Props = {
  name: string;
  initial: string;
  email: string | null;
  roleLabel?: string | null;
  trailing?: ReactNode;
  onCloseMenu?: () => void;
};

export function AccountMenuHub({
  name,
  initial,
  email,
  roleLabel,
  trailing,
  onCloseMenu,
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
      <div className={accountMenuLayout.sheetHeaderActions}>
        {trailing}
        <button
          type="button"
          className={accountMenuLayout.sheetCloseBtn}
          data-account-menu-close
          aria-label="계정 메뉴 닫기"
          onClick={onCloseMenu}
        >
          닫기
        </button>
      </div>
    </div>
  );
}
