"use client";

import { useState } from "react";
import type { ManagedUser } from "@/lib/admin/list-users";
import type { GrantFarmOption } from "./grant-access-form";
import { GrantAccessForm } from "./grant-access-form";
import { UserTable } from "./user-table";

type Props = {
  users: ManagedUser[];
  farmOptions: GrantFarmOption[];
  currentUserId?: string;
};

export function AdminUsersView({ users, farmOptions, currentUserId }: Props) {
  const [email, setEmail] = useState("");

  return (
    <>
      <GrantAccessForm
        email={email}
        onEmailChange={setEmail}
        farmOptions={farmOptions}
        users={users}
      />
      <UserTable
        users={users}
        selectedEmail={email}
        onEmailSelect={setEmail}
        currentUserId={currentUserId}
      />
    </>
  );
}
