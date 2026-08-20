# 축사 모델 (2D 평면)

농장 허브 **모델** 탭. 위성 위에 부지 경계를 그리고, 그 안에 축사를 놓는 **2D 정본**.

옛 3D 탭은 은퇴. [`BARN_MODEL.md`](./BARN_MODEL.md)

구현: `src/lib/farm/barn-plan-boundary.ts`, `src/components/farm/farm-plan-view.tsx`, `farm-plan-site-map.tsx`  
URL: [`farm-hub-url.md`](./farm-hub-url.md) (`view=model`, 옛 `view=plan`은 같은 탭)

필드 탭은 운영 LIVE 카드 그대로. 위성 부지는 **모델만**.

---

## 게이트

| 환경 | 기본 |
|------|------|
| 로컬 `development` | 노출 |
| Vercel Preview | 노출 |
| Production | **숨김**. 강제 on: `NEXT_PUBLIC_BARN_PLAN_ENABLED=true` |

강제: `NEXT_PUBLIC_BARN_PLAN_ENABLED` = `true` \| `false` (이름만 `.env.example`).

플래그 off면 `view=plan` · `view=model` → 필드(map). 탭도 숨긴다.

---

## 흐름 (Fincabout 기준)

허브에는 농장이 이미 있으므로 프로젝트 생성은 생략한다.

| 단계 | 내용 | 상태 |
|------|------|------|
| 1 | 프로젝트 생성 | 생략 |
| 2 | 지도 선택(위성/지도) + 구역 스캔(점 → 경계, 면적) | **구현** |
| 2b | 고른 구획 → 1m 격자 필드 | **구현** |
| 3 | 새 건물 → 독 옆에서 방·각도 맞추기 → 배치 | **구현** |
| 3b | 배치 완료 → 구획 숨김 → 방 선택(윈도우) → 연결 / 해제 → LIVE 부여 | **구현** |
| 4 | 회전 | 이후 |

가져올 것: 부지 격자/경계가 캔버스, 고른 뒤 맵 클릭, 2D 정본.  
가져오지 말 것: Farm/Design 카드, 작물 라이브러리, Cattle Ranch 템플릿, 초록 다크 테마, 벽 CAD, AI 주택 생성.

---

## 2단계 — 위성 + 구역 스캔

전폭 지도. 높이는 헤더·탭을 뺀 `100dvh` 계산(명시 px/vh). 스크롤 `main`의 `flex-1`만으로는 맵이 접힌다.

`KAKAO_JS_KEY`(또는 `NEXT_PUBLIC_KAKAO_JS_KEY`)가 있으면 **카카오맵** (위성=하이브리드, 지도=로드맵, 지적편집도 오버레이). 없거나 SDK 실패 시 Leaflet (SAT=Esri, MAP=OSM 한국). 카카오 JS 도메인: `http://localhost:3000`, `https://smart.autofankorea.com`.

- 클릭으로 꼭짓점. 3점 이상이면 첫 점 재클릭 또는 **닫기**로 폐합
- 닫힌 뒤 꼭짓점 드래그. **다시 그리기**로 초기화
- 면적은 구면 근사(m² / ha). 맵 수치 토큰(`--density-map-value*`)
- 농장 주소 → 좌표: 카카오 도로명 검색이 필지. 실패하면 시·면 중심을 필지로 쓰지 않음. 키: `KAKAO_REST_API_KEY` (`.env.example` 이름만)
- 주소 경계: 확대 후 **구획을 눌러 선택**. **필드로 만들기** → 1m 격자만 남고 지번·지목은 표시하지 않음. 키: `VWORLD_API_KEY`. 저장본은 다시 열면 선택 복원
- **필드로 만들기** 이후: 고른 구획 안에 위성 타일을 반투명으로 올린다. 브라우저가 `GET /api/farm-plan/sat-overlay?z=&x=&y=`로 JPEG를 받고, 구획 폴리곤으로 자른다. 키: `VWORLD_API_KEY`(WMTS Satellite, 실패 시 Esri 타일). 좌측 상단 **새 건물**을 누르면 임시 동이 올라가고, **독 오른쪽**에서 방·복도를 맞추며 **오른쪽 각도 핸들**로 5° 단위 회전한다. **위·아래 변**은 열식(1–5열), **좌·우 변**은 칸 수. **배치하기**로 확정. 동이 하나 이상이면 **배치 완료**로 부여 단계. 저장: `sungil.barn-plan.site.v1:${farmId}` (로컬만). 단계는 `sungil.barn-plan.phase.v1:${farmId}`.
- **배치 완료** 이후: 위성·구획 윤곽은 끄고, 동은 **세로로 세운 뒤 가로로 나란히** 모인다(`--motion-duration-emphasis`). 배치 좌표는 유지. 좌측 **방 선택**으로 끌어서 윈도우를 만들고, 손을 뗀 자리에 **연결**·**해제**가 뜬다. **연결**을 누르면 그 옆에 LIVE 축사(유형명+번호) 목록이 나오고, 고르면 칸에 붙는다. 덩어리 가운데에 이름이 뜬다. **해제**는 고른 칸에서 뗀다. **한 LIVE는 한 동만.** 형태를 고치려면 **건물 다시 배치**. 옛 3D v2 키와는 섞지 않는다.
- 저장: `sungil.barn-plan.site.v2:${farmId}` (부지 경계, 로컬만). v1 건물과 별개
- URL `planBldg` / `planSp` / `planStall` 은 배치 후 포커스용. 지금은 쓰지 않음

넣지 않음: CAD · 좌측 카탈로그 상점 · DB · Production 기본 on · Three

---

## 확인

```bash
cd web
npx tsx src/lib/farm/barn-plan-boundary.test.ts
npx tsx src/lib/farm/barn-plan-union.test.ts
npx tsx src/lib/farm/barn-plan-sat-overlay.test.ts
npx tsx src/lib/farm/barn-plan-field.test.ts
npx tsx src/lib/farm/barn-plan-place.test.ts
npx tsx src/lib/farm/barn-plan-phase.test.ts
npx tsx src/lib/farm/barn-site-prefs.test.ts
npm run verify:design
# 로컬: 농장 허브 → 모델. 구획 고르기 → 필드로 만들기 → 새 건물 → 배치하기 → 배치 완료 → 방 선택(윈도우) → 연결 / 해제 → LIVE 부여
```
