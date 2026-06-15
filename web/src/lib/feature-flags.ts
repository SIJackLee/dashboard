/** Piggy Jump /play — 일시 비활성화 시 false */
export const PIGGY_PLAY_ENABLED = false;

export function isPiggyPlayEnabled(displayPiggyMenu = false): boolean {
  return PIGGY_PLAY_ENABLED && displayPiggyMenu;
}
