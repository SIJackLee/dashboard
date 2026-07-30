# scripts/archive — 일회성·출고 스모크 보관

활성 게이트·일상 스모크는 상위 `scripts/`에 둔다.  
여기 파일은 **과거 출고/이슈 검증용**이며 CI·`package.json`에 등록하지 않는다.

재실행이 필요하면:

```bash
cd dashboard/web
node scripts/archive/<파일명>
# 또는
npx tsx scripts/archive/<파일명>
```

대부분 **로컬 dev 서버**와 계정/환경변수가 필요하다. 결과는 `scripts/mobile-audit-output/` 등 로컬 산출물에 쓴다.

| 파일 | 당시 용도 |
|------|-----------|
| `ship-p0-gate-smoke.mjs` | P0 hydration·테마·적용·LIVE |
| `ship-p0-visibility-poll-smoke.mjs` | 탭 숨김·대량 LIVE 폴링 |
| `manual-scenarios-13562-smoke.mjs` | 수동 시나리오 1~6 자동화 |
| `diag-tab-hidden-poll.mjs` | 탭 숨김 폴링 진단 |
| `detailed-reverify.mjs` | 상세 재검증 |
| `graph-mode-card-collapse-smoke.mjs` | 그래프 모드 카드 접힘 |
| `daily-report-qa-a.mts` | 일보 QA |
| `daily-report-payload-smoke.mts` | 일보 payload 스모크 |

문서: [`docs/SCRIPTS.md`](../../docs/SCRIPTS.md) · 체크리스트 기록: [`docs/SHIP_CHECKLIST.md`](../../docs/SHIP_CHECKLIST.md)
