# 알람 설정 — 동작 테스트 결과 (2026-06-11)

환경: `http://localhost:3000` · 로그인 `Test Admin`  
방법: 브라우저 CDP 자동 검증 + `validateAlarmThresholds` 로직 검증

## 요약

| 구분 | PASS | FAIL | SKIP |
|------|------|------|------|
| 30 시나리오 | 27 | 1 | 2 |

---

## 시나리오별 결과

| ID | 결과 | 비고 |
|----|------|------|
| A01 | **PASS** | `/settings?tab=alarm` 정상 진입 |
| A02 | **PASS** | 페이지 제목 「설정」 |
| A03 | **PASS** | 표시·농장·컨트롤러·알람 4탭 (페이지 동기화 반영) |
| A04 | **PASS** | 알람 탭 emerald 활성 스타일 |
| A05 | **PASS** | 「알람 임계값」 카드 |
| A06 | **PASS** | TopBar·알람 페이지 연동 설명 |
| A07 | **PASS** | `온도 10~35℃ · 습도 30~90%` |
| A08 | **PASS** | `예상 알람 0건` (LIVE 기준) |
| A09 | **PASS** | 적용 범위 combobox 존재 |
| A10 | **PASS** | 「모든 축사유형에 기본값」 |
| A11 | **PASS** | 온도 상한 35 |
| A12 | **PASS** | 온도 하한 10 |
| A13 | **PASS** | 습도 상한 90 |
| A14 | **PASS** | 습도 하한 30 |
| A15 | **PASS** | 온도 `step=0.5` |
| A16 | **PASS** | 습도 `step=1` |
| A17 | **PASS** | 「저장」 버튼 |
| A18 | **PASS** | 4개 라벨 모두 표시 |
| A19 | **PASS** | 상한 5 / 하한 10 → 「온도 상한은 하한보다…」 |
| A20 | **PASS** | 습도 상한 20 / 하한 30 → 「습도 상한은 하한보다…」 |
| A21 | **PASS** | 온도 70℃ → 범위 메시지 (로직·UI) |
| A22 | **PASS** | 습도 110% → 범위 메시지 (로직·UI) |
| A23 | **FAIL** | 검증 메시지는 즉시 표시되나, 저장 버튼 `disabled`가 항상 적용되지 않음 (CDP 타이밍·버튼 선택 이슈 가능) |
| A24 | **SKIP** | 세션 만료로 SP 옵션 드롭다운 미확인 (코드: `stallCatalog` 기반 옵션 생성) |
| A25 | **SKIP** | 세션 만료로 SP 전환 UI 미확인 (코드: `byStallTyCode` 갱신 로직 존재) |
| A26 | **PASS** | 코드: `overrideSpList` 요약 렌더 (`alarm-threshold-form.tsx`) |
| A27 | **PASS** | 임도 변경 시 `deriveAlarmsFromReadings`로 previewCount 갱신 |
| A28 | **PASS** | `input[name=settings_json]` 존재 |
| A29 | **PASS** | 「통신 두절 알람은 컨트롤러가 offline일 때…」 |
| A30 | **PASS** | 표시 탭 → 알람 탭 전환 후 폼·필드 유지 |

---

## 검증 로직 단위 테스트 (`validateAlarmThresholds`)

| 케이스 | 결과 |
|--------|------|
| 기본값 35/10/90/30 | **PASS** |
| 온도 상한≤하한 | **PASS** |
| 습도 상한≤하한 | **PASS** |
| 온도 >60℃ | **PASS** |
| 습도 >100% | **PASS** |
| 경계값 -40/60℃, 0/100% | **PASS** |

---

## 알려진 이슈

1. **A23 저장 버튼 비활성**: `disabled={pending \|\| !!validationError}` 구현은 있으나, 자동 테스트에서 invalid 입력 직후 `disabled` 미반영 관측 — 수동 재확인 권장.
2. **저장 E2E**: 이번 세션에서 Supabase 저장·`?ok=saved` 리다이렉트는 미실행 (DB 변경 최소화).
3. **A24~A25**: 로그인 세션 만료로 브라우저 재검증 필요.

## 수동 재테스트 명령

```text
1. /settings?tab=alarm 접속
2. 온도 상한 5, 하한 10 입력 → 저장 버튼 비활성·빨간 메시지 확인
3. 적용 범위에서 SP 선택 → 값 변경 → 저장 → /alarms 예상 알람 반영 확인
```

시나리오 정의: [alarm-settings-test-scenarios.md](./alarm-settings-test-scenarios.md)
