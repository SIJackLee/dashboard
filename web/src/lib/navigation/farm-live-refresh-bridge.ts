/**
 * TopBar(로고) ↔ FarmLiveRefreshProvider 브리지.
 * Provider는 PageShell 밖 TopBar보다 아래(children)에 있어 context로 못 연결함.
 */
type FarmLiveRefreshHandler = () => void | Promise<void>;

let handler: FarmLiveRefreshHandler | null = null;

export function registerFarmLiveRefreshHandler(
  next: FarmLiveRefreshHandler | null,
): void {
  handler = next;
}

export async function requestFarmLiveRefresh(): Promise<void> {
  if (!handler) return;
  await handler();
}

export function hasFarmLiveRefreshHandler(): boolean {
  return handler != null;
}
