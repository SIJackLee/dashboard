import { forwardRef, useId, type SVGProps } from "react";
import { cn } from "@/lib/utils";

export type StallUnitIconProps = SVGProps<SVGSVGElement> & {
  /** Lucide 호환 — className size-* 가 우선일 때는 생략 */
  size?: number | string;
  absoluteStrokeWidth?: boolean;
  /**
   * 우하단 번호 오버레이용 — 해당 영역을 마스크로 비움
   * (숫자와 문·창 스트로크가 겹치지 않게).
   */
  numberCutout?: boolean;
};

/**
 * 축사(칸) 실루엣 — 박공 지붕 창고 (A안).
 * Lucide와 같이 currentColor 스트로크 — 맵·카드·스코프 공통.
 */
export const StallUnitIcon = forwardRef<SVGSVGElement, StallUnitIconProps>(
  function StallUnitIcon(
    {
      className,
      size = 24,
      color = "currentColor",
      strokeWidth = 1.75,
      absoluteStrokeWidth: _absoluteStrokeWidth,
      numberCutout = false,
      ...props
    },
    ref,
  ) {
    const rawId = useId().replace(/:/g, "");
    const maskId = `stall-num-cut-${rawId}`;
    const sw =
      typeof strokeWidth === "number" ? strokeWidth : Number(strokeWidth) || 1.75;

    const body = (
      <>
        <path d="M4 10.5L12 4l8 6.5" />
        <path d="M6 10.5V19h12v-8.5" />
        <path d="M10 19v-5h4v5" />
        <path d="M8 13h2M14 13h2" strokeWidth={Math.max(1.25, sw - 0.25)} />
      </>
    );

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("shrink-0", className)}
        aria-hidden
        {...props}
      >
        {numberCutout ? (
          <defs>
            <mask
              id={maskId}
              maskUnits="userSpaceOnUse"
              x={0}
              y={0}
              width={24}
              height={24}
            >
              <rect x={0} y={0} width={24} height={24} fill="white" />
              <rect
                x={14.5}
                y={16.2}
                width={8.2}
                height={6.5}
                rx={1}
                fill="black"
              />
            </mask>
          </defs>
        ) : null}
        {numberCutout ? <g mask={`url(#${maskId})`}>{body}</g> : body}
      </svg>
    );
  },
);
