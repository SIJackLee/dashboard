import { cn } from "@/lib/utils";

type ControllerNameLabelProps = {
  /** 설정탭에서 부여한 사용자 지정 이름 (메타데이터). 없으면 eqpmnNo fallback */
  name?: string | null;
  eqpmnNo?: string;
  idx?: number;
  className?: string;
};

export function ControllerNameLabel({
  name,
  eqpmnNo,
  idx,
  className,
}: ControllerNameLabelProps) {
  const fallback = eqpmnNo
    ? `컨트롤러 ${eqpmnNo}`
    : idx !== undefined
      ? `컨트롤러 #${idx + 1}`
      : "컨트롤러";

  return (
    <span className={cn("font-medium", className)}>{name?.trim() || fallback}</span>
  );
}
