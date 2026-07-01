/** 로컬·CI 테스트 계정 (Supabase Auth) */
export const TEST_ACCOUNTS = {
  admin: { email: "admin@test.com", password: "admin1" },
  operator: { email: "farmer@test.com", password: "farmer" },
  viewer: { email: "viewer@test.com", password: "viewer" },
};

export const TEST_ACCOUNT_EMAILS = Object.values(TEST_ACCOUNTS).map((a) => a.email);

export function passwordForEmail(email) {
  const entry = Object.values(TEST_ACCOUNTS).find((a) => a.email === email);
  if (!entry) throw new Error(`Unknown test email: ${email}`);
  return entry.password;
}

/** service_role 클라이언트로 테스트 계정 비밀번호 동기화 */
export async function ensureTestPasswords(adminClient) {
  const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;

  for (const { email, password } of Object.values(TEST_ACCOUNTS)) {
    const user = data.users.find((u) => u.email === email);
    if (!user) throw new Error(`Missing user ${email}`);
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      user.id,
      { password }
    );
    if (updateError) throw updateError;
    console.log(`password set: ${email}`);
  }
}
