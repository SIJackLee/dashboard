# Android 네이티브 OAuth (Google + 카카오) — Phase 1

> **범위:** Capacitor Android 앱에서 Google / 카카오 네이티브 SDK → Supabase `signInWithIdToken`.  
> **브라우저:** 기존 `signInWithOAuth` 유지 (`oauth-buttons.tsx`가 플랫폼 분기).

## 흐름

```
[앱 로그인 버튼]
   ├─ Android: SocialLogin(Google) / KakaoLogin → id_token
   │            → supabase.auth.signInWithIdToken
   │            → finalizeNativeOAuthLogin → /auth/enter
   └─ Web:     getOAuthSignInUrl → /auth/callback (기존)
```

| 제공자 | 플러그인 | 토큰 |
|--------|----------|------|
| Google | `@capgo/capacitor-social-login` | `idToken` |
| 카카오 | `@chuseok22/capacitor-kakao-login` (+ patch: `idToken` 반환) | `idToken` (OIDC 필수) |

패치: `patches/@chuseok22+capacitor-kakao-login+0.3.0.patch` (`postinstall`로 적용)

## 환경변수

`.env.local` / Vercel (이름은 `.env.example` 참고):

| 이름 | 용도 |
|------|------|
| `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google **웹** 클라이언트 ID (Android에서도 server client ID로 사용) |
| `NEXT_PUBLIC_KAKAO_NATIVE_APP_KEY` 또는 `KAKAO_NATIVE_APP_KEY` | 카카오 **네이티브 앱 키** (`capacitor.config` + Android placeholder) |

`android/local.properties` (git 제외)에도 동일 키를 둘 수 있다:

```properties
KAKAO_NATIVE_APP_KEY=<네이티브앱키>
```

## 콘솔 설정 (에이전트가 대신 로그인할 수 없음 — 계정 소유자 작업)

### Google Cloud / Firebase (`sungil-iot-dashboard`)

1. [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials) 또는 Firebase 프로젝트 설정.
2. **OAuth 클라이언트 ID (웹 애플리케이션)** 생성 → `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID`에 넣기.
3. **OAuth 클라이언트 ID (Android)** 생성  
   - 패키지: `com.autofankorea.dashboard`  
   - 디버그 SHA-1 (이 PC에서 추출): `7E:9A:4E:D1:D0:5B:9E:EB:EF:66:91:07:54:C6:57:A3:A2:38:E5:4F`  
   - 릴리즈 APK는 서명 키스토어 SHA-1을 추가로 등록.
4. Firebase에 SHA-1 등록 후 `google-services.json` 재다운로드 (현재 `oauth_client`가 비어 있음).
5. Supabase Dashboard → Auth → Providers → Google: Web client ID / secret 확인.

### 카카오 개발자

1. [developers.kakao.com](https://developers.kakao.com) → 앱 → **플랫폼 → Android**  
   - 패키지: `com.autofankorea.dashboard`  
   - 키 해시 (디버그): `fppO0dBbnuvvZpEHVMZXo6I45U8=`
2. **카카오 로그인 ON** + **OpenID Connect ON** (id_token 발급 필수).
3. 동의 항목: 닉네임 / 이메일(선택).
4. 네이티브 앱 키를 `KAKAO_NATIVE_APP_KEY`에 설정.
5. Supabase Kakao provider:  
   - 웹 OAuth용 REST API 키는 기존 유지.  
   - **네이티브 `signInWithIdToken`의 `aud`는 네이티브 앱 키**와 맞아야 한다.  
     실패 시 Dashboard Client ID를 네이티브 앱 키로 맞추거나, 웹/앱 키 정책을 분리해 검토한다 ([supabase/auth#1755](https://github.com/supabase/auth/issues/1755)).

## 빌드

```bash
# 웹 배포에 Google/Kakao env 반영 후
npm run cap:sync
# Android Studio에서 APK 빌드·설치
npm run cap:open
```

## 검증

1. 앱 로그인 화면에서 Google → 계정 선택 UI(Credential Manager) → `/farm` 또는 `/pending`.
2. 카카오 → 카카오톡 앱(또는 계정) 로그인 → 동일.
3. 브라우저에서는 기존처럼 시스템/탭 OAuth.

## 롤백

- `oauth-buttons` 네이티브 분기 제거 또는 Feature로 감싸기.
- 플러그인 uninstall + `cap sync`.
- 패치 파일 삭제 시 카카오는 `idToken` 미반환으로 네이티브 경로 실패.
