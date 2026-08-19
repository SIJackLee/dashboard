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

/** 다음 페인트 이후 신호 — 스플래시가 빈 첫 프레임을 가리지 않게. */
export function signalNavContentReadyAfterPaint(): () => void {
  if (typeof window === "undefined") return () => {};
  let inner = 0;
  const outer = window.requestAnimationFrame(() => {
    inner = window.requestAnimationFrame(() => {
      signalNavContentReady();
    });
  });
  return () => {
    window.cancelAnimationFrame(outer);
    if (inner) window.cancelAnimationFrame(inner);
  };
}
