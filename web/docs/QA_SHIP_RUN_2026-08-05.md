# 출고마다 검수 실행 기록 — 2026-08-05

| 항목 | 값 |
|------|-----|
| 일자 | 2026-08-05 (KST) |
| Commit (시작) | `42338e7` (`42338e71e783e923f7a1c0f02b540448d2d53519`) = `origin/main` |
| 프로필 | **출고마다** |
| 웹 대상 | `http://localhost:3000` + FARM01/P00 LIVE 시뮬 (`sim_pilot_farm01.py` 가동) |
| 운영 대상 | `https://smart.autofankorea.com` |
| 출고 범위 | 현재 `main` 기능 전부 / 신규 미포함 없음 |
| 검수자 | Agent (자동) + 로컬/운영 스모크 |

## 판정 요약

| 항목 | 값 |
|------|-----|
| **판정** | **CONDITIONAL GO** → P2-2 해제 후 **GO 후보** (실기기 설치만 사용자 확인) |
| P0 | 0 |
| P1 | 0 |
| P2 | 1 잔여(실기기) · P2-1 미커밋 · P2-2 오탐 해제 · P2-3 다운로드 PASS |
| 승인자 | (사용자 서명 대기) |

---

## Phase 결과

| Phase | 결과 | 증적 |
|-------|------|------|
| Prep | **PASS** | SHA=`42338e7`, LIVE 시뮬·`npm run dev` 가동 확인 |
| A 정적 | **PASS*** | lint 0 / tsc 0 / build 0 / 비밀 하드코딩 0 (*로컬 타입 수정 후; 아래 P2-1) |
| B 스모크·권한 | **PASS** | `audit:ship-checklist` admin/operator/viewer 전부 ok · [ship-checklist-report.json](../scripts/mobile-audit-output/ship-checklist-report.json) |
| C 데이터 표본 | **PASS** | 목록 LIVE: 임신사 등 표시, 표본 약 25.7℃ / 57.5% · [ship-gate-ce-report.json](../scripts/mobile-audit-output/ship-gate-ce-report.json) |
| D 명령 추적 | **PASS** | operator 적용 → `명령 등록 · 전송 대기`, setpoint 24 · viewer 경로 ship에서 차단 |
| E DELIN/ARIA | **PASS** | 재검수: 로그인 전이 **미재현**(오탐). ask 200, `/farm` 유지 |
| F Android | **PASS*** | `/app` 해제·APK 다운로드 local+prod PASS · *실기기 설치만 수동 잔여* |
| G 최종 | **CONDITIONAL GO** | P0/P1=0 · 잔여: tsc 미커밋(P2-1) + 실기기(P2-3 일부) |

\* = 조건/잔여 이슈 있음

### A 상세

| 항목 | 결과 |
|------|------|
| `npm run lint` | PASS (error 0) |
| `npx tsc --noEmit` | PASS (수정 후) |
| `npm run build` | PASS |
| 비밀 스캔 | PASS — `.env*` gitignore, 소스에 키 리터럴 없음 (env 이름·가이드 문구만) |

초기 tsc 실패 → 로컬 수정:

- `farm/page.tsx`: `user` null 가드 후 `canEditFarmScope`
- `delin-enabled.test.ts`: `NODE_ENV` 대입 방식
- `situation-alarms.test.ts` / `daily-report-alarms.test.ts`: `"ok"` → `"normal"`

**이 수정은 아직 `main`에 미커밋.**

### B 상세

```json
{ "ok": true, "results": [
  { "role": "admin", "ok": true },
  { "role": "operator", "ok": true, "ack": "명령 등록 · 전송 대기", "setpoint": 24 },
  { "role": "viewer", "ok": true }
]}
```

SHIP 수동 시나리오 2·3·4·8은 이번 출고마다에서 생략(계획서). 핵심 권한·적용은 자동화로 충족.

### C·D 상세

- C: FARM01 목록에 축사·온도·습도·모터% 표시. `0`/대시 표현 공존(채널 공란 등) — 정상값 오인 패턴 없음.
- D: ship operator 1회 적용 + ack 문자열로 전송 추적 확인. viewer ship PASS.

### E 상세

- `delin-enabled`: development 기본 on, production(VERCEL production + NODE_ENV production) 기본 off — **PASS**
- 로컬 `view=aria`: DELIN 크롬 표시, 내부 필드명 미노출
- 「글로 묻기」 후 질의: 스크립트상 `asked=true`, 환각·내부 ID 없음. 다만 응답 관찰 시 **로그인 화면 문구**가 잡혀 세션/네비게이션 이슈 가능 → P2-2
- 운영: 익명 `/farm` 307(로그인) — DELIN 공개 노출 없음

### F 상세

| 항목 | 결과 |
|------|------|
| `https://smart.autofankorea.com/app` | 200, 설치 UI 구성됨 |
| 버전 라벨 | `latest` |
| 비밀번호 게이트 | 있음 → **해제 성공**(local·prod) |
| `/app/download` | 307 → Supabase signed URL → APK **8,202,607 bytes**, ZIP/APK magic OK |
| 실기기 설치·로그인 | **잔여 수동** (담당자 폰) |

증적: `scripts/mobile-audit-output/p2-3-app-download-report.json` (gitignore).

### P2-2 / P2-3 수동 재검수 (2026-08-05 10:18+)

- P2-2: `node scripts/p2-2-delin-redirect.mjs` → **PASS** (오탐 해제)
- P2-3: `node scripts/p2-3-app-download.mjs` → prod/local **다운로드 PASS**; 실기기는 아래 체크

**실기기 (사용자)**

- [ ] 받은 APK 설치
- [ ] 로그인
- [ ] 알림 권한 안내 가능

---

## 결함 목록

| ID | 심각도 | 단계 | 제목 | 조치 |
|----|--------|------|------|------|
| DASH-QA-001 | **P2** | A | `main` HEAD 기준 tsc 오류 4건(페이지 null user·테스트 타입) | 로컬 수정 완료 → **커밋·push 필요** |
| DASH-QA-002 | ~~P2~~ → **해제** | E | DELIN 질의 후 로그인 전이 | **2026-08-05 재검수 PASS** — URL 유지·`/api/voice-report/ask` 200·답변 정상. 1차 CE 스크립트는 body 스캔 오탐(로그인 문구 오인). 증적: `scripts/mobile-audit-output/p2-2-delin-redirect-report.json` |
| DASH-QA-003 | **P2(부분)** | F | APK 다운로드·버전 | **다운로드 PASS** (local+prod 해제→307→APK ~8.2MB ZIP magic, 버전 `latest`). 증적: `p2-3-app-download-report.json`. **실기기 설치·로그인**만 담당자 수동 잔여 |

---

## 출고마다 체크리스트 대응

### A 범위·정적 — PASS*
- [x] 범위·commit 고정
- [x] lint / tsc / build
- [x] 비밀 하드코딩 없음

### B 스모크·권한 — PASS
- [x] ship-checklist + 역할 3종

### C 데이터 — PASS
- [x] 온도·습도·모터 표본
- [x] 0/없음/단절 구분(목록 관찰)
- [x] 장비–축사 연결(FARM01 LIVE)

### D 명령 — PASS
- [x] 상태 추적(ack)
- [x] viewer 미송신(ship)
- [~] 중복 클릭 — ship 단일 적용만 (연타 전용은 미실시 → 잔여 수동)

### E DELIN — PASS*
- [x] 탭·표면
- [x] 내부 ID 미노출
- [x] 적용 환각 없음
- [x] production 기본 off

### F Android — PASS*
- [x] `/app` 동작
- [~] 다운로드·버전 정합 — `latest` 표시까지, 파일 정합 BLOCKED
- [ ] 실기기 설치 BLOCKED

### G — CONDITIONAL GO
- [x] P0=0 P1=0
- [x] P2 기록·담당(개발)·기한: 차기 근무일
- [x] 판정: **CONDITIONAL GO**

---

## 다음 액션 (승인 시)

1. tsc 수정분 커밋·`main` push  
2. DELIN 질의 후 로그인 전이 재현(Chrome 수동)  
3. `/app` 비밀번호로 APK 받아 버전·설치 확인  

메이저/분기 프로필은 이번 회차 제외.
