import {
  getCurrentUser,
  canCommand as canCommandFn,
  type Role,
} from "@/lib/auth/get-current-user";

type RoleGuardProps = {
  /** 허용 역할 (미지정 시 역할 제한 없음) */
  allow?: Role[];
  /** 명령 권한(can_command) 필요 여부 */
  requireCommand?: boolean;
  children: React.ReactNode;
  /** 권한 미충족 시 대체 렌더 (기본: 아무것도 표시 안 함) */
  fallback?: React.ReactNode;
};

// 서버 컴포넌트: 현재 사용자 role / can_command 로 노출 제어.
export async function RoleGuard({
  allow,
  requireCommand,
  children,
  fallback = null,
}: RoleGuardProps) {
  const user = await getCurrentUser();

  if (!user) return <>{fallback}</>;

  if (allow && (!user.role || !allow.includes(user.role))) {
    return <>{fallback}</>;
  }

  if (requireCommand && !canCommandFn(user)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
