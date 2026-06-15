# Piggy Jump 테스트 결과 (2026-06-11, 2차)

환경: `http://localhost:3000` · 로그인 `Test Admin` · Supabase `iot-cloud` migration 적용됨

## 적용 완료 항목

| 항목 | 내용 |
|------|------|
| 시작 문구 | Piggy Jump + 규칙 4줄 + SPACE/터치 힌트 |
| BGM | `public/piggy/ready-to-play-349320.mp3` 복사, proxy mp3/wav/ogg 제외 |
| 프레임 | `VIEW_SCALE_Y` 3→2, `dpr` 상한 2, 배경·무적·별 캐시 |
| BGM 버그 | `musicInterval` 선언·clear, 무적 osc `note.freq` 복원 |
| 리더보드 | 게임오버 즉시 `refreshLeaderboard()` + fetch generation 중복 방지 |
| Canvas | 1620×720 (style), 내부 버퍼 dpr 반영 |

## 시나리오 결과

| ID | 시나리오 | 결과 | 비고 |
|----|----------|------|------|
| S01 | 페이지 진입·시작 화면 | **PASS** | Canvas, SCORE/BEST, 시작 카드, 힌트, help |
| S02 | 로그인 사용자 자동 닉네임 | **PASS** | `fixedPlayer`, playerId 숨김, `Test Admin` |
| S03 | 게임 시작·기본 플레이 | **PASS** | running=true, score 증가, 장애물 스폰 |
| S04 | 키보드 점프 (Space) | **PASS** | Space 반응, score 증가 |
| S05 | 일시정지·재개 (P) | **PASS** | KeyP 핸들러 동작 (1차 세션 검증) |
| S06 | 테마 변경 | **PASS** | farm→space, localStorage `pigjump_theme_v1` |
| S07 | 장애물 충돌·진흙 | **PASS** | mud 0→3, 3회 시 gameOver |
| S08 | 게임오버·재시작 | **PASS** | GAME OVER 문구, subtitle 점수 표시 |
| S09 | 리더보드 API | **PASS** | GET ok, items≥1, mp3 HEAD 200 audio/mpeg |
| S10 | 사이드바·표시 설정 | **PASS** | (1차 세션) 오락 메뉴 토글 |

## 빌드·정적 검증

| 검사 | 결과 |
|------|------|
| `npm run build` | **PASS** (Next.js 16.2.7) |
| `npm run lint` | 기존 대시보드 5 error (piggy 외 파일), piggy 관련 warning만 |
| mp3 HTTP | **200** `audio/mpeg` |

## 알려진 이슈 (경미)

1. **Hydration 경고**: AppSidebar Image 컴포넌트 (기존, 게임 무관)
2. **G05 환풍기 무적**: RNG 의존 자동 테스트 미재현 (수동 플레이 필요)
3. **eslint game.js**: `startInvincibleMusic` unused warning (호출 경로 RNG 한정)

## 시나리오 문서

상세 정의: [piggy-test-scenarios.md](./piggy-test-scenarios.md)  
게임플레이: [piggy-gameplay-test-results.md](./piggy-gameplay-test-results.md)
