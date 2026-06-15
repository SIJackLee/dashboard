"use client";

import { useNavigationPendingContext } from "@/components/layout/navigation-pending-provider";

export function useAppNavigate() {
  return useNavigationPendingContext();
}
