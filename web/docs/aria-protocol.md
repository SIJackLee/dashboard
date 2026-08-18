# DELIN(델린) 판단 프로토콜

> **역할: 정본** — JUDGE / SAY / REC / DEPTH / 금지 사항.  
> PoC UI·API·한도·롤백·플래그 운영: [`voice-report-poc.md`](./voice-report-poc.md)  
> 문서 찾기: [`README.md`](./README.md)

**DELIN** = *Data-driven Environmental & Livestock Intelligence Navigator*  
**델린** = 데이터 기반 축사 환경·가축 지능형 안내자  
(코드·URL 호환 키는 당분간 `aria` / `ARIA_PROTOCOL_V1` 유지)

AI는 **라우팅·슬롯·판단 코드**만 담당하고, 수치·정식 명칭·최종 문장은 서버가 pack/unpack 한다.

## Feature flag

`ARIA_PROTOCOL_V1=true` (기본 **on**). `false`/`0`/`off` 이면 레거시 Chat 요약 경로.

## 생육 권장 온·습도 (1차 판단 정본)

델린 JUDGE·DEPTH 1·CTRL 추천·사이드패널의 정본은 **축사유형 권장표**다. LIVE **축사유형**만으로 띠를 고른다. 일령·체중·방 내부 구역은 쓰지 않는다.

| 축사유형 | 행 | 온도 | 습도 |
|----------|----|------|------|
| 후보돈사 · 임신사 | 임신돈 | 16~21℃ | 50~60% |
| 분만사 | 분만·포유모돈 | 18~21℃ | 50~60% |
| 베이비하우스 | 이유자돈 | 25~28℃ | 60~80% |
| 자돈사 | 자돈·육성 초기 | 18~22℃ | 50~80% |
| 육성사 · 비육사 · 검정사 | 육성·비육돈 | 15~20℃ | 40~60% |
| 종부사 | 종모돈 | 16~21℃ | 50~60% |

- **분만사**는 모돈 구역만. 자돈 보온 30~35℃는 동 공기 판정에 넣지 않는다.
- 추천 목표: 띠 **안이면 현재값**, 밖이면 **가장 가까운 가장자리** (임신사 24℃ → 21℃).
- 장비 경보 목록 임계(예: 온도 10~35℃)는 **안전망으로 유지**. 델린 JUDGE·패널만 표를 쓴다.
- 1차 사이드패널은 **알림만**. 명령·MQTT·적용 버튼 없음.
- 기상 ±1℃·환기 +10%는 1차 목표가 아니다. 기상 적용 UI는 허브에서 숨긴다.
- **허브 뱃지:** 현장·차트·모델 우측 하단. 이름 DELIN, 제목+상세 말풍선. 전용 탭 없음. `view=aria`는 현장. 목록에는 없음. 음성·적용 없음. 차트·현장·모델은 **축사유형** 단위(모델은 고른 동).

코드: `src/lib/farm/pig-env-recommend.ts`.

## 경로

| ROUTE | 역할 |
|-------|------|
| `CHAT` | 잡담 — AI 자유 응대 (농장 수치 금지) |
| `FARM` | 현황 드릴다운 — judge 코드 → UNPACK |
| `CTRL` | **현장 대응** 추천만 (알람 임계·설정 변경·명령 없음) |

## FARM 깊이 (DEPTH 1~4) — 레이어만 말하기

각 DEPTH는 **그 단계 정보만** UNPACK (이전 DEPTH 내용 반복 금지).

| DEPTH | SAY | 내용 |
|-------|-----|------|
| 1 | `TYPE_SUMMARY` | 축사유형별 권장 온·습도 대비 + 이상 건수 |
| 2 | `ALARM_LIST` | 경고·위험 **유형** |
| 3 | `CTRL_LIST` | 대상 컨트롤러 위치 |
| 4 | `DIAG` | **위치·진단유형 묶음** — 「{축사유형} 축사 N번의 A번과 B번 컨트롤러는 {유형}입니다」 |

혼합 턴 C:
- 「자세히/전부/진단해/디테일/건별…」→ DEPTH=4 (DIAG만)
- 「더 알려줘」+ 직전 FARM → **session.depth + 1** (이미 4면 천장 안내, DIAG 반복 없음)
- 「위험만」→ 위험(critical)만 UNPACK
- 「왜 그래」→ DEPTH 2 힌트
- 단독 「추천해줘」→ 대상 clarify (CTRL)
- 「환기 어떻게」→ CTRL

말하기: `farm_location.farm_name`이 있으면 그대로 부름. 없으면 `FARM01 · 양돈` → **양돈 농장**.
CHAT 소개·날씨에 영문 풀네임·기획 메타문구 금지.
톤: **합니다체** 우선. 「누가」→ 사람 아님·컨트롤러 위치 안내. 말끝 미완(`컨트롤러가` 등)→ 한 번 확인.
MORE 단계: 「이어서 …」도입부 변주.

## Judge 예시

```text
ROUTE: FARM
DEPTH: 4
JUDGE: CRIT
FOCUS: STALL_TYPE=분만사
SAY: DIAG
NEXT_HINT: NONE
```

## CTRL 추천 예시 (대응 방안)

```text
ROUTE: CTRL
JUDGE: RECOMMEND
REC: RAISE_MAX_VENT
SAY: REC_TEXT
```

| REC | 의미 |
|-----|------|
| `RAISE_MAX_VENT` | 최고환기량 상향. **이미 100%면** 현장 확인 유도. 아니면 「올려보세요」(+ 현재 XX%) |
| `CHECK_COOLING` / `CHECK_HEATING` | 쿨링·난방 현장 확인 |
| `CHECK_HUMIDITY` | 가습·제습·환기 |
| `INSTRUCT_WORKER` | 작업자 점검 지시 |
| `CHECK_OFFLINE` | 통신·전원 확인 |
| `NONE` | 추가 대응 없음 |

UNPACK: **「알람 임계값은 바꾸지 마세요」**. 명령·설정 저장 API 없음. FACT에 `maxVent` 포함.

## 금지

- 답변에 내부 ID (`FARM01/P00`), JSON/필드명 노출
- CTRL에서 알람 상·하한 변경 추천, 명령 전송, 「적용했습니다」 환각
- 모터 출렁임 진단 (데이터 파이프 후속)

## 1차 진단 소스

- **생육 권장표** (`pig-env-recommend.ts`) — 델린 판정·추천 목표.
- **장비 경보** (`alarms.ts`) — 온도 상·하한, 습도 상·하한, 통신 두절. 안전망이며 임계는 바꾸지 않는다.

통신 두절이 있으면 CTRL은 `CHECK_OFFLINE`을 우선한다. 그다음 권장표 온도 높음→`RAISE_MAX_VENT`, 낮음→`CHECK_HEATING`, 습도 이탈→`CHECK_HUMIDITY`.

## 코드

- `src/lib/aria/protocol/` — types, pack, unpack, route, judge parse, pipeline, turn-log
- 단위 테스트: `npx tsx src/lib/aria/protocol/protocol.test.ts`
- ask API: `ARIA_PROTOCOL_V1` on 시 `runAriaProtocol` (CHAT는 facts 미조회)
- 턴 로그: `aria_turn_log` + `ARIA_TURN_LOG` (기본 on). **보관 7일**. 검수 라벨 `feedback`=`ok`|`bad`. UI `/admin/ops#aria-logs`
