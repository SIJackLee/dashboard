# TopBar 알림 벨 — 동작 테스트 결과 (2026-06-11)

환경: `http://localhost:3001` (production build) · 로그인 `Test Admin`  
방법: 브라우저 자동 검증 + 코드 리뷰

## 요약

| 구분 | PASS | FAIL | SKIP / 수동 |
|------|------|------|-------------|
| 19 시나리오 | 14 | 0 (수정 후) | 5 |

**수정 사항:** 클릭 시 `Base UI error #31` (`MenuGroupRootContext is missing`) 발생 → `DropdownMenuLabel`을 `DropdownMenuGroup`으로 감싸 해결.

---

## 시나리오별 결과

| ID | 결과 | 비고 |
|----|------|------|
| B01 | **PASS** | TopBar 우측에 알림 버튼 표시 (`DisplayGate global.topBarBell` ON) |
| B02 | **PASS** | 활성 알림 0건 시 `aria-label="알림"` |
| B03 | **PASS** | `aria-haspopup="menu"`, `data-slot="dropdown-menu-trigger"` |
| B04 | **PASS** | 버튼 크기 약 52×52px, `rounded-lg p-3`, Bell 아이콘(SVG) |
| B05 | **PASS** | 활성 알림 0건 시 빨간 배지 없음 |
| B06 | **PASS** | 클릭 시 드롭다운 열림 — **수정 전 FAIL** (페이지 전체 크래시) |
| B07 | **PASS** | 드롭다운 헤더 「활성 알림」 |
| B08 | **PASS** | 활성 알림 없을 때 「활성 알림 없음」 문구 |
| B09 | **PASS** | `Escape` 키로 드롭다운 닫힘 |
| B10 | **SKIP** | 활성 알림 N건 시 `aria-label="알림 N건"` + 빨간 카운트 배지 (LIVE 0건) |
| B11 | **SKIP** | 드롭다운 헤더 우측 `N건` destructive 배지 (LIVE 0건) |
| B12 | **SKIP** | 알림 항목 최대 8건 · 심각/주의 배지 · 상세·시각 표시 (LIVE 0건) |
| B13 | **SKIP** | 항목 클릭 → `/alarms?alarm=...` 이동 (LIVE 0건) |
| B14 | **SKIP** | 하단 「알람 페이지로 이동」 / 「전체 N건 보기」 (count>0일 때만 렌더) |
| B15 | **PASS** | `/farm`, `/alarms`, `/controllers` 등 `PageShell` 페이지에 동일 TopBar 슬롯 |
| B16 | **PASS** | 설정 → 표시 → 「TopBar 알림 벨」 OFF 저장 후 벨 숨김 |
| B17 | **PASS** | 「TopBar 알림 벨」 ON 복원 후 벨 재표시 |
| B18 | **수동 PASS** | 온도 상한/하한 반전값 저장 후 알람·벨 연동 (사용자 확인) |
| B19 | **PASS** | 빌드(`npm run build`) 성공 |

---

## 발견·수정한 버그

**증상:** 알림 벨 클릭 시 `This page couldn't load` / React hydration 또는 Base UI 런타임 오류.

**원인:** Base UI `Menu.GroupLabel`(`DropdownMenuLabel`)이 `Menu.Group`(`DropdownMenuGroup`) 밖에서 사용됨.

**수정 파일:** `src/components/layout/alarm-bell-menu.tsx`

```tsx
<DropdownMenuGroup>
  <DropdownMenuLabel>…</DropdownMenuLabel>
</DropdownMenuGroup>
```

---

## 미검증 항목 (LIVE 데이터 0건)

활성 알림이 있는 상태에서 아래를 추가 확인하면 좋습니다.

1. 벨 배지 숫자와 드롭다운 헤더 `N건` 일치
2. 항목 클릭 시 `alarmControlHref`로 컨트롤러 딥링크
3. 9건 이상일 때 「전체 N건 보기」 문구

온도 반전 임계값 시나리오(B18)는 사용자 수동 테스트 완료.
