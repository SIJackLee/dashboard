# 음성 AI 리포팅 PoC — DELIN(델린)

> **역할: 보조 (PoC·UI·API·한도·롤백)** — 판단 규칙 정본이 **아님**.  
> 정본: [`aria-protocol.md`](./aria-protocol.md)  
> 문서 찾기: [`README.md`](./README.md)

## 작업 태그
채팅에서 **`[프로토콜]`** 을 붙이면 이 문서·관련 코드(AI 음성 / NLP) 작업을 의미한다.  
Cursor 규칙: 워크스페이스 `.cursor/rules/voice-protocol.mdc`.

## 명칭
- **DELIN** — *Data-driven Environmental & Livestock Intelligence Navigator*
- **델린** — 데이터 기반 축사 환경·가축 지능형 안내자
- 유래: 목동·가축의 수호성인 성 벤델리노(Wendelin)
- 슬로건: 축사를 이해하고, 농장을 지키는 AI — DELIN
- 허브 UI: 현장·차트·모델 **우측 하단 DELIN 뱃지**. 전용 탭 없음 (`view=aria`/`jarvis` → 현장). 모바일은 말풍선 숨김 시 오른쪽 끝 아이콘만, 탭하면 펼침.

## 출시 게이트
정식 RELEASE에서는 **코드 기본 숨김**.  
`src/lib/aria/delin-enabled.ts` — 로컬 `development` · Vercel `preview` 기본 on, Production 기본 off.  
강제: `NEXT_PUBLIC_DELIN_ENABLED=true|false`. Production 노출은 Vercel Production에 `true`.

## 목적
DELIN은 **뱃지 BOT 단독**으로 운영한다. 오브·TTS·말하기 도크는 은퇴하고,  
현장·차트·모델 우측 하단 **DELIN 뱃지**가 사용자가 보는 화면에서 조언한다.  
근거는 **한국 양돈 표준 권장 온·습도표**이며, 조언 우선순위는  
**통신두절 → 장비 경보(안전망 임계) → 권장표 이탈 → 적정** 이다.  
프로토콜·음성 코드는 되돌리기 쉽게 **보존**하되 `VOICE_REPORT_ENABLED=false`로 끈다.

상단 탭: 현장(그리드·목록) · 차트 · 모델. URL 계약은 [`farm-hub-url.md`](./farm-hub-url.md).

## 판단 프로토콜

상세·금지·DEPTH/REC 표는 **정본만** 본다: [`aria-protocol.md`](./aria-protocol.md).

요약: `CHAT` / `FARM`(DEPTH 1–4 레이어) / `CTRL`(현장 대응 추천만).  
AI는 코드만, 문장·수치는 서버 pack/unpack.  
세션: 요청 바디 `ariaSession` (탭 유지, DB 미저장).  
Flag: `ARIA_PROTOCOL_V1` 기본 **on**. `false`/`0`/`off` → 레거시 Chat 요약.

## UI (현행 · 뱃지 BOT)
- 현장·차트·모델 우측 하단 **DELIN 뱃지** (`delin-env-badge.tsx`) — Bot 아이콘 + 말풍선. 음성·적용 없음.
- 조언 톤: 통신두절·장비경보 = danger, 권장표 이탈 = warn, 적정 = 기본.
- 화면 맥락(축사유형)만 판정. 내부 ID·영문 필드 노출 없음.

### (은퇴) 오브·TTS UI
- `AriaOrb`·말하기 도크·`view=aria` 오브 화면은 사용하지 않는다(코드 보존, 플래그 off).
- `resolveFarmHubView`가 `aria`/`jarvis`를 현장으로 정규화하므로 탭·오브는 노출되지 않는다.

## 사용
1. `.env.local`에 `OPENAI_API_KEY` 설정
2. 농장 **ARIA** 탭 → 하단 도크에서 말하기/텍스트
3. **말하기** (최대 15초) 또는 텍스트 입력
4. 자막 + (옵션) 음성 재생

질문 예:
- 「안녕」→ CHAT (facts 미조회)
- 「상황 어때」→ FARM DEPTH1
- 「뭐가 문제야」→ DEPTH2
- 「어느 컨트롤러」→ DEPTH3
- 「자세히 진단까지」→ DEPTH4
- 「설정 추천」→ CTRL 추천 문구 + “적용하지 않음”

농장 미지정 시 URL 현재 농장. **한 요청 = 농장 1개**.

패널 내 **사운드 체크**(비프) / **마이크 테스트**(2초 녹음·재생)로  
스피커·자동재생·마이크 권한을 API 호출 없이 점검할 수 있습니다.

답변에 내부 ID(`FARM01/P00`), JSON/필드명(`alarmItems` 등)을 넣지 않습니다.  
대시보드 정식 명칭만 사용합니다.

## API
- `POST /api/voice-report/ask`
  - JSON: `{ question, currentLsind, currentItem, withTts?, ariaSession? }`
  - multipart: `audio`, `currentLsind`, `currentItem`, `durationSec`, `withTts`, `ariaSession?`
  - 응답: `text`, `source`(`protocol`|`protocol_heuristic`|`chat`|…), `ariaRoute`, `ariaSession`
  - 프로토콜 on 시 `aria_turn_log`에 턴 기록 (질문·route·depth·미리보기). Flag: `ARIA_TURN_LOG` 기본 on
  - **보관 7일** — `cleanup_aria_turn_log` + 매일 cron(03:15 KST). insert 후에도 RPC 정리
  - 관리자 검수: `/admin/ops#aria-logs`에서 **맞음(`ok`) / 틀림(`bad`)** 라벨
- `GET /api/voice-report/usage`
- `GET /api/voice-report/aria-logs?limit=50&route=FARM` — **관리자만** 오분류 검수
- 운영 UI: `/admin/ops#aria-logs` — ARIA 턴 로그 표 (route 필터·새로고침)

## 모델 (기본)
- STT: `gpt-4o-mini-transcribe` (실패 시 `whisper-1`)
- Chat/Judge: `gpt-4o-mini` (프로토콜 시 자유 문장 생성은 CHAT만)
- TTS: `tts-1` / voice `alloy` (`VOICE_TTS_VOICE`로 변경 가능)

키 없이 텍스트만 요청하면 프로토콜 **휴리스틱 unpack**(과금 0). 음성 STT는 키 필수.  
`ARIA_PROTOCOL_V1=off` 이면 레거시: OpenAI 요약 또는 템플릿 요약.

## 한도
- 월 soft $20 / hard $24 (메모리, 재시작 리셋)
- 녹음 ≤15초, 질문 ≤200자, 답변 ≤250자
- 분당 10 / 시간 60 / 쿨다운 2초

## 롤백
- `ARIA_PROTOCOL_V1=false` → 레거시 Chat 요약
- `ARIA_TURN_LOG=false` → 턴 로그 중단 (테이블은 유지)
- `VOICE_REPORT_ENABLED=false` 또는 ARIA 탭·FAB·API 제거
- 레거시 URL `view=jarvis`는 `aria`로 해석됩니다.
