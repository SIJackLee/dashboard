# 출고 게이트 축소판 (프로필)

> 출고 때 **실제로 돌리는 짧은 게이트**. 전수 정의·태그 정본은 [`QA_PRE_RELEASE.md`](./QA_PRE_RELEASE.md).  
> 스모크 실행 본체는 [`SHIP_CHECKLIST.md`](./SHIP_CHECKLIST.md).

## 태그 의미

| 태그 | 의미 | 프로필 |
|------|------|--------|
| **필수** | 미충족 시 원칙적으로 `NO-GO` | **출고마다**에 포함 |
| **권장** | 메이저 변경·위험 구간에서 필수화 | **메이저**에 포함 |
| **후속** | 분기·대규모 또는 잔여 개선 | **분기**에 포함 |

마스터(`QA_PRE_RELEASE`) 체크에도 동일 태그가 달려 있다. 이 문서는 **실행 순서와 증적**만 모은다.

---

## 프로필 요약

| 프로필 | 언제 | 판정 최소선 |
|--------|------|-------------|
| **출고마다** | main 배포·고객 전달 직전 | P0/P1 = 0 · 아래 필수 전부 전부 PASS |
| **메이저** | 제어·권한·데이터 파이프·허브 구조 변경 | 출고마다 + 권장 묶음 |
| **분기** | 분기 품질·대규모 리팩터·용량 확대 | 메이저 + 후속 묶음 |

---

## 출고마다 (필수)

체크 전 고정: Git commit SHA · 대상 URL(prod/preview) · 시뮬 LIVE(FARM01) · 검수자·일자.

### A. 범위·정적 (0 · 2)

- [ ] **필수** 출고 범위(포함/제외)·commit이 고정됨 — [`QA_PRE_RELEASE`](./QA_PRE_RELEASE.md) 0단계
- [ ] **필수** `npm run lint` 오류 0
- [ ] **필수** `npx tsc --noEmit` (또는 프로젝트 typecheck) 오류 0
- [ ] **필수** `npm run build` 성공
- [ ] **필수** 비밀키·테스트 계정 하드코딩 없음 (코드 리뷰/검색)

### B. 스모크 · 권한 (3 · 11 · SHIP)

- [ ] **필수** [`SHIP_CHECKLIST.md`](./SHIP_CHECKLIST.md) — `npm run audit:ship-checklist` + 역할별 핵심 수동 항목
- [ ] **필수** admin / operator / viewer 권한·메뉴·명령 차단이 서버까지 일치
- [ ] **필수** URL·API 직접 호출로 타 농장·운영 경로 우회 불가

### C. 데이터 표본 (4)

표본: LIVE 컨트롤러 1대 이상. 원시(시뮬/DB) → API/화면 값·단위·시각 대조.

- [ ] **필수** 온도·습도·모터(%) 최신값이 원시/저장과 일치
- [ ] **필수** 실제 `0` / 데이터 없음 / 수신 지연·단절 UI가 구분됨
- [ ] **필수** 장비 ID가 올바른 농장·축사·컨트롤러에 연결됨

### D. 명령 추적 (5)

operator 계정 · 설정온도 또는 일괄 적용 1회.

- [ ] **필수** 명령에 대상 장비·상태가 추적됨 (전송→대기→성공/실패)
- [ ] **필수** 중복 클릭으로 의도치 않은 중복 실행이 없음
- [ ] **필수** 실패·타임아웃을 성공으로 표시하지 않음
- [ ] **필수** 무권한(viewer)에서 명령이 실제로 나가지 않음

### E. DELIN / ARIA (3 · 6)

- [ ] **필수** ARIA 탭 진입·질의(또는 companion) 후 답변 표면이 깨지지 않음
- [ ] **필수** 답변·화면 문구에 내부 ID/영문 필드명이 노출되지 않음 ([`aria-protocol.md`](./aria-protocol.md))
- [ ] **필수** CTRL 추천만 하고 “적용했다” 환각·무단 명령 전송이 없음
- [ ] **필수** production에서 DELIN 게이트(기본 off 등) 정책이 문서/환경과 일치

### F. Android 배포 가능 (7 · 12)

증적: `/app` 접속 · 버전 표시 · 다운로드 가능 여부. 상세 [`android-app-install.md`](./android-app-install.md).

- [ ] **필수** `https://smart.autofankorea.com/app` (또는 이번 출고 URL) 설치 페이지 동작
- [ ] **필수** APK 다운로드(비밀번호·signed URL) 성공 · 객체/버전이 **이번 출고와 맞음**
- [ ] **필수** 업로드된 APK가 최신 release 빌드임 (빌드일·`APP_APK_VERSION` 확인)
- [ ] **필수** 설치 후 로그인·푸시 권한 안내가 가능한 수준으로 동작 ([`android-push.md`](./android-push.md) 요약)

### G. 최종 (14)

- [ ] **필수** P0 = 0 · P1 = 0
- [ ] **필수** 잔여 P2에 영향·우회·담당·기한 기록
- [ ] **필수** 판정: `GO` / `CONDITIONAL GO` / `NO-GO` + 승인자

**출고마다 최소 명령 예시**

```bash
cd dashboard/web
npm run lint
npm run build
# dev + LIVE 시뮬 후
npm run audit:ship-checklist
```

---

## 메이저 (+권장)

출고마다 전부 PASS 후 추가.

- [ ] **권장** 경계·경쟁(늦은 응답·화면 이탈) 표본 — 마스터 3단계
- [ ] **권장** 비정상 데이터(누락·역순·지연) 주입 1세트 — 4단계
- [ ] **권장** 단절·재연결 후 중복 구독/값 후퇴 없음 — 5·10단계
- [ ] **권장** 배포 smoke · 롤백 절차 확인 — [`CLOUD_DEPLOY.md`](./CLOUD_DEPLOY.md) · 12단계
- [ ] **권장** 모션 토큰·reduced-motion — `npm run verify:motion-tokens` / [`UI_MOTION.md`](./UI_MOTION.md)
- [ ] **권장** 허브 keep-alive·URL — `npm run verify:hub` / [`HUB_STABILITY_P0.md`](./HUB_STABILITY_P0.md)
- [ ] **권장** 성능 스냅샷 — [`PERF_BASELINE.md`](./PERF_BASELINE.md)

---

## 분기 (+후속)

메이저 전부 검토 후 추가.

- [ ] **후속** 접근성·배율·브라우저 매트릭스 전수 — 7단계
- [ ] **후속** 부하·8h/24h 장시간 — 9단계
- [ ] **후속** 백업 복원 실시험 · RPO/RTO — 12단계
- [ ] **후속** 제3자 문서만 재현 · RTM 100% — 1·13단계
- [ ] **후속** 의존성 취약점 전수 조치 주기 점검 — 2·11단계

---

## 판정 기록 (출고마다 복사)

| 항목 | 값 |
|------|-----|
| 일자 | |
| Commit | |
| URL | |
| 프로필 | 출고마다 / 메이저 / 분기 |
| 판정 | GO / CONDITIONAL GO / NO-GO |
| P0 / P1 / P2 | |
| 차단 사유 | |
| 승인자 | |

결함 상세 양식은 마스터 [`QA_PRE_RELEASE.md`](./QA_PRE_RELEASE.md) «검수 결함 기록 양식»을 사용한다.
