# Vercel Preview 게이트 (Git→배포 검증)

> **배포 실행:** 단일 에이전트 (`SI1/.cursor/rules/single-agent.mdc`).  
> 허브 URL 정본: [`farm-hub-url.md`](./farm-hub-url.md) · 산출물 맵: [`CLEANUP_ARTIFACT_MAP.md`](./CLEANUP_ARTIFACT_MAP.md)

Git에 push되면 Vercel이 **그 커밋만** 빌드·배포한다.  
로컬 dirty / 미추적 파일은 배포본에 **없다**. Preview/Production에서도 타 Agent 결과가 보여야 한다.

## 전제

| 항목 | 요구 |
|------|------|
| 반영 범위 | 셸·디자인·ARIA 등 **의도한 산출물이 커밋에 전부** 포함 (stub·반쪽 import 금지) |
| 브랜치 | 가능하면 `feature/…` → Preview → main (긴급 hotfix는 clean build 후 main) |
| Supabase | Vercel env = 로컬 `.env.local`과 **동일 프로젝트** (테스트 계정) |
| 빌드 | **clean tree**에서 `npm run build` (로컬 dirty PASS만으로 충분치 않음). `tsconfig` `scripts` exclude |
| migration | SQL은 커밋에 넣되 **DB 적용은 별도 승인**. ARIA/`farm_name` 4건은 **iot-cloud 적용 완료**(2026-07-30 확인) |

## 완전 반영 체크 (push 전)

1. import 대상 파일이 같은 커밋/브랜치에 있는가 (`Module not found` 방지)  
2. 새 토큰·CSS·`motionClass`·env example이 같이 가는가  
3. UI가 stub/플레이스홀더로 남아 “작동안 함”처럼 보이지 않는가  
4. clean worktree `npm run build` PASS  
5. 보고에 **포함 Agent** (셸/디자인/ARIA/…)를 명시  

## 절차

1. feature(또는 hotfix)에 **완전 세트** 커밋  
2. push → Vercel Preview/Production  
3. 스모크 예:

```bash
cd dashboard/web
UI_VERIFY_BASE=https://<preview-or-prod>.vercel.app node scripts/farm-hub-url-manual-smoke.mjs
```

ARIA는 탭에서 오브·도크·말하기 UI가 보이는지 추가로 확인.

4. Production 도메인 예: `https://smart.autofankorea.com`

## 셸 스모크

`scripts/farm-hub-url-manual-smoke.mjs` — 탭·URL·soft home.  
로컬: `UI_VERIFY_BASE=http://localhost:3000`

## Agent 범위 밖 (참고만)

| 이슈 | 담당 |
|------|------|
| 기간 변경 줌 리셋 UX | [디자인 & 애니메이션] |
| `listMode=channel`→`graph` URL 정규화 (#4) | [셸] 수정 · **Designer 배포** (정규화 hunk만, 디자인 dirty 분리) |
| soft home 후 ARIA 도크/오브 상태 | [프로토콜] |
| 판단 프로토콜·UNPACK 의미 | [프로토콜] |
