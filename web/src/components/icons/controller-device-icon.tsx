import { forwardRef, useId, type SVGProps } from "react";
import { cn } from "@/lib/utils";

export type ControllerDeviceIconProps = SVGProps<SVGSVGElement> & {
  /** Lucide 호환 — className size-* 가 우선일 때는 생략 */
  size?: number | string;
  absoluteStrokeWidth?: boolean;
  /**
   * 우하단 번호 오버레이용 — 해당 영역을 마스크로 비움
   * (숫자와 스트로크·키패드가 겹치지 않게).
   */
  numberCutout?: boolean;
};

/**
 * 회사 컨트롤러 실루엣 (단순화 B안).
 * Lucide와 같이 currentColor 스트로크 — 툴바·카드·투어 안내 공통.
 */
export const ControllerDeviceIcon = forwardRef<
  SVGSVGElement,
  ControllerDeviceIconProps
>(function ControllerDeviceIcon(
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
  const maskId = `ctrl-num-cut-${rawId}`;
  const sw =
    typeof strokeWidth === "number" ? strokeWidth : Number(strokeWidth) || 1.75;

  const body = (
    <>
      {/* 외곽 */}
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      {/* 상단 브랜드 바 */}
      <path d="M5.5 6.5h13" strokeWidth={sw + 0.25} />
      {/* 좌 스위치 */}
      <rect x="5.5" y="9" width="4" height="8" rx="1" />
      <path d="M7.5 11v2.5" />
      {/* 화면 */}
      <rect x="12" y="9" width="6.5" height="3.5" rx="0.9" />
      {/* 키패드 2×3 */}
      <circle cx="13.2" cy="15.1" r="0.85" fill={color} stroke="none" />
      <circle cx="15.25" cy="15.1" r="0.85" fill={color} stroke="none" />
      <circle cx="17.3" cy="15.1" r="0.85" fill={color} stroke="none" />
      <circle cx="13.2" cy="17.15" r="0.85" fill={color} stroke="none" />
      <circle cx="15.25" cy="17.15" r="0.85" fill={color} stroke="none" />
      <circle cx="17.3" cy="17.15" r="0.85" fill={color} stroke="none" />
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
            {/* 숫자 글리프 근처만 살짝 비움 — 큰 면 컷아웃 금지 */}
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
});
