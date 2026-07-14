"use client";

import { LoginForm } from "@/components/login/login-form";
import { useAppNavigate } from "@/components/layout/use-app-navigate";

type LoginFormWithNavProps = {
  initialError?: string | null;
};

export function LoginFormWithNav({ initialError }: LoginFormWithNavProps) {
  const { navigate } = useAppNavigate();

  return (
    <LoginForm
      initialError={initialError}
      onSuccessNavigate={async (nextPath) => {
        navigate(nextPath, {
          waitForContentReady: true,
          variant: "brand",
        });
      }}
    />
  );
}
