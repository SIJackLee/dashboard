# 현장 통합 — 좌 현황 + 우 목록 스플릿

## Flag
`NEXT_PUBLIC_FARM_FIELD_MERGE_V1` — 기본 on. `false`/`0`/`off` → 현행 4탭.

## PC (`lg+`)
- 상위 탭: **현장 · 차트 · DELIN** → TopBar(IoT Board 우측)
- 농장 선택 → 계정 메뉴 (ScopeBar 스티키 없음)
- 현장 = **왼쪽 현황 그리드** + **오른쪽 목록(컨트롤러)**
- 맵|표 밀도 토글 **없음**
- 좌측 카드: 상태 면색 + 명칭 + 온·습도 (히트맵 없음)
- 좌측 카드 선택 → 우측 **해당 축사 컨트롤러만** 표시. 「전체보기」·같은 카드 재탭으로 전체 복귀
- 필터 전환: **exit fade(150ms) → 교체 → stagger enter**(40ms 간격, `ui-motion-stagger-in`)
- 좌측 선택 시 해당 컨트롤러 스크롤·하이라이트
- PC 스플릿: 좌측 현황 **아이콘 토글** — 펼침 15rem / 접힘 2.5rem 레일(나타내기 아이콘). 너비 전환 `duration-motion-moderate`
- 카드 헤더: 「축사유형 N번 축사」/`컨트롤러 M` + 우측 **단일 순환** 버튼
  - 컨트롤러: 그래프 → 설정 → 그래프
  - 일괄 그래프: 설정 → 그래프 → 설정
  - 일괄 설정: 그래프 → 설정 → 그래프
  - 상단 모드 툴바와 같은 크롬

## 모바일
- 현황 그리드만
- 카드 탭 → **Bottom sheet 직행** (인라인 컨트롤러 상세·중복 그래프 없음)
- 시트 안 그래프/설정이 컨트롤러 역할 (기간 토글은 시트 내부)
- 보기 탭(현장·차트·DELIN) → **화면 하단 독** (`data-farm-view-toggle-slot="mobile"`)

## 롤백
환경변수 off.

## 파일
- `farm-page-content.tsx` — 스플릿 셸 · 보기 탭 portal → TopBar(PC) / 하단 독(compact)
- `farm-field-status-grid.tsx` — 좌측 현황
- `top-bar.tsx` — `data-farm-view-toggle-slot="desktop"`
- `dashboard-viewport-shell.tsx` — compact 하단 독 슬롯
- `account-menu.tsx` — 농장 선택 (PC·모바일)
