/** 손(탭)·펜·마우스 왼쪽만. 보조 클릭·비주 포인터는 무시. */
export function isPrimaryPress(e: {
  isPrimary: boolean;
  pointerType: string;
  button: number;
}): boolean {
  if (!e.isPrimary) return false;
  if (e.pointerType === "mouse") return e.button === 0;
  return true;
}
