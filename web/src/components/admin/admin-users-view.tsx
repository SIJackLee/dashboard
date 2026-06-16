"use client";

import { useState } from "react";
import type { ManagedUser } from "@/lib/admin/list-users";
import type { GrantFarmOption } from "./grant-access-form";
import { GrantAccessForm } from "./grant-access-form";

type Props = {
  users: ManagedUser[];
  farmOptions: GrantFarmOption[];
};

export function AdminUsersView({ users, farmOptions }: Props) {
  const [email, setEmail] = useState("");

  return (
    <GrantAccessForm
      email={email}
      onEmailChange={setEmail}
      farmOptions={farmOptions}
      users={users}
    />
  );
}
