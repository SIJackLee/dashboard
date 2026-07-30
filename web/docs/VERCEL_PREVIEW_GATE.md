# Vercel Preview 게이트 (Git→배포 검증)

> [Clean Up] 유지 · 계약 의미 변경 없음.  
> 허브 URL 정본: [`farm-hub-url.md`](./farm-hub-url.md) · 산출물 맵: [`CLEANUP_ARTIFACT_MAP.md`](./CLEANUP_ARTIFACT_MAP.md)

Git에 push되면 Vercel이 그 커밋을 빌드·배포한다. **로컬 PASS만으로 끝내지 말고**, Preview/Production URL에서도 동일 스모크가 통과해야 한다.

## 전제

| 항목 | 요구 |
|------|------|
| 브랜치 | `main` 직푸시 비권장 — `feature/…` → Preview |
| Supabase | Vercel env = 로컬 `.env.local`과 **동일 프로젝트** (테스트 계정) |
| 빌드 | `cd dashboard/web && npm run build` (Vercel과 동일). `tsconfig`에 `scripts` **exclude** (미추적 스크립트가 타입체크에 끼지 않게) |
| 승인 | **push / merge / 삭제 / migration 적용**은 사용자 승인 후 |

## 절차

1. **feature 브랜치**에 관련 산출물만 커밋 (셸 예: `feature/farm-hub-url`)  
2. **push 승인** → Vercel Preview 생성  
3. Preview URL로 스모크:

```bash
cd dashboard/web
UI_VERIFY_BASE=https://<preview>.vercel.app node scripts/farm-hub-url-manual-smoke.mjs
```

4. 통과 시 MR/머지 → Production에서도 **동일 명령**으로 재확인  

## 셸 스모크가 보는 것

`scripts/farm-hub-url-manual-smoke.mjs` — 탭·URL·soft home 등 (단위 테스트와 별개).  
로컬: `UI_VERIFY_BASE=http://localhost:3000` (또는 해당 포트).

## Agent 범위 밖 (참고만)

| 이슈 | 담당 |
|------|------|
| 기간 변경 줌 리셋 UX | [디자인 & 애니메이션] |
| soft home 후 ARIA 도크/오브 상태 | [프로토콜] |
