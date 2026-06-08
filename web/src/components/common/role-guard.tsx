// 권한 가드 골격: profiles.role / user_access.can_read·can_command 와 추후 연동.
// 지금은 표현 구조만 정의하고, 실제 권한 판정 로직은 데이터 매칭 단계에서 구현.

export type Role = "admin" | "operator" | "viewer";

type RoleGuardProps = {
  /** 허용 역할 (미지정 시 모두 허용) */
  allow?: Role[];
  /** 명령 권한 필요 여부 (user_access.can_command) */
  requireCommand?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export function RoleGuard({ children }: RoleGuardProps) {
  // TODO(데이터 매칭): 현재 사용자 role / can_command 로 분기
  return <>{children}</>;
}
