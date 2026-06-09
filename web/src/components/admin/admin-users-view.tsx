"use client";

import { useState } from "react";
import type { ManagedUser } from "@/lib/admin/list-users";
import { GrantAccessForm } from "./grant-access-form";
import { UserTable } from "./user-table";

type Props = {
  users: ManagedUser[];
};

export function AdminUsersView({ users }: Props) {
  const [email, setEmail] = useState("");

  return (
    <>
      <GrantAccessForm email={email} onEmailChange={setEmail} />
      <UserTable
        users={users}
        selectedEmail={email}
        onEmailSelect={setEmail}
      />
    </>
  );
}
