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
- 허브 탭 UI 표기: **델린** (`view=aria` 호환)

## 목적
농장 허브 **델린** 탭에서 **단일 농장** 환경 요약을  
마이크 질문 → STT → **판단 프로토콜** → 서버 UNPACK 문장 → TTS 음성 안내.

탭 구성: 그리드 · 목록 · 차트 · **델린**. URL 계약은 [`farm-hub-url.md`](./farm-hub-url.md).

## 판단 프로토콜

상세·금지·DEPTH/REC 표는 **정본만** 본다: [`aria-protocol.md`](./aria-protocol.md).

요약: `CHAT` / `FARM`(DEPTH 1–4 레이어) / `CTRL`(현장 대응 추천만).  
AI는 코드만, 문장·수치는 서버 pack/unpack.  
세션: 요청 바디 `ariaSession` (탭 유지, DB 미저장).  
Flag: `ARIA_PROTOCOL_V1` 기본 **on**. `false`/`0`/`off` → 레거시 Chat 요약.

## UI (P1 · A안)
- 중앙 **AriaOrb** — 호흡 강화, 청취 시 마이크 RMS 파동
- 하단 **도크** (`layout="dock"`) — FAB 제거, 말하기 CTA 중앙
- Full Name은 타이틀 `title` 툴팁만
- VoiceReport 상태 → 오브 모드 (`lib/aria/aria-mode.ts`)
- `prefers-reduced-motion` 시 애니메이션 정지

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
