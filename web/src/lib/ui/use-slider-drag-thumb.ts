"use client";

import { useCallback, useEffect, useState } from "react";

export type SliderDragThumb = "low" | "high" | null;

/** dual range — pointerdown 시 active thumb, pointerup/cancel 시 해제 */
export function useSliderDragThumb() {
  const [dragThumb, setDragThumb] = useState<SliderDragThumb>(null);

  useEffect(() => {
    if (dragThumb === null) return;
    const clear = () => setDragThumb(null);
    window.addEventListener("pointerup", clear);
    window.addEventListener("pointercancel", clear);
    return () => {
      window.removeEventListener("pointerup", clear);
      window.removeEventListener("pointercancel", clear);
    };
  }, [dragThumb]);

  const onLowPointerDown = useCallback(() => setDragThumb("low"), []);
  const onHighPointerDown = useCallback(() => setDragThumb("high"), []);

  return {
    dragThumb,
    dragging: dragThumb !== null,
    onLowPointerDown,
    onHighPointerDown,
  };
}
