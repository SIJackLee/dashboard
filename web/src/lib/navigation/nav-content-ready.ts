export const NAV_CONTENT_READY_EVENT = "dashboard:nav-content-ready";

let lastSignalAt = 0;

export function getLastNavContentReadyAt(): number {
  return lastSignalAt;
}

export function signalNavContentReady() {
  if (typeof window === "undefined") return;
  lastSignalAt = Date.now();
  window.dispatchEvent(new CustomEvent(NAV_CONTENT_READY_EVENT));
}
