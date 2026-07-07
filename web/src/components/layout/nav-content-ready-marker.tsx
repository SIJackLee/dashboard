"use client";

import { useEffect } from "react";
import { signalNavContentReady } from "@/lib/navigation/nav-content-ready";

export function NavContentReadyMarker() {
  useEffect(() => {
    signalNavContentReady();
  }, []);

  return null;
}
