# 모바일 UI Audit (`mobile-ui-audit.mjs`)

375×812 뷰포트에서 **admin / operator / viewer** 주요 경로의 레이아웃·터치 타겟을 자동 검수합니다.

## 실행

```bash
cd dashboard/web
npm run dev   # http://localhost:3000
node scripts/mobile-ui-audit.mjs
```

환경 변수:

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `UI_VERIFY_BASE` | `http://localhost:3000` | 대시보드 베이스 URL |

테스트 계정 비밀번호 (`scripts/test-accounts.mjs`):

| 역할 | 이메일 | 비밀번호 |
|------|--------|----------|
| admin | `admin@test.com` | `admin1` |
| operator | `farmer@test.com` | `farmer` |
| viewer | `viewer@test.com` | `viewer` |

audit 실행 전 `npm run set:test-passwords`로 Supabase에 반영할 수 있습니다 (service role 필요).

## 산출물

`scripts/mobile-audit-output/`

- `report.json` — 페이지별 이슈·메트릭
- `*.png` — 역할·경로별 스크린샷

## 검수 기준 (휴리스틱)

| 코드 | 심각도 | 조건 | 허용 기준 |
|------|--------|------|-----------|
| `HORIZONTAL_OVERFLOW` | high | 문서 가로 스크롤 > viewport | **0건** |
| `TEXT_CLIPPED` | medium | 버튼·라벨 등 3건+ 잘림 | **0건** (또는 2건 이하) |
| `TABLE_OVERFLOW` | medium | 테이블이 viewport보다 넓음 | **0건** |
| `OVERSIZED_TEXT` | medium | 24px+ 텍스트 노드 8건 초과 | 역할·페이지별 문맥 검토 |
| `OVERSIZED_BUTTONS` | low | 본문 버튼 높이 ≥56px **또는** 글자 ≥20px, 라벨 1~24자, **4건 이상** | **0건** (clean 목표) |

### 제외 영역 (오탐 방지)

- **Shell**: `header`, `aria-label="모바일 앱 메뉴"`, `운영 탭`, `모니터링 탭` 등 — 44px+ 터치 타겟 허용
- **지도**: Leaflet 컨트롤 (`.leaflet-control`, `.leaflet-bar`)
- **Farm map 리스트**: `[data-audit-region="farm-map-list"]`

### 모바일 compact 대상 (참고)

- 알람 strip (`ops-mobile-alarm-strip`, `density=compact`)
- Health DAG 리스트 (`health-dag-mobile-list`, `HealthStatusBadge compact`)
- 채널 설정 3버튼 (`ChannelSettingsBar compact`)
- Admin 축사유형 그리드 (`ops-mobile-sp-overview`)

## 합격 판정

- **Release gate**: `issueCount === 0` 인 페이지 비율 = **100%** (현재 25경로)
- `low` 이슈는 터치 UX 개선용; high/medium은 배포 전 해소 권장

## 관련 스크립트

- `ui-route-verify.mjs` — 데스크톱·라우트 HTTP/렌더 스모크 (모바일 레이아웃 미포함)
