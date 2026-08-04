# Android 앱 설치 페이지 (`/app`)

> 고정 링크: `https://smart.autofankorea.com/app`  
> 다운로드: `https://smart.autofankorea.com/app/download` (비밀번호 쿠키 후 Storage signed URL 302)

## 흐름

```
카톡 등 → /app
  → 설치 비밀번호
  → APK 다운로드 (/app/download)
  → Supabase Storage (app-releases / sungil-iot.apk) signed URL
  → 폰에 설치 → 계정 로그인 → 알림 허용
```

Play 스토어 없이 **도메인 링크 + APK 사이드로드**용입니다.

## 환경변수 (이름만)

| 변수 | 설명 |
|------|------|
| `APP_INSTALL_PASSWORD` | `/app` 잠금 해제 |
| `APP_INSTALL_COOKIE_SECRET` | (선택) 쿠키 서명 |
| `APP_APK_VERSION` | 안내 문구용 버전 표시 |
| `APP_APK_BUCKET` | 기본 `app-releases` |
| `APP_APK_OBJECT_PATH` | 기본 `sungil-iot.apk` |
| `SUPABASE_SERVICE_ROLE_KEY` | signed URL 발급 |

## Storage

- 버킷: `app-releases` (private) — migration `20260804100000_storage_app_releases.sql`
- 객체: `sungil-iot.apk`
- 공개 read 정책 없음. Next 서버만 service_role로 짧은 signed URL 발급

### APK 업로드 (Dashboard 또는 CLI)

1. release APK 빌드
2. Supabase Dashboard → Storage → `app-releases` → `sungil-iot.apk` 업로드(덮어쓰기)
3. (선택) Vercel `APP_APK_VERSION` 갱신

## 관련 코드

- `src/app/app/page.tsx`
- `src/app/app/download/route.ts`
- `src/lib/app-install/gate.ts`
- 미인증 공개: `src/lib/supabase/middleware.ts` 의 `/app`
