# 페이지 UI 표시 설정 — 사이클 테스트 결과 (2026-06-11)

환경: `http://localhost:3001` (production build) · 로그인 `Test Admin`  
방법: 설정 OFF → 대상 페이지 UI·레이아웃 확인 → 설정 ON → 복원 확인

## 사이클 정의

1. **동작 설정** — 설정 → 표시에서 해당 체크박스 OFF 후 저장  
2. **UI 확인** — 대상 페이지에서 요소 숨김·대체 문구 확인  
3. **검증 완료** — TopBar·헤더 높이·가로 overflow·크래시 페이지 없음  
4. **동작 해제** — 동일 설정 ON 후 저장, 요소 복원 확인  

테스트 종료 시 **모든 표시 설정 ON** 상태로 복원함.

---

## 요약

| 구분 | PASS | FAIL | 비고 |
|------|------|------|------|
| 표시 설정 13건 | 12 | 0 | F03 수정 후 재검증 PASS |
| | | | C02는 프로브 기준 FAIL, 실동작 PASS |
| 인터랙티브 UI 3건 | 3 | 0 | 농장 탭은 URL 직접 전환으로 검증 |

---

## 표시 설정 — 시나리오별

| ID | 설정 | 페이지 | OFF | ON | 레이아웃 | 결과 |
|----|------|--------|-----|-----|----------|------|
| F01 | 농장 지도 | `/farm` | 숨김 안내 문구 | `[data-grid-cell]` 그리드 | OK | **PASS** |
| F02 | 지도 범례 | `/farm` | 「범례」 없음, 지도 유지 | 「범례」·정상/주의/오프라인 | OK | **PASS** |
| F03 | 지도 하단 SP 목록 | `/farm` (390px) | 모바일 카드 리스트 없음 | SP01~SP10 카드 스택 표시 | OK (수정 후) | **PASS** |
| F04 | 위치 초기화 버튼 | `/farm` | 버튼 없음 | `aria-label="위치 초기화"` | OK | **PASS** |
| F05 | 축사 목록(목록 탭) | `/farm?view=list` | 숨김 안내 | `table` 10행 | OK | **PASS** |
| C01 | 농장·SP 선택 바 | `/controllers` | 「축산업등록번호」 없음 | 컨텍스트 바 표시 | OK | **PASS** |
| C02 | 컨트롤러 목록 | `/controllers` | 컨트롤러 버튼 스트립 없음 | 01~05 버튼 스트립 복원 | OK | **PASS*** |
| C03 | LIVE 모니터 | `/controllers` | 온도·습도 블록 없음 | LIVE 모니터 복원 | OK | **PASS** |
| C04 | 설정 슬라이더 | `/controllers` | `.ctrl-slider-wrap` 0개 | 슬라이더 표시 | OK | **PASS** |
| C05 | 명령 이력 | `/controllers` | 「명령 히스토리」 없음 | 섹션 복원 | OK | **PASS** |
| A01 | 알람 필터·검색 | `/alarms` | 검색 input 없음 | placeholder 복원 | OK | **PASS** |
| A02 | 알람 상세 패널 | `/alarms` | 우측 패널 없음 | 「선택된 알람 없음」 | OK | **PASS** |
| G01 | TopBar 알림 벨 | `/farm` | 벨 버튼 없음 | `알림 N건` 버튼 | OK | **PASS** |

\* C02: embedded `ControllerListPanel`은 섹션 제목 「컨트롤러 목록」 문자열을 렌더하지 않음. 컨트롤러 선택 UI는 정상 동작.

---

## 인터랙티브 UI (표시 설정 외)

| 페이지 | 동작 | 결과 | 비고 |
|--------|------|------|------|
| 농장 | 지도 ↔ 목록 탭 | **PASS** | `?view=list` 전환 시 목록·레이아웃 정상 |
| 컨트롤러 | SP 칩 전환 (SP01→SP02) | **PASS** | 컨트롤러 목록·패널 갱신, 정렬 유지 |
| 알람 | 심각 필터 · 알림 벨 열기 · Escape | **PASS** | 필터·드롭다운·닫기 정상 |

---

## 수정 — F03 지도 하단 SP 목록

**초기 FAIL:** 모바일 SP 카드 목록이 표시 설정과 미연결.

**수정:** `farm-map-view.tsx` — compact 뷰에서 `FarmMapMobileStage`로 모바일 세로 카드 목록 렌더.

**재검증 (390px):** SP01~SP10 모바일 카드 스택 표시 확인 → **PASS**

---

## 레이아웃 검증 기준

- `header` 높이 36~280px (데스크톱)
- `document.documentElement.scrollWidth` ≤ `innerWidth + 8`
- 「This page couldn't load」 등 에러 바운더리 미발생
- 요소 숨김 시 인접 블록이 빈 공간·겹침 없이 유지 (농장 숨김 안내, 알람 1열 그리드 등)

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/lib/data/display-settings-shared.ts` | 설정 키·기본값 |
| `src/components/settings/display-settings-form.tsx` | 표시 설정 폼 |
| `src/components/farm/farm-map-mobile-stage.tsx` | F03 모바일 SP 카드 목록 |
| `src/components/layout/alarm-bell-menu.tsx` | G01 알림 벨 |
